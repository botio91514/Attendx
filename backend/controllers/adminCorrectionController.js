const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const WorkSession = require('../models/WorkSession');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Upsert attendance record for an employee (Manual Admin Override)
 * @route   POST /api/admin/attendance/override
 * @access  Private/Admin
 */
exports.overrideAttendance = async (req, res, next) => {
  try {
    const { userId, date, checkIn, checkOut, status, notes, breaks } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ success: false, message: 'User ID and Date are required' });
    }

    let attendance = await Attendance.findOne({ userId, date });

    if (!attendance) {
      attendance = new Attendance({ userId, date });
    }

    // Apply manual updates
    if (checkIn !== undefined) {
      attendance.checkIn = checkIn ? new Date(checkIn) : null;
    }
    if (checkOut !== undefined) {
      attendance.checkOut = checkOut ? new Date(checkOut) : null;
    }
    
    if (status) {
      attendance.status = status;
      attendance.isManualOverride = true; // 🔥 PERSISTENT LOCK
      attendance._isManualStatus = true;   // Immediate lifecycle flag
    }
    
    if (notes) attendance.notes = notes;
    
    if (breaks) {
      attendance.breaks = breaks.map(b => ({
        breakStart: b.breakStart ? new Date(b.breakStart) : new Date(),
        breakEnd: b.breakEnd ? new Date(b.breakEnd) : null,
        duration: (b.breakStart && b.breakEnd) 
          ? Math.floor((new Date(b.breakEnd) - new Date(b.breakStart)) / (1000 * 60)) 
          : 0
      }));
    }

    // Use settings for status determination
    const settings = await Settings.getSettings();
    attendance._settings = settings;

    await attendance.save();

    // Log the override
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'ATTENDANCE_OVERRIDE',
      targetModel: 'Attendance',
      targetId: attendance._id,
      details: `Manual override for User ${userId} on ${date}. Status: ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      data: attendance,
      message: 'Attendance record updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Override Task and Sessions (Manual Admin Update)
 * @route   POST /api/admin/tasks/override
 * @access  Private/Admin
 */
exports.overrideTask = async (req, res, next) => {
  try {
    const { taskId, status, totalTime, addSession } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (status) task.status = status;
    if (totalTime !== undefined) task.totalTime = totalTime;

    if (addSession) {
      const { startTime, endTime } = addSession;
      const duration = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
      
      await WorkSession.create({
        taskId,
        userId: task.assignedTo,
        startTime,
        endTime,
        duration
      });

      // Update task totalTime
      task.totalTime += duration;
    }

    await task.save();

    // Log the override
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'TASK_OVERRIDE',
      targetModel: 'Task',
      targetId: task._id,
      details: `Manual override for Task ${taskId}. Status: ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
