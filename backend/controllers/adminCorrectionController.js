const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const WorkSession = require('../models/WorkSession');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { getCurrentISTTime } = require('../utils/timeUtils');

/**
 * 🛡️ Rule: "IST-as-UTC" Safe Parser
 * Converts "YYYY-MM-DDTHH:mm" into a UTC Date object without shifting.
 */
const parseAsUTC = (dateTimeString) => {
  if (!dateTimeString) return null;
  try {
    const [datePart, timePart] = dateTimeString.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, minute));
  } catch (err) {
    return null;
  }
};

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

    // Apply manual updates (Safe UTC parsing - IST-as-UTC strategy)
    if (checkIn !== undefined) {
      attendance.checkIn = checkIn ? parseAsUTC(checkIn) : null;
      attendance.markModified('checkIn');
    }
    if (checkOut !== undefined) {
      attendance.checkOut = checkOut ? parseAsUTC(checkOut) : null;
      attendance.markModified('checkOut');
    }
    
    // 🛡️ RECALCULATION RULE: 
    // If admin explicitly sets a status -> LOCK the status (Manual Override).
    // If admin only updates times (no status in body) -> UNLOCK and allow auto-recalc.
    if (status) {
      attendance.status = status;
      attendance.isManualOverride = true; 
      attendance._isManualStatus = true;   
    } else {
      // If we are updating times but not status, we want to re-enable auto-calculation
      attendance.isManualOverride = false;
      attendance._isManualStatus = false;
    }
    
    if (notes) attendance.notes = notes;
    
    if (breaks) {
      attendance.breaks = breaks.map(b => {
        const start = b.breakStart ? parseAsUTC(b.breakStart) : null;
        const end = b.breakEnd ? parseAsUTC(b.breakEnd) : null;
        return {
          breakStart: start,
          breakEnd: end,
          duration: (start && end) 
            ? Math.floor((end - start) / (1000 * 60)) 
            : 0
        };
      });
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
      const parsedStart = parseAsUTC(startTime);
      const parsedEnd = parseAsUTC(endTime);
      
      if (parsedStart && parsedEnd) {
        const duration = Math.floor((parsedEnd - parsedStart) / 1000);
        
        await WorkSession.create({
          taskId,
          userId: task.assignedTo,
          startTime: parsedStart,
          endTime: parsedEnd,
          duration
        });

        // Update task totalTime
        task.totalTime += duration;
      }
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
