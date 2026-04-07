const Task = require("../models/Task")
const WorkSession = require("../models/WorkSession")
const User = require("../models/User")
const Notification = require("../models/Notification")
const { getTodayDate } = require("../utils/attendanceHelpers")
const { emitToUser } = require("../socket/socketManager")


/**
 * Helper: getNow()
 * Returns current UTC Date object.
 */
const getNow = () => new Date()

// ─────────────────────────────────────────────
// FUNCTION 1: createTask
// ─────────────────────────────────────────────
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, priority, assignedTo } = req.body

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
        errors: []
      })
    }

    const task = new Task({
      title,
      description,
      priority: priority || "medium",
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      date: getTodayDate()
    })

    await task.save()

    const populatedTask = await Task.findById(task._id)
      .populate("createdBy", "name employeeId profilePhoto")
      .populate("assignedTo", "name employeeId profilePhoto")

    res.status(201).json({
      success: true,
      data: populatedTask,
      message: "Task created successfully"
    })

    // ── Send Notification to Assignee ─────────────────────
    try {
      if (assignedTo && assignedTo.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: assignedTo,
          sender: req.user._id,
          type: "task_assigned",
          title: "New Task Assigned",
          message: `${req.user.name} assigned you a new task: ${title}`,
          link: "/tasks",
          targetRole: "employee",
          referenceId: task._id
        })

        emitToUser(assignedTo.toString(), "notification:new", {
          type: "task_assigned",
          title: "📋 New Task Assigned",
          message: `${req.user.name} assigned you: ${title}`,
          link: "/tasks"
        })
      }
    } catch (err) {
      console.error("Task Assignment Notification Error:", err)
    }
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 2: getMyTasks
// ─────────────────────────────────────────────
exports.getMyTasks = async (req, res, next) => {
  try {
    const userId = req.user._id
    const todayStr = getTodayDate()
    const todayStart = new Date(todayStr) // IST 00:00:00 (approx since it uses UTC constructor)
    // To be precise with "today 00:00:00 IST":
    // today 00:00:00 IST = today 00:00:00 UTC - 5:30 = yesterday 18:30:00 UTC
    const istMidnight = new Date(new Date(todayStr + "T00:00:00Z").getTime() - (5.5 * 60 * 60 * 1000))

    const filter = {
      $or: [
        { status: { $in: ["todo", "in-progress", "paused"] } },
        { 
          status: "completed", 
          completedAt: { $gte: istMidnight } 
        }
      ]
    }

    const populateFields = "name employeeId profilePhoto"

    const [assignedToMeRaw, myTasksRaw, assignedByMeRaw] = await Promise.all([
      Task.find({ assignedTo: userId, createdBy: { $ne: userId }, ...filter })
        .populate("createdBy", populateFields)
        .populate("assignedTo", populateFields),
      Task.find({ assignedTo: userId, createdBy: userId, ...filter })
        .populate("createdBy", populateFields)
        .populate("assignedTo", populateFields),
      Task.find({ createdBy: userId, assignedTo: { $ne: userId }, ...filter })
        .populate("createdBy", populateFields)
        .populate("assignedTo", populateFields)
    ])

    const attachSessions = async (tasks) => {
      return await Promise.all(tasks.map(async (task) => {
        const sessions = await WorkSession.find({ taskId: task._id })
        return { ...task.toObject(), sessions }
      }))
    }

    const [assignedToMe, myTasks, assignedByMe] = await Promise.all([
      attachSessions(assignedToMeRaw),
      attachSessions(myTasksRaw),
      attachSessions(assignedByMeRaw)
    ])

    const sortTasks = (tasks) => {
      const order = { "in-progress": 0, "paused": 1, "todo": 2, "completed": 3 }
      return tasks.sort((a, b) => order[a.status] - order[b.status])
    }

    res.status(200).json({
      success: true,
      data: {
        assignedToMe: sortTasks(assignedToMe),
        myTasks: sortTasks(myTasks),
        assignedByMe: sortTasks(assignedByMe)
      },
      message: "Tasks retrieved successfully"
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 3: startTask
// ─────────────────────────────────────────────
exports.startTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" })
    }

    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access forbidden" })
    }

    if (task.status === "in-progress" || task.status === "completed") {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot start a task that is ${task.status}` 
      })
    }

    // ONE ACTIVE TASK RULE
    const activeTask = await Task.findOne({
      assignedTo: req.user._id,
      status: "in-progress"
    })

    if (activeTask) {
      const session = await WorkSession.findOne({
        taskId: activeTask._id,
        endTime: null
      })
      if (session) {
        session.endTime = getNow()
        session.duration = Math.floor((session.endTime - session.startTime) / 1000)
        await session.save()
        activeTask.totalTime += session.duration
        activeTask.status = "paused"
        await activeTask.save()
      }
    }

    // Create new WorkSession
    await WorkSession.create({
      taskId: task._id,
      userId: req.user._id,
      startTime: getNow()
    })

    task.status = "in-progress"
    await task.save()

    const updatedTask = await Task.findById(task._id)
      .populate("createdBy", "name employeeId profilePhoto")
      .populate("assignedTo", "name employeeId profilePhoto")

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Task started"
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 4: pauseTask
// ─────────────────────────────────────────────
exports.pauseTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" })
    }

    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access forbidden" })
    }

    if (task.status !== "in-progress") {
      return res.status(400).json({ 
        success: false, 
        message: "Only in-progress tasks can be paused" 
      })
    }

    const session = await WorkSession.findOne({
      taskId: task._id,
      endTime: null
    })

    if (!session) {
      return res.status(400).json({ success: false, message: "No active session found" })
    }

    session.endTime = getNow()
    session.duration = Math.floor((session.endTime - session.startTime) / 1000)
    await session.save()

    task.totalTime += session.duration
    task.status = "paused"
    await task.save()

    const updatedTask = await Task.findById(task._id)
      .populate("createdBy", "name employeeId profilePhoto")
      .populate("assignedTo", "name employeeId profilePhoto")

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Task paused"
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 5: resumeTask
// ─────────────────────────────────────────────
exports.resumeTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" })
    }

    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access forbidden" })
    }

    if (task.status !== "paused") {
      return res.status(400).json({ 
        success: false, 
        message: "Only paused tasks can be resumed" 
      })
    }

    // ONE ACTIVE TASK RULE
    const activeTask = await Task.findOne({
      assignedTo: req.user._id,
      status: "in-progress"
    })

    if (activeTask) {
      const session = await WorkSession.findOne({
        taskId: activeTask._id,
        endTime: null
      })
      if (session) {
        session.endTime = getNow()
        session.duration = Math.floor((session.endTime - session.startTime) / 1000)
        await session.save()
        activeTask.totalTime += session.duration
        activeTask.status = "paused"
        await activeTask.save()
      }
    }

    await WorkSession.create({
      taskId: task._id,
      userId: req.user._id,
      startTime: getNow()
    })

    task.status = "in-progress"
    await task.save()

    const updatedTask = await Task.findById(task._id)
      .populate("createdBy", "name employeeId profilePhoto")
      .populate("assignedTo", "name employeeId profilePhoto")

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Task resumed"
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 6: completeTask
// ─────────────────────────────────────────────
exports.completeTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" })
    }

    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access forbidden" })
    }

    if (task.status === "completed") {
      return res.status(400).json({ success: false, message: "Task is already completed" })
    }

    const session = await WorkSession.findOne({
      taskId: task._id,
      endTime: null
    })

    if (session) {
      session.endTime = getNow()
      session.duration = Math.floor((session.endTime - session.startTime) / 1000)
      await session.save()
      task.totalTime += session.duration
    }

    task.status = "completed"
    task.completedAt = getNow()
    await task.save()

    const updatedTask = await Task.findById(task._id)
      .populate("createdBy", "name employeeId profilePhoto")
      .populate("assignedTo", "name employeeId profilePhoto")

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Task completed"
    })

    // ── Notify Creator if different from Assignee ──────────
    try {
      if (task.createdBy.toString() !== task.assignedTo.toString()) {
        const creator = await User.findById(task.createdBy)
        if (creator) {
          await Notification.create({
            recipient: task.createdBy,
            sender: task.assignedTo,
            type: "task_completed",
            title: "Task Completed",
            message: `${req.user.name} has completed the task: ${task.title}`,
            link: creator.role === "admin" ? "/admin/tasks" : "/tasks",
            targetRole: creator.role,
            referenceId: task._id
          })

          emitToUser(task.createdBy.toString(), "notification:new", {
            type: "task_completed",
            title: "✅ Task Completed",
            message: `${req.user.name} finished: ${task.title}`,
            link: creator.role === "admin" ? "/admin/tasks" : "/tasks"
          })
        }
      }
    } catch (err) {
      console.error("Task Completion Notification Error:", err)
    }
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 7: deleteTask
// ─────────────────────────────────────────────
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" })
    }

    if (task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access forbidden" })
    }

    if (task.status !== "todo") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete a task that has already been started." 
      })
    }

    await Task.findByIdAndDelete(req.params.id)
    res.status(200).json({ success: true, message: "Task deleted successfully" })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 8: getAllTasksAdmin
// ─────────────────────────────────────────────
exports.getAllTasksAdmin = async (req, res, next) => {
  try {
    const date = req.query.date || getTodayDate()
    const populateFields = "name employeeId profilePhoto"

    const tasks = await Task.find({ date })
      .populate("createdBy", populateFields)
      .populate("assignedTo", populateFields)

    const tasksWithSessions = await Promise.all(tasks.map(async (task) => {
      const sessions = await WorkSession.find({ taskId: task._id })
      return { ...task.toObject(), sessions }
    }))

    const employees = await User.find({ role: "employee" }).select(populateFields)
    
    const employeeSummaries = employees.map(emp => {
      const empTasks = tasksWithSessions.filter(t => t.assignedTo._id.toString() === emp._id.toString())
      const activeTask = empTasks.find(t => t.status === "in-progress")
      
      return {
        userId: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        profilePhoto: emp.profilePhoto,
        activeTask: activeTask || null,
        totalTasksToday: empTasks.length,
        completedToday: empTasks.filter(t => t.status === "completed").length,
        totalSecondsToday: empTasks.reduce((sum, t) => sum + t.totalTime, 0)
      }
    })

    res.status(200).json({
      success: true,
      data: {
        tasks: tasksWithSessions,
        employeeSummaries
      },
      message: "Admin tasks retrieved"
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 9: getEmployeeTaskReport
// ─────────────────────────────────────────────
exports.getEmployeeTaskReport = async (req, res, next) => {
  try {
    const { userId } = req.params
    const { startDate, endDate } = req.query
    const populateFields = "name employeeId profilePhoto"

    const tasks = await Task.find({
      assignedTo: userId,
      date: { $gte: startDate, $lte: endDate }
    })
    .populate("createdBy", populateFields)
    .populate("assignedTo", populateFields)

    const tasksWithSessions = await Promise.all(tasks.map(async (task) => {
      const sessions = await WorkSession.find({ taskId: task._id })
      return { ...task.toObject(), sessions }
    }))

    const totalSeconds = tasksWithSessions.reduce((sum, t) => sum + t.totalTime, 0)

    res.status(200).json({
      success: true,
      data: {
        tasks: tasksWithSessions,
        totalSeconds
      },
      message: "Employee task report retrieved"
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 10: getEmployees (Public for task assignment)
// ─────────────────────────────────────────────
exports.getEmployees = async (req, res, next) => {
  try {
    const employees = await User.find({ isActive: true })
      .select("name employeeId profilePhoto role")
      .sort({ name: 1 })
    
    res.status(200).json({
      success: true,
      data: employees,
      message: "Employees retrieved"
    })
  } catch (error) {
    next(error)
  }
}
