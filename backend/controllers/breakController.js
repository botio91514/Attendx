const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getTodayDate } = require('../utils/attendanceHelpers');
const breakService = require('../services/breakService');


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
    
    // 2. Use Service for Atomic Start
    try {
      await breakService.startBreak(attendance, breakStartTime);
      await attendance.save();
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
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
    const settings = await Settings.getSettings();
    const policyLimit = settings.breakDurationMinutes || 60;

    // Use Service for Atomic End
    try {
      await breakService.endBreak(attendance, endTime, policyLimit);
      await attendance.save();
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }


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
    const actualDuration = attendance.getBreakMinutes();

    // Calculate net working minutes
    let netWorkingMinutes = 0;
    if (attendance.checkIn) {
      const { toIST } = require('../utils/timeUtils');
      const nowIST = toIST(new Date());
      const checkInIST = new Date(attendance.checkIn);
      const totalElapsed = Math.floor((nowIST - checkInIST) / 60000);
      
      const currentBreak = (attendance.breaks || []).find(b => !b.breakEnd);
      const currentBreakElapsed = currentBreak
        ? Math.floor((nowIST - new Date(currentBreak.breakStart)) / 60000)
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
    const { from, to, employeeId, search, exceededOnly, page = 1, limit = 10 } = req.query;
    const settings = await Settings.getSettings();
    const policyLimit = settings.breakDurationMinutes || 60;

    // Build Query - STICK TO ATTENDANCE DOCUMENTS AS PRIMARY
    const query = { totalBreakTime: { $gt: 0 } }; 

    if (from && to) {
      query.date = { $gte: from, $lte: to };
    } else if (from) {
      query.date = from;
    }

    if (employeeId) {
      query.userId = employeeId;
    } else if (search) {
      // Find users matching search string
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.userId = { $in: users.map(u => u._id) };
    }
    
    if (exceededOnly === 'true') {
        query.totalBreakTime = { $gt: policyLimit };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch Attendance records (One row per employee per day)
    const records = await Attendance.find(query)
      .populate('userId', 'name employeeId department avatar')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Attendance.countDocuments(query);

    // Transform to Attendance-Centric aggregated view
    const aggregatedBreaks = records.map(record => {
      const totalDuration = record.totalBreakTime || 0;
      const breaks = record.breaks || [];
      const completedBreaks = breaks.filter(b => b.breakEnd);
      
      const longestBreak = completedBreaks.length > 0 
        ? Math.max(...completedBreaks.map(b => b.duration || 0))
        : 0;

      // Status Mapping (Rule 9: POLICY=green, WARNING=orange, VIOLATION=red)
      let status = 'POLICY';
      if (totalDuration > policyLimit + 15) {
        status = 'VIOLATION';
      } else if (totalDuration > policyLimit) {
        status = 'WARNING';
      }

      return {
        _id: record._id,
        employee: record.userId,
        date: record.date,
        totalDuration,
        sessionCount: breaks.length,
        longestBreak,
        status,
        policyLimit
      };
    });

    // 4. Calculate Stats for the filtered range (Unpaginated)
    const statsRecords = await Attendance.find(query).select('totalBreakTime userId').populate('userId', 'name');
    
    let totalDurationMinutes = 0;
    let violationCount = 0;
    const userTotals = {};
    
    statsRecords.forEach(rec => {
      totalDurationMinutes += (rec.totalBreakTime || 0);
      if (rec.totalBreakTime > policyLimit + 15) {
        violationCount++;
      }
      if (rec.userId) {
        const uId = rec.userId._id.toString();
        if (!userTotals[uId]) {
          userTotals[uId] = { name: rec.userId.name, total: 0 };
        }
        userTotals[uId].total += (rec.totalBreakTime || 0);
      }
    });

    const topUsers = Object.values(userTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        breaks: aggregatedBreaks,
        policyLimit,
        stats: {
          totalBreaks: totalCount,
          totalDurationMinutes,
          averageBreakMinutes: totalCount > 0 ? Math.round(totalDurationMinutes / totalCount) : 0,
          violationCount,
          topUsers,
          policyLimit
        },
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalCount / parseInt(limit))
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
