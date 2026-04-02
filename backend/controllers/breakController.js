const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const { getTodayDate } = require('../utils/attendanceHelpers');

/**
 * @desc    Start lunch break for the day
 * @route   POST /api/attendance/break/start
 * @access  Private (Employee)
 */
const startBreak = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get today's date boundaries in IST (Bug 2B / Fix A)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const today = istNow.toISOString().split('T')[0];

    // 1. Find today's attendance record
    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'You must check in before taking a break',
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start break after checkout',
      });
    }

    if (attendance.break.isOnBreak) {
      return res.status(400).json({
        success: false,
        message: 'You are already on a break',
      });
    }

    // 2. Atomic update to set break start
    const updatedAttendance = await Attendance.findOneAndUpdate(
      { userId, date: today, 'break.isOnBreak': { $ne: true } },
      {
        $set: {
          'break.startTime': new Date(),
          'break.isOnBreak': true
        }
      },
      { new: true }
    );

    if (!updatedAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Could not start break. It might have been started already.',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedAttendance,
      message: 'Break started successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    End the current lunch break
 * @route   POST /api/attendance/break/end
 * @access  Private (Employee)
 */
const endBreak = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();

    const attendance = await Attendance.findOne({ userId, date: today });
    const breakData = attendance?.break || {};

    if (!attendance || !breakData.isOnBreak) {
      return res.status(400).json({
        success: false,
        message: 'You are not currently on a break',
      });
    }

    if (!breakData.startTime) {
      return res.status(400).json({
        success: false,
        message: 'No active break found',
      });
    }

    const endTime = new Date();
    const startTime = new Date(breakData.startTime);
    const sessionDurationMinutes = Math.floor((endTime - startTime) / 60000);
    const currentTotalMinutes = (breakData.durationMinutes || 0) + sessionDurationMinutes;

    // Fetch policy
    const settings = await Settings.getSettings();
    const policyLimit = settings.breakDurationMinutes || 60;
    const exceededPolicy = currentTotalMinutes > policyLimit;

    // Atomic update to end break and accumulate time
    const updatedAttendance = await Attendance.findOneAndUpdate(
      { userId, date: today, 'break.isOnBreak': true },
      {
        $set: {
          'break.endTime': endTime,
          'break.isOnBreak': false,
          'break.durationMinutes': currentTotalMinutes,
          'break.exceededPolicy': exceededPolicy
        }
      },
      { new: true }
    );

    // After ending break, recalculate totalBreakTime for compatibility with existing system
    // Also recalculate totalWorkingHours if checked out
    if (updatedAttendance) {
      updatedAttendance.totalBreakTime = updatedAttendance.break.durationMinutes;
      if (updatedAttendance.checkIn && updatedAttendance.checkOut) {
        const totalMin = Math.floor((new Date(updatedAttendance.checkOut) - new Date(updatedAttendance.checkIn)) / 60000);
        updatedAttendance.totalWorkingHours = totalMin - updatedAttendance.totalBreakTime;
      }
      await updatedAttendance.save();
    }

    res.status(200).json({
      success: true,
      data: updatedAttendance,
      message: 'Break ended successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current break status for student/employee
 * @route   GET /api/attendance/break/status
 * @access  Private (Employee)
 */
const getBreakStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();
    const settings = await Settings.getSettings();
    const policyDurationMinutes = settings.breakDurationMinutes || 60;

    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        data: {
          hasCheckedIn: false,
          isOnBreak: false,
          breakTaken: false,
          policyDurationMinutes
        }
      });
    }

    const breakData = attendance.break || {};
    const actualDuration = breakData.durationMinutes || 0;

    // Calculate net working minutes (Bug 1 Backend Fix)
    let netWorkingMinutes = 0;
    if (attendance.checkIn) {
      const totalElapsed = Math.floor((new Date() - new Date(attendance.checkIn)) / 60000);
      const currentBreakElapsed = breakData.isOnBreak 
        ? Math.floor((new Date() - new Date(breakData.startTime)) / 60000)
        : 0;
      netWorkingMinutes = totalElapsed - (actualDuration + currentBreakElapsed);
    }

    res.status(200).json({
      success: true,
      data: {
        hasCheckedIn: !!attendance.checkIn,
        isOnBreak: !!breakData.isOnBreak,
        breakTaken: !!breakData.startTime && !breakData.isOnBreak,
        breakStartTime: breakData.startTime || null,
        breakEndTime: breakData.endTime || null,
        breakDurationMinutes: actualDuration,
        policyDurationMinutes,
        exceededPolicy: !!breakData.exceededPolicy,
        remainingBreakMinutes: Math.max(0, policyDurationMinutes - actualDuration),
        netWorkingMinutes: Math.max(0, netWorkingMinutes)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get break history for all employees (Admin)
 * @route   GET /api/admin/breaks
 * @access  Private/Admin
 */
const getBreakHistory = async (req, res, next) => {
  try {
    const { date, employeeId, exceededOnly, page = 1, limit = 10 } = req.query;
    const query = { 'break.startTime': { $ne: null } };

    if (date) query.date = date;
    if (employeeId) query.userId = employeeId;
    if (exceededOnly === 'true') query['break.exceededPolicy'] = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const records = await Attendance.find(query)
      .populate('userId', 'name employeeId department avatar')
      .sort({ date: -1, 'break.startTime': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        breaks: records,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update break policy (Admin)
 * @route   PUT /api/admin/policy/break
 * @access  Private/Admin
 */
const updateBreakPolicy = async (req, res, next) => {
  try {
    const { breakDurationMinutes } = req.body;

    if (!breakDurationMinutes || breakDurationMinutes < 15 || breakDurationMinutes > 120) {
      return res.status(400).json({
        success: false,
        message: 'Break duration must be between 15 and 120 minutes',
      });
    }

    const settings = await Settings.getSettings();
    settings.breakDurationMinutes = breakDurationMinutes;
    settings.updatedBy = req.user._id;
    await settings.save();

    res.status(200).json({
      success: true,
      data: settings,
      message: 'Break policy updated successfully. Note: Changes apply to new breaks only.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startBreak,
  endBreak,
  getBreakStatus,
  getBreakHistory,
  updateBreakPolicy
};
