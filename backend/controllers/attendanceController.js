const { validationResult, body, query } = require('express-validator');
const Attendance = require('../models/Attendance');
const breakService = require('../services/breakService');

const User = require('../models/User');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const Task = require('../models/Task');
const {
  getTodayDate,
  formatDate,
  getMonthRange,
  calculateStats,
} = require('../utils/attendanceHelpers');
const { sendEmail } = require('../utils/emailService');
const { lateArrivalTemplate } = require('../utils/emailTemplates');
const { emitToAdmins } = require('../socket/socketManager.js');
const { 
  getISTDateString, 
  getISTMinutesFromMidnight, 
  formatISTTime,
  getCurrentISTTime,
  toIST
} = require('../utils/timeUtils');

/**
 * @desc    Check-in for the day
 * @route   POST /api/attendance/checkin
 * @access  Private
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getISTDateString();
    const now = getCurrentISTTime();

    // Fetch dynamic settings
    const settings = await Settings.getSettings();

    // Guard: reject if already checked in today
    const existing = await Attendance.findOne({ userId, date: today });
    
    // Check if user is an admin - skip attendance for admins
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrators do not need to record daily attendance',
        errors: [],
      });
    }

    if (existing && existing.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today',
        errors: [],
      });
    }

    if (existing && !existing.checkIn) {
      await Attendance.deleteOne({ _id: existing._id });
    }

    // 🛠️ Timezone-Aware Calculation using centralized utility
    const currentTotalMin = getISTMinutesFromMidnight(now);
    
    const [startH, startM] = (settings?.officeStartTime || '09:15').split(':').map(Number);
    const grace = Number(settings?.lateGracePeriod || 0);
    
    const thresholdTotalMin = (startH * 60) + startM + grace;
    
    const computedStatus = currentTotalMin > thresholdTotalMin ? 'late' : 'present';

    // 🛡️ SYNC RULE: Check if a full-day leave already exists in leaveMeta
    let statusToSet = computedStatus;
    if (existing && existing.leaveMeta) {
      const totalLeave = (existing.leaveMeta.cl || 0) + (existing.leaveMeta.sl || 0) + (existing.leaveMeta.rl || 0) + (existing.leaveMeta.lwp || 0);
      if (totalLeave >= 1.0) statusToSet = 'leave';
    }

    let attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance) {
      attendance = new Attendance({ userId, date: today, checkIn: now });
    } else {
      // If record exists (e.g. absent record created by cron), update it
      attendance.checkIn = now;
    }
    attendance._settings = settings;
    await attendance.save();

    // Format the threshold time for the message (IST display)
    const thresholdTimeStr = `${String(startH).padStart(2, '0')}:${String(startM + grace).padStart(2, '0')} AM`;

    res.status(200).json({
      success: true,
      data: {
        attendance: {
          id: attendance._id,
          date: attendance.date,
          checkIn: attendance.checkIn,
          status: attendance.status,
          message:
            attendance.status === 'late'
              ? `You checked in late (Threshold was ${thresholdTimeStr})`
              : 'Check-in successful',
        },
      },
      message: 'Check-in recorded successfully',
    });

    // --- EMAIL NOTIFICATION (ADDED) ---
    // Notify Employee about late arrival
    if (attendance.status === 'late' && req.user.email) {
      const minutesLate = currentTotalMin - (startH * 60 + startM);
      sendEmail({
        to: req.user.email,
        subject: '⏰ Attendance Alert: Late Arrival Logged',
        html: lateArrivalTemplate({
          employeeName: req.user.name,
          checkInTime: formatISTTime(now),
          officeStartTime: settings?.officeStartTime || '09:15',
          minutesLate
        })
      }).catch(err => console.error('Late Arrival Email failed:', err));
    }
    // --- END EMAIL NOTIFICATION ---

    const formattedTime = getCurrentISTTime();

    // Fire-and-forget admin notifications after responding
    const admins = await User.find({ role: 'admin' });
    if (admins.length > 0) {
      const notifications = admins.map(admin => ({
        recipient: admin._id,
        sender: userId,
        type: 'check_in',
        title: attendance.status === 'late' ? 'Late Check-in' : 'New Check-in',
        message: `${req.user.name} checked in at ${formatISTTime(now)} (${attendance.status.toUpperCase()})`,
        link: '/admin/live',
        targetRole: 'admin'
      }));
      await Notification.insertMany(notifications);
    }

    // --- SOCKET EMIT (ADDED) ---
    emitToAdmins('attendance:checkin', {
      userId: req.user.id || req.user._id,
      employeeName: req.user.name,
      employeeId: req.user.employeeId,
      checkInTime: formatISTTime(now),
      status: computedStatus === 'late' ? 'late' : 'present',
      department: req.user.department
    });

    emitToAdmins('attendance:liveUpdate', {
      action: 'checkin',
      userId: req.user.id || req.user._id,
      employeeName: req.user.name,
      status: computedStatus === 'late' ? 'late' : 'present'
    });
    // --- END SOCKET EMIT ---
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check-out for the day
 * @route   POST /api/attendance/checkout
 * @access  Private
 */
const checkOut = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getISTDateString();
    const now = getCurrentISTTime();

    // Find today's attendance record
    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today',
        errors: [],
      });
    }

    if (!attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You need to check in first',
        errors: [],
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today',
        errors: [],
      });
    }

    // --- AUTO-END BREAK ON CHECKOUT (UNIFIED FIX) ---
    try {
      await breakService.endBreak(attendance, now);
    } catch (e) {
      // Ignore if no break found
    }
    // --- END AUTO-END BREAK ---


    // Fetch dynamic settings
    const settings = await Settings.getSettings();

    // Update check-out
    attendance.checkOut = now;

    // Attach settings for pre-save middleware
    attendance._settings = settings;
    await attendance.save();


    // ── Auto-pause running tasks on checkout ──────────────
    try {
      const Task = require("../models/Task")
      const WorkSession = require("../models/WorkSession")

      const activeTasks = await Task.find({
        assignedTo: req.user._id,
        status: "in-progress"
      })

      for (const task of activeTasks) {
        const session = await WorkSession.findOne({
          taskId: task._id,
          endTime: null
        })
        if (session) {
          session.endTime = getCurrentISTTime();
          session.duration = Math.floor(
            (session.endTime - session.startTime) / 1000
          )
          await session.save()
          
          // Use findByIdAndUpdate to bypass validation for older tasks (e.g. missing createdBy)
          await Task.findByIdAndUpdate(task._id, {
            $inc: { totalTime: session.duration },
            $set: { status: "paused" }
          })
        } else {
          // If no session found but task is in-progress, just set status to paused
          await Task.findByIdAndUpdate(task._id, { $set: { status: "paused" } })
        }
      }
    } catch (taskErr) {
      console.error("Task auto-pause error on checkout:", taskErr)
      // Do NOT block checkout if task pause fails
    }
    // ─────────────────────────────────────────────────────

    res.status(200).json({
      success: true,
      data: {
        attendance: {
          id: attendance._id,
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          totalWorkingHours: attendance.totalWorkingHours,
          totalBreakTime: attendance.totalBreakTime,
          status: attendance.status,
        },
      },
      message: 'Check-out recorded successfully',
    });

    // --- SOCKET EMIT (ADDED) ---
    emitToAdmins('attendance:checkout', {
      userId: req.user.id || req.user._id,
      employeeName: req.user.name,
      checkOutTime: formatISTTime(now),
      netWorkingMinutes: attendance.totalWorkingHours
    });

    emitToAdmins('attendance:liveUpdate', {
      action: 'checkout',
      userId: req.user.id || req.user._id,
      employeeName: req.user.name
    });
    // --- END SOCKET EMIT ---
  } catch (error) {
    next(error);
  }
};

// Unused startBreak and endBreak logic removed.
// Logic is now centralized in breakController and breakService.


/**
 * @desc    Get today's attendance record
 * @route   GET /api/attendance/today
 * @access  Private
 */
const getTodayAttendance = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();

    // 🛡️ Rule: Controller only returns DB data. No virtual holiday/sunday injections.
    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        data: { attendance: null },
        message: 'No attendance record found for today',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        attendance: {
          id: attendance._id,
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          totalWorkingHours: attendance.totalWorkingHours,
          totalBreakTime: attendance.totalBreakTime,
          breaks: attendance.breaks,
          status: attendance.status,
          notes: attendance.notes,
          workFraction: attendance.workFraction,
          leaveMeta: attendance.leaveMeta
        },
      },
      message: 'Today\'s attendance retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get attendance history for logged-in user
 * @route   GET /api/attendance/history
 * @access  Private
 */
const getAttendanceHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { month, year, page = 1, limit = 31 } = req.query;

    const query = { userId };

    if (month && year) {
      const { startStr, endStr } = getMonthRange(parseInt(year), parseInt(month));
      query.date = { $gte: startStr, $lte: endStr };
    }

    // 🛡️ Rule: Controller only returns DB data. No virtual injections.
    // 1. Get real attendance records
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1 });

    const finalAttendance = attendanceRecords.map(a => ({
      ...a.toObject(),
      breakdownString: a.getBreakdownString()
    }));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedAttendance = finalAttendance.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        attendance: paginatedAttendance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: finalAttendance.length,
          pages: Math.ceil(finalAttendance.length / parseInt(limit)),
        },
      },
      message: 'Attendance history retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all attendance records (Admin only)
 * @route   GET /api/attendance/admin/all
 * @access  Private/Admin
 */
const getAllAttendance = async (req, res, next) => {
  try {
    const { date, department, page = 1, limit = 50 } = req.query;
    const targetDate = date || getTodayDate();

    // 🏆 Step 1: Get active employees (filtered by department if needed)
    const userQuery = { role: 'employee', isActive: true };
    if (department && department !== 'All') {
      userQuery.department = department;
    }

    const employees = await User.find(userQuery).select('name email employeeId department designation role avatar');
    const employeeIds = employees.map(e => e._id);

    // 🏆 Step 2: Get attendance for the target date
    const attendanceRecords = await Attendance.find({
      date: targetDate,
      userId: { $in: employeeIds }
    }).populate('userId', 'name email employeeId department designation');

    // 🏆 Step 3: Get leaves for the target date
    // Use full-day boundaries to avoid timezone/boundary misses
    const startOfTarget = new Date(targetDate);
    const endOfTarget = new Date(targetDate);
    endOfTarget.setHours(23, 59, 59, 999);

    const leaves = await Leave.find({
      userId: { $in: employeeIds },
      startDate: { $lte: endOfTarget },
      endDate: { $gte: startOfTarget }
    });
    
    // 🏆 Step 4: Get Current Active Tasks for Live Monitoring
    const activeTasks = await Task.find({
      assignedTo: { $in: employeeIds },
      status: 'in-progress'
    }).populate('createdBy', 'name');

    // 🏆 Step 5: Merge everything
    const combined = employees.map(emp => {
      const activeTask = activeTasks.find(t => t.assignedTo.toString() === emp._id.toString());
      const record = attendanceRecords.find(a => a.userId._id.toString() === emp._id.toString());
      const empLeaves = leaves.filter(l => l.userId.toString() === emp._id.toString());
      const pendingLeave = empLeaves.find(l => l.status === 'pending');
      const approvedLeave = empLeaves.find(l => l.status === 'approved');
      
      if (record) {
        const recordObj = record.toObject();
        return {
          ...recordObj,
          userId: emp,
          activeTask,
          pendingLeave: !!pendingLeave,
          breakdownString: record.getBreakdownString()
        };
      }

      if (approvedLeave) {
        return {
          userId: emp,
          date: targetDate,
          status: 'leave',
          leaveType: approvedLeave.leaveType,
          breakdownString: `1.0 ${String(approvedLeave.leaveType).toUpperCase()}`,
          isVirtual: true,
          pendingLeave: !!pendingLeave,
          breaks: []
        };
      }

      // Default: Absent (with pending leave alert if exists)
      return {
        userId: emp,
        date: targetDate,
        status: 'absent',
        isVirtual: true,
        pendingLeave: !!pendingLeave,
        breaks: []
      };
    });

    // Sort: Late first, then Present, then Leave, then Absent
    const statusOrder = { late: 0, present: 1, leave: 2, absent: 3 };
    combined.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginated = combined.slice(skip, skip + limitNum);

    res.status(200).json({
      success: true,
      data: {
        attendance: paginated,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: combined.length,
          pages: Math.ceil(combined.length / limitNum),
        },
      },
      message: 'Comprehensive attendance records retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get attendance report (Admin only)
 * @route   GET /api/attendance/admin/report
 * @access  Private/Admin
 */
/**
 * Helper to generate comprehensive attendance data for a range and set of employees
 * Used by both reporting and exporting
 */
const processComprehensiveAttendance = async (from, to, employees, settings) => {
  const startD = new Date(from);
  const endD = new Date(to);
  const todayStr = getISTDateString();
  const employeeIds = employees.map(e => e._id);

  // Fetch all raw data for the range
  const attendanceRecords = await Attendance.find({
    date: { $gte: from, $lte: to },
    userId: { $in: employeeIds }
  }).lean();

  const leaves = await Leave.find({
    status: 'approved',
    userId: { $in: employeeIds },
    startDate: { $lte: to },
    endDate: { $gte: from }
  }).lean();

  const holidays = await Holiday.find({
    date: { $gte: startD, $lte: endD }
  }).lean();

  const combinedRecords = [];
  
  for (const emp of employees) {
    let current = new Date(startD);
    while (current <= endD) {
      const dateStr = getISTDateString(current);
      if (dateStr > todayStr) {
        current.setDate(current.getDate() + 1);
        continue; // Don't report future dates
      }

      const empIdStr = emp._id.toString();
      
      // Find existing attendance
      const attendance = attendanceRecords.find(a => 
        a.date === dateStr && a.userId.toString() === empIdStr
      );

      if (attendance) {
        // Calculate breakdown for existing records (since lean() is used)
        const meta = attendance.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
        const work = attendance.workFraction || 0;
        const comps = [];
        if (work > 0 && work < 1.0) comps.push(`${work} Work`);
        if (meta.cl > 0) comps.push(`${meta.cl} CL`);
        if (meta.sl > 0) comps.push(`${meta.sl} SL`);
        if (meta.rl > 0) comps.push(`${meta.rl} RL`);
        if (meta.lwp > 0) comps.push(`${meta.lwp} LWP`);
        
        combinedRecords.push({
          ...attendance,
          userId: emp,
          breakdownString: comps.length > 0 ? comps.join(' + ') : ''
        });
      } else {
        // Check for Leave
        const leave = leaves.find(l => 
          l.userId.toString() === empIdStr &&
          dateStr >= l.startDate && dateStr <= l.endDate
        );

        if (leave) {
          combinedRecords.push({
            userId: emp,
            date: dateStr,
            status: 'leave',
            leaveType: leave.leaveType,
            breakdownString: `1.0 ${String(leave.leaveType).toUpperCase()}`,
            isVirtual: true,
            totalWorkingHours: 0,
            totalBreakTime: 0
          });
        } else {
          // Check for Holiday
          const holiday = holidays.find(h => getISTDateString(h.date) === dateStr);
          const isSunday = current.getDay() === 0;
          const isWorkingDay = settings.workingDays.includes(current.getDay());

          if (holiday) {
            combinedRecords.push({
              userId: emp,
              date: dateStr,
              status: 'holiday',
              title: holiday.title,
              isVirtual: true,
              totalWorkingHours: 0,
              totalBreakTime: 0
            });
          } else if (!isWorkingDay || isSunday) {
            combinedRecords.push({
              userId: emp,
              date: dateStr,
              status: 'holiday',
              title: isSunday ? 'Sunday' : 'Weekly Off',
              isVirtual: true,
              totalWorkingHours: 0,
              totalBreakTime: 0
            });
          } else {
            // Mark as Absent
            combinedRecords.push({
              userId: emp,
              date: dateStr,
              status: 'absent',
              isVirtual: true,
              totalWorkingHours: 0,
              totalBreakTime: 0
            });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // Sort by date descending
  combinedRecords.sort((a, b) => b.date.localeCompare(a.date) || a.userId.name.localeCompare(b.userId.name));
  
  return combinedRecords;
};

const getAttendanceReport = async (req, res, next) => {
  try {
    const { from, to, userId, department } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'From and To dates are required for report generation',
      });
    }

    const settings = await Settings.getSettings();

    // 1. Get relevant employees
    const userQuery = { role: 'employee', isActive: true };
    if (userId) {
      userQuery._id = userId;
    } else if (department && department !== 'All') {
      userQuery.department = department;
    }
    const employees = await User.find(userQuery).select('name email employeeId department designation');

    const combinedRecords = await processComprehensiveAttendance(from, to, employees, settings);

    // Calculate statistics
    const stats = calculateStats(combinedRecords);

    res.status(200).json({
      success: true,
      data: {
        attendance: combinedRecords,
        stats,
        filters: { from, to, userId, department },
      },
      message: 'Attendance report generated with full coverage (absent/holidays included)',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get today's attendance stats (Admin only)
 * @route   GET /api/attendance/admin/stats
 * @access  Private/Admin
 */
/**
 * @desc    Get detailed break report (Admin only)
 * @route   GET /api/attendance/admin/breaks
 * @access  Private/Admin
 */
const getBreakReport = async (req, res, next) => {
  try {
    const { startDate, endDate, department, userId, search, page = 1, limit = 100 } = req.query;
    
    // Fetch dynamic policy limit from settings
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne();
    const currentOfficePolicyLimit = settings?.breakDurationMinutes || 30;
    
    // Default to last 7 days if no range provided
    const end = endDate || getISTDateString();
    let start = startDate;
    if (!start) {
      const d = new Date(toIST(new Date()));
      d.setUTCDate(d.getUTCDate() - 7);
      start = getISTDateString(d);
    }

    // 1. Build Query: Records with either the new array OR the old break object
    const query = {
      date: { $gte: start, $lte: end },
      $or: [
        { 'breaks.0': { $exists: true } },
        { 'break.startTime': { $ne: null } }
      ]
    };

    if (userId) query.userId = userId;

    // 2. Filter employees by department or search term
    let targetUserIds = null;
    if ((department && department !== 'All') || search) {
      const userQuery = { role: 'employee' };
      if (department && department !== 'All') userQuery.department = department;
      if (search) userQuery.name = { $regex: search, $options: 'i' };
      
      const users = await User.find(userQuery).select('_id');
      targetUserIds = users.map(u => u._id);
      
      if (userId) {
        if (!targetUserIds.some(id => id.toString() === userId)) {
          return res.status(200).json({ success: true, data: { breaks: [], stats: {} } });
        }
      } else {
        query.userId = { $in: targetUserIds };
      }
    }

    // 3. Fetch Records
    const attendanceRecords = await Attendance.find(query)
      .populate('userId', 'name employeeId department designation')
      .sort({ date: -1 });

    // 4. Flatten and Format Breaks
    const flattenedBreaks = [];
    let totalMinutes = 0;
    const userStats = {};

    attendanceRecords.forEach(record => {
      // 🛡️ Safety: If user is missing, show as Unknown but preserve the data
      const emp = record.userId || { 
        name: 'System Record', 
        employeeId: 'N/A', 
        department: 'Unknown',
        _id: record.userId // Keep the ID for grouping
      };

      const processBreak = (startTime, endTime, rawDuration, sourceId) => {
        // 🛡️ Safety Valve: Clamp absurd durations (e.g., 7-day breaks) to policy limit
        let duration = rawDuration || 0;
        if (duration > 1440) { // More than 24 hours
           duration = currentOfficePolicyLimit; 
        }
        
        totalMinutes += duration;

        const userIdStr = emp._id ? emp._id.toString() : 'unknown';
        if (!userStats[userIdStr]) {
          userStats[userIdStr] = { name: emp.name, total: 0, count: 0 };
        }
        userStats[userIdStr].total += duration;
        userStats[userIdStr].count += 1;

        flattenedBreaks.push({
          id: sourceId,
          date: record.date,
          employeeName: emp.name,
          employeeId: emp.employeeId,
          department: emp.department,
          startTime: startTime,
          endTime: endTime,
          duration: duration,
          status: endTime ? 'completed' : 'ongoing'
        });
      };

      // 🛡️ Merge Logic: New Array + Legacy Fallback
      if (record.breaks && record.breaks.length > 0) {
        record.breaks.forEach(br => {
          processBreak(br.breakStart, br.breakEnd, br.duration, br._id);
        });
      }
      
      if (record.break && record.break.startTime) {
        const isDuplicate = record.breaks?.some(br => 
          new Date(br.breakStart).getTime() === new Date(record.break.startTime).getTime()
        );
        
        if (!isDuplicate) {
          processBreak(
            record.break.startTime, 
            record.break.endTime, 
            record.break.durationMinutes, 
            `legacy-${record._id}`
          );
        }
      }
    });

    // Sort by date and time (most recent first)
    flattenedBreaks.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.startTime) - new Date(a.startTime);
    });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = flattenedBreaks.slice(skip, skip + parseInt(limit));

    // Summary Stats
    const topBreakUsers = Object.values(userStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        breaks: paginated,
        stats: {
          totalBreaks: flattenedBreaks.length,
          totalDurationMinutes: totalMinutes,
          averageBreakMinutes: flattenedBreaks.length > 0 ? Math.round(totalMinutes / flattenedBreaks.length) : 0,
          topUsers: topBreakUsers,
          policyLimit: currentOfficePolicyLimit
        },
        pagination: {
          total: flattenedBreaks.length,
          page: parseInt(page),
          pages: Math.ceil(flattenedBreaks.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getTodayStats = async (req, res, next) => {
  try {
    const today = getTodayDate();
    // 🏆 Get today's leaves
    const Leave = require('../models/Leave');
    const onLeaveCount = await Leave.countDocuments({
      status: 'approved',
      startDate: { $lte: today },
      endDate: { $gte: today }
    });

    // Get only 'employee' role users (ignore admins)
    const employees = await User.find({ role: 'employee', isActive: true }).select('_id');
    const totalEmployees = employees.length;
    const employeeIds = employees.map(emp => emp._id);

    // Get today's attendance records for these employees only
    const todayAttendance = await Attendance.find({
      date: today,
      userId: { $in: employeeIds }
    });


    // Calculate stats
    const stats = {
      totalEmployees,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      onLeave: onLeaveCount,
      notCheckedIn: 0,
      checkedInCount: 0,
    };

    todayAttendance.forEach((record) => {
      stats.checkedInCount++;
      if (record.status === 'present') {
        stats.present++;
      } else if (record.status === 'late') {
        stats.late++;
      } else if (record.status === 'half-day') {
        stats.halfDay++;
      }
    });

    // Calculate not checked in
    stats.notCheckedIn = totalEmployees - stats.checkedInCount;

    // 🛠️ Use IST day-of-week (fixes UTC server returning wrong day)
    const now = toIST(new Date());
    const settings = await Settings.getSettings();
    const todayDay = now.getUTCDay(); // 0=Sun,1=Mon...6=Sat in IST
    const isWorkingDay = settings.workingDays.includes(todayDay);

    // Absent = (Those who didn't check in) - (Those on official leave)
    // Only count as absent if it's a working day
    stats.absent = isWorkingDay ? Math.max(0, stats.notCheckedIn - onLeaveCount) : 0;

    res.status(200).json({
      success: true,
      data: {
        date: today,
        stats,
      },
      message: 'Today\'s attendance stats retrieved',
    });
  } catch (error) {
    next(error);
  }
};


// Validation rules
const checkInValidation = [];

const checkOutValidation = [];

const historyValidation = [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const reportValidation = [
  query('from').optional().isDate().withMessage('From must be a valid date (YYYY-MM-DD)'),
  query('to').optional().isDate().withMessage('To must be a valid date (YYYY-MM-DD)'),
];

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getAllAttendance,
  getAttendanceReport,
  getBreakReport,
  getTodayStats,
  processComprehensiveAttendance,
  checkInValidation,
  checkOutValidation,
  historyValidation,
  reportValidation,
};


