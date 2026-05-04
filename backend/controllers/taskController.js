const Task = require("../models/Task")
const WorkSession = require("../models/WorkSession")
const User = require("../models/User")
const Notification = require("../models/Notification")
const { getISTDateString, toIST } = require("../utils/timeUtils")
const { emitToUser } = require("../socket/socketManager")


/**
 * Helper: getNow()
 * Returns current IST-shifted Date object.
 */
const getNow = () => toIST(new Date());

// ─────────────────────────────────────────────
// FUNCTION 1: createTask
// ─────────────────────────────────────────────
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, priority, assignedTo, plannedDate } = req.body

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
      date: getISTDateString(),
      plannedDate: plannedDate ? new Date(plannedDate) : new Date(getISTDateString())
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
    const todayStr = getISTDateString()
    
    // IST Boundaries (Already IST-as-UTC in DB)
    const istMidnight = new Date(`${todayStr}T00:00:00.000Z`)
    const istEndOfDay = new Date(`${todayStr}T23:59:59.999Z`)

    const populateFields = "name employeeId profilePhoto"

    // 1. Fetch all tasks assigned to the user or created by the user
    const [assignedToMeRaw, myTasksRaw, assignedByMeRaw] = await Promise.all([
      Task.find({ assignedTo: userId, createdBy: { $ne: userId } })
        .populate("createdBy", populateFields)
        .populate("assignedTo", populateFields),
      Task.find({ assignedTo: userId, createdBy: userId })
        .populate("createdBy", populateFields)
        .populate("assignedTo", populateFields),
      Task.find({ createdBy: userId, assignedTo: { $ne: userId } })
        .populate("createdBy", populateFields)
        .populate("assignedTo", populateFields)
    ])

    // Safety Guard: Close stale sessions (same as before)
    const Attendance = require("../models/Attendance")
    const todayAttendance = await Attendance.findOne({
      userId,
      date: todayStr,
      checkOut: { $exists: true, $ne: null }
    })

    if (todayAttendance?.checkOut) {
      const staleSessions = await WorkSession.find({ userId, endTime: null })
      for (const session of staleSessions) {
        session.endTime = todayAttendance.checkOut
        session.duration = Math.max(0, Math.floor((session.endTime - session.startTime) / 1000))
        await session.save()
        const staleTask = await Task.findById(session.taskId)
        if (staleTask && staleTask.status === 'in-progress') {
          // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
          // that may be missing fields added to the schema after they were created.
          await Task.findByIdAndUpdate(staleTask._id, {
            $inc: { totalTime: session.duration },
            $set: { status: 'paused' }
          })
        }
      }
    }

    const allRelevantTasks = [...assignedToMeRaw, ...myTasksRaw, ...assignedByMeRaw]
    const allTaskIds = allRelevantTasks.map(t => t._id)
    const allSessions = await WorkSession.find({ taskId: { $in: allTaskIds } })

    // Attach sessions to tasks
    const tasksWithSessions = allRelevantTasks.map(task => {
      const sessions = allSessions.filter(s => s.taskId.toString() === task._id.toString())
      return { ...task.toObject(), sessions }
    })

    // 2. Dynamic Planning Logic
    const today = []
    const backlog = []
    const upcoming = []
    const completed = []

    // Use a Map to prevent duplicates (since a task could be in both 'assignedToMe' and 'myTasks' theoretically)
    const uniqueTasks = new Map()
    tasksWithSessions.forEach(t => uniqueTasks.set(t._id.toString(), t))

    uniqueTasks.forEach(task => {
      const pDate = task.plannedDate ? new Date(task.plannedDate) : null
      const isCompleted = task.status === "completed"

      if (isCompleted) {
        if (task.completedAt && new Date(task.completedAt) >= istMidnight) {
          completed.push(task)
        }
        return
      }

      // Categorization for Active/Pending Tasks
      if (!pDate) {
        today.push(task) // Default to today
      } else if (pDate >= istMidnight && pDate <= istEndOfDay) {
        today.push(task)
      } else if (pDate < istMidnight) {
        today.push(task) // Today includes Carry-over
        backlog.push(task)
      } else if (pDate > istEndOfDay) {
        upcoming.push(task)
      }
    })

    const sortTasks = (tasks) => {
      const order = { "in-progress": 0, "paused": 1, "todo": 2 };
      return tasks.sort((a, b) => order[a.status] - order[b.status]);
    }

    res.status(200).json({
      success: true,
      data: {
        // New planning structure
        todayTasks: sortTasks(today),
        backlogTasks: sortTasks(backlog),
        upcomingTasks: sortTasks(upcoming),
        completedToday: completed,
        // Legacy structure fallback for compatibility
        assignedToMe: sortTasks(assignedToMeRaw.map(t => {
          const sessions = allSessions.filter(s => s.taskId.toString() === t._id.toString())
          return { ...t.toObject(), sessions }
        })),
        myTasks: sortTasks(myTasksRaw.map(t => {
          const sessions = allSessions.filter(s => s.taskId.toString() === t._id.toString())
          return { ...t.toObject(), sessions }
        })),
        assignedByMe: sortTasks(assignedByMeRaw.map(t => {
          const sessions = allSessions.filter(s => s.taskId.toString() === t._id.toString())
          return { ...t.toObject(), sessions }
        }))
      },
      message: "Planned tasks retrieved successfully"
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
        // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
        // that may be missing fields added to the schema after they were created.
        await Task.findByIdAndUpdate(activeTask._id, {
          $inc: { totalTime: session.duration },
          $set: { status: "paused" }
        })
      }
    }

    // Create new WorkSession
    await WorkSession.create({
      taskId: task._id,
      userId: req.user._id,
      startTime: getNow()
    })

    // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
    await Task.findByIdAndUpdate(task._id, { $set: { status: "in-progress" } })

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

    // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
    await Task.findByIdAndUpdate(task._id, {
      $inc: { totalTime: session.duration },
      $set: { status: "paused" }
    })

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
        // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
        await Task.findByIdAndUpdate(activeTask._id, {
          $inc: { totalTime: session.duration },
          $set: { status: "paused" }
        })
      }
    }

    await WorkSession.create({
      taskId: task._id,
      userId: req.user._id,
      startTime: getNow()
    })

    // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
    await Task.findByIdAndUpdate(task._id, { $set: { status: "in-progress" } })

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

    const completedAt = getNow()
    let extraTime = 0
    if (session) {
      session.endTime = completedAt
      session.duration = Math.floor((session.endTime - session.startTime) / 1000)
      await session.save()
      extraTime = session.duration
    }

    // Use findByIdAndUpdate to avoid Mongoose full-doc validation on old tasks
    await Task.findByIdAndUpdate(task._id, {
      $inc: { totalTime: extraTime },
      $set: { status: "completed", completedAt }
    })

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

    // Only creator OR an Admin can delete
    if (task.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access forbidden — only the creator or an admin can delete this task." })
    }

    // Allow Admin to delete any task, but restrict regular users to 'todo' status only
    if (req.user.role !== 'admin' && task.status !== "todo") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete a task that has already been started." 
      })
    }

    // Cleanup associated data (WorkSessions)
    await WorkSession.deleteMany({ taskId: req.params.id })
    await Task.findByIdAndDelete(req.params.id)

    // Notify user via socket to stop any active timers for this task
    try {
      emitToUser(task.assignedTo.toString(), "task:deleted", {
        taskId: task._id,
        message: "This task has been deleted by an administrator."
      })
    } catch (err) {
      console.error("Socket emit failed during task deletion:", err)
    }

    res.status(200).json({ success: true, message: "Task and associated work logs deleted successfully" })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 8: getAllTasksAdmin (Activity-Based)
// ─────────────────────────────────────────────
exports.getAllTasksAdmin = async (req, res, next) => {
  try {
    const dateStr = req.query.date || getISTDateString() // "YYYY-MM-DD"
    const populateFields = "name employeeId profilePhoto"

    // 1. Define the IST window (Already IST-as-UTC in DB)
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

    const now = getNow()

    // 2. Find sessions that touched this day
    const sessionsInWindow = await WorkSession.find({
      $or: [
        { startTime: { $gte: dayStart, $lte: dayEnd } }, // Started today
        { endTime: { $gte: dayStart, $lte: dayEnd } },   // Ended today (but started before)
        { endTime: null }                                // Still running (started before or today)
      ]
    })

    // To ensure we don't count time outside the window for the running sessions:
    const activeTaskIds = [...new Set(sessionsInWindow.map(s => s.taskId.toString()))]

    // 3. Fetch tasks that had activity today
    const tasks = await Task.find({ _id: { $in: activeTaskIds } })
      .populate("createdBy", populateFields)
      .populate("assignedTo", populateFields)

    const tasksWithSessions = tasks.map(task => {
      // For the UI, we only attach sessions that occurred on THIS selected day
      const taskSessions = sessionsInWindow.filter(s => s.taskId.toString() === task._id.toString())
      return { ...task.toObject(), sessions: taskSessions }
    })

    const employees = await User.find({ role: "employee", isActive: true }).select(populateFields)
    
    const employeeSummaries = employees.map(emp => {
      const empSessions = sessionsInWindow.filter(s => s.userId.toString() === emp._id.toString())
      const empTasks = tasksWithSessions.filter(t => t.assignedTo._id.toString() === emp._id.toString())
      
      const activeTask = empTasks.find(t => t.status === "in-progress")
      
      // 4. Calculate real-time seconds for TODAY only (Precision calculation)
      const totalSecondsToday = empSessions.reduce((sum, s) => {
        // Find overlap between the session and the 24h window
        const effectiveStart = Math.max(s.startTime.getTime(), dayStart.getTime())
        const effectiveEnd = Math.min(s.endTime ? s.endTime.getTime() : now.getTime(), dayEnd.getTime())
        
        const overlapMs = Math.max(0, effectiveEnd - effectiveStart)
        return sum + Math.floor(overlapMs / 1000)
      }, 0)

      // Count tasks completed WITHIN the window
      const completedTodayCount = empTasks.filter(t => 
        t.status === "completed" && 
        t.completedAt && 
        new Date(t.completedAt) >= dayStart && 
        new Date(t.completedAt) <= dayEnd
      ).length

      return {
        userId: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        profilePhoto: emp.profilePhoto,
        activeTask: activeTask || null,
        totalTasksToday: empTasks.length,
        completedToday: completedTodayCount,
        totalSecondsToday
      }
    })

    res.status(200).json({
      success: true,
      data: {
        tasks: tasksWithSessions,
        employeeSummaries
      },
      message: "Admin activity-based report retrieved"
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
    const { startDate, endDate } = req.query // "YYYY-MM-DD"
    const populateFields = "name employeeId profilePhoto"

    // 1. Define range boundaries (Already IST-as-UTC in DB)
    const rangeStart = new Date(`${startDate}T00:00:00.000Z`)
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`)

    const now = getNow()

    // 2. Find sessions for this user that overlap with the selected range
    const sessionsInRange = await WorkSession.find({
      userId,
      $or: [
        { startTime: { $gte: rangeStart, $lte: rangeEnd } },
        { endTime: { $gte: rangeStart, $lte: rangeEnd } },
        { endTime: null } // Potential running sessions
      ]
    }).sort({ startTime: -1 })

    if (sessionsInRange.length === 0) {
      return res.status(200).json({
        success: true,
        data: { tasks: [], totalSeconds: 0 },
        message: "No activity found for this period"
      })
    }

    const uniqueTaskIds = [...new Set(sessionsInRange.map(s => s.taskId.toString()))]
    const tasks = await Task.find({ _id: { $in: uniqueTaskIds } })
      .populate("createdBy", populateFields)
      .populate("assignedTo", populateFields)

    let totalSecondsInRange = 0
    const tasksWithCalculatedTime = tasks.map(task => {
      const taskSessions = sessionsInRange.filter(s => s.taskId.toString() === task._id.toString())
      
      // Calculate time spent EXACTLY within the range for this task
      const timeOnTaskInRange = taskSessions.reduce((sum, s) => {
        const effectiveStart = Math.max(s.startTime.getTime(), rangeStart.getTime())
        const effectiveEnd = Math.min(s.endTime ? s.endTime.getTime() : now.getTime(), rangeEnd.getTime())
        
        const overlapMs = Math.max(0, effectiveEnd - effectiveStart)
        return sum + Math.floor(overlapMs / 1000)
      }, 0)

      totalSecondsInRange += timeOnTaskInRange
      return { 
        ...task.toObject(), 
        sessions: taskSessions,
        timeSpentInPeriod: timeOnTaskInRange // Time specifically for this date range
      }
    })

    res.status(200).json({
      success: true,
      data: {
        tasks: tasksWithCalculatedTime,
        totalSeconds: totalSecondsInRange
      },
      message: "Activity-based task report retrieved successfully"
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

// ─────────────────────────────────────────────
// FUNCTION 11: getEmployeeActivity (Admin Drill-down)
// ─────────────────────────────────────────────
exports.getEmployeeActivity = async (req, res, next) => {
  try {
    const { employeeId } = req.params
    const { date } = req.query
    const todayStr = date || getISTDateString()

    // IST Window
    const startOfDay = new Date(`${todayStr}T00:00:00+05:30`)
    const endOfDay = new Date(`${todayStr}T23:59:59+05:30`)

    const employee = await User.findById(employeeId).select("name employeeId profilePhoto")
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" })

    // Fetch sessions that overlap with this IST day for this employee
    const sessions = await WorkSession.find({
      userId: employeeId,
      $or: [
        { startTime: { $gte: startOfDay, $lte: endOfDay } },
        { endTime: { $gte: startOfDay, $lte: endOfDay } },
        { endTime: null } // Potential running sessions
      ]
    }).sort({ startTime: -1 }).lean()

    const uniqueTaskIds = [...new Set(sessions.map(s => s.taskId.toString()))]
    const tasks = await Task.find({ _id: { $in: uniqueTaskIds } }).lean()

    let totalSecondsToday = 0
    const taskMap = {}

    // Initialize map
    tasks.forEach(t => {
      taskMap[t._id.toString()] = {
        ...t,
        sessions: [],
        taskTotalToday: 0
      }
    })

    sessions.forEach(session => {
      const tId = session.taskId.toString()
      if (!taskMap[tId]) return

      // Calculate duration spent EXACTLY within this day
      const sStart = new Date(Math.max(new Date(session.startTime).getTime(), startOfDay.getTime()))
      const sEnd = session.endTime 
        ? new Date(Math.min(new Date(session.endTime).getTime(), endOfDay.getTime()))
        : new Date(Math.min(getNow().getTime(), endOfDay.getTime()))

      let duration = 0
      if (sEnd > sStart) {
        duration = Math.floor((sEnd - sStart) / 1000)
        totalSecondsToday += duration
        taskMap[tId].taskTotalToday += duration
      }

      taskMap[tId].sessions.push({
        ...session,
        effectiveDuration: duration
      })
    })

    // Prepare response
    const groupedTasks = Object.values(taskMap)

    // Sort tasks: In-progress first, then by latest work activity
    groupedTasks.sort((a, b) => {
      const aIsActive = a.status === 'in-progress'
      const bIsActive = b.status === 'in-progress'
      if (aIsActive && !bIsActive) return -1
      if (!aIsActive && bIsActive) return 1
      
      const aLatest = a.sessions.length > 0 ? new Date(a.sessions[0].startTime) : 0
      const bLatest = b.sessions.length > 0 ? new Date(b.sessions[0].startTime) : 0
      return bLatest - aLatest
    })

    res.status(200).json({
      success: true,
      data: {
        employee,
        summary: {
          totalSecondsToday,
          totalTasksWorked: groupedTasks.length,
          totalSessions: sessions.length
        },
        tasks: groupedTasks
      }
    })
  } catch (error) {
    next(error)
  }
}
// ─────────────────────────────────────────────
// FUNCTION 12: updateTask
// ─────────────────────────────────────────────
exports.updateTask = async (req, res, next) => {
  try {
    const { title, description, priority, plannedDate, totalTime } = req.body
    const task = await Task.findById(req.params.id)

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" })
    }

    // Only creator OR Admin can update
    if (task.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access forbidden" })
    }

    if (title) task.title = title
    if (description !== undefined) task.description = description
    if (priority) task.priority = priority
    if (plannedDate) task.plannedDate = new Date(plannedDate)
    
    // Allow admin to manually adjust total time if needed (seconds)
    if (req.user.role === 'admin' && typeof totalTime === 'number') {
      const timeDiff = totalTime - task.totalTime
      if (timeDiff !== 0) {
        // Create an audit log session for this adjustment
        await WorkSession.create({
          taskId: task._id,
          userId: task.assignedTo,
          startTime: getNow(),
          endTime: getNow(),
          duration: timeDiff,
          // We don't have isAdjustment in schema yet, but it will be saved in _doc
          description: `Admin Adjustment by ${req.user.name}` 
        })
      }
      task.totalTime = totalTime
    }

    await task.save()

    const updatedTask = await Task.findById(task._id)
      .populate("createdBy", "name employeeId profilePhoto")
      .populate("assignedTo", "name employeeId profilePhoto")

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Task updated successfully"
    })
  } catch (error) {
    next(error)
  }
}
