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
    
    const { getISTDateString, toIST } = require('../utils/timeUtils');
    const today = getISTDateString();

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

    const breakStartTime = toIST(new Date());
    
    // 2. Atomic update to start a new break in the breaks array
    const attendance = await Attendance.findOneAndUpdate(
      { 
        userId, 
        date: today, 
        'breaks.breakEnd': { $ne: null }, // Ensure no ongoing break
        'break.isOnBreak': { $ne: true }  // Compatibility check
      },
      {
        $push: {
          breaks: {
            breakStart: breakStartTime,
            breakEnd: null,
            duration: 0
          }
        },
        $set: {
          'break.isOnBreak': true, // Keep flag for UI status checks
          'break.startTime': breakStartTime, // SYNC for BreakMonitor
          'break.alertSent': false,
          'break.exceededPolicy': false
        }
      },
      { new: true }
    );

    if (!attendance) {
      // Check if they are actually already on break to give a better message
      const checkCurrent = await Attendance.findOne({ userId, date: today });
      if (checkCurrent && checkCurrent.breaks.some(b => !b.breakEnd)) {
        return res.status(400).json({ success: false, message: 'You already have an ongoing break' });
      }
      return res.status(400).json({ success: false, message: 'Could not start break.' });
    }

    res.status(200).json({
      success: true,
      data: attendance,
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
    const { toIST, getISTDateString } = require('../utils/timeUtils');
    const today = getISTDateString();

    const attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance) {
      return res.status(400).json({ success: false, message: 'No attendance record found' });
    }

    // Find the ongoing break (where breakEnd is null)
    const ongoingBreakIndex = attendance.breaks.findIndex(b => !b.breakEnd);

    if (ongoingBreakIndex === -1) {
      // Clean up flag if out of sync
      if (attendance.break.isOnBreak) {
        attendance.break.isOnBreak = false;
        await attendance.save();
      }
      return res.status(400).json({ success: false, message: 'No ongoing break found' });
    }

    const endTime = toIST(new Date());
    const startTime = new Date(attendance.breaks[ongoingBreakIndex].breakStart);
    const duration = Math.max(0, Math.floor((endTime - startTime) / 60000));

    // Update the specific break in the array
    attendance.breaks[ongoingBreakIndex].breakEnd = endTime;
    attendance.breaks[ongoingBreakIndex].duration = duration;
    
    // Update legacy flag and total stats
    attendance.break.isOnBreak = false;
    attendance.break.endTime = endTime;
    
    // Total break time is the sum of all completed breaks
    const totalBreakMinutes = attendance.breaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    attendance.totalBreakTime = totalBreakMinutes;
    attendance.break.durationMinutes = totalBreakMinutes;

    // Recalculate working hours if checked out
    if (attendance.checkIn && attendance.checkOut) {
      const checkOut = new Date(attendance.checkOut);
      const checkIn = new Date(attendance.checkIn);
      const grossMinutes = Math.floor((checkOut - checkIn) / 60000);
      attendance.totalWorkingHours = Math.max(0, grossMinutes - totalBreakMinutes);
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      data: attendance,
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
      const { toIST } = require('../utils/timeUtils');
      const nowIST = toIST(new Date());
      const checkInIST = new Date(attendance.checkIn);
      const totalElapsed = Math.floor((nowIST - checkInIST) / 60000);
      const currentBreakElapsed = breakData.isOnBreak 
        ? Math.floor((nowIST - new Date(breakData.startTime)) / 60000)
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
        exceededPolicy: actualDuration > policyDurationMinutes, // DYNAMIC CHECK
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
    const settings = await Settings.getSettings();
    const policyLimit = settings.breakDurationMinutes || 60;

    const query = { 'break.startTime': { $ne: null } };

    if (date) query.date = date;
    if (employeeId) query.userId = employeeId;
    if (exceededOnly === 'true') query['break.durationMinutes'] = { $gt: policyLimit };

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
        policyLimit,
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

module.exports = {
  startBreak,
  endBreak,
  getBreakStatus,
  getBreakHistory
};
