const { validationResult, body, query } = require('express-validator');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const {
  getTodayDate,
  formatDate,
  getMonthRange,
  calculateStats,
} = require('../utils/attendanceHelpers');
const { sendEmail } = require('../utils/emailService');
const { lateArrivalTemplate } = require('../utils/emailTemplates');
const { emitToAdmins } = require('../socket/socketManager.js');

/**
 * @desc    Check-in for the day
 * @route   POST /api/attendance/checkin
 * @access  Private
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();
    const now = new Date();

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

    // Clean up any stale shell document (no checkIn) that could block the upsert
    // This fixes E11000 when partial records were previously written to the DB
    if (existing && !existing.checkIn) {
      await Attendance.deleteOne({ _id: existing._id });
    }

    // 🛠️ Timezone-Aware Calculation (Fixed for IST/Local)
    // Convert current time to local HH:MM for comparison
    const currentTimeStr = now.toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Kolkata', 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Convert both to total minutes from midnight for direct comparison
    const [currH, currM] = currentTimeStr.split(':').map(Number);
    const [startH, startM] = (settings?.officeStartTime || '09:15').split(':').map(Number);
    const grace = settings?.lateGracePeriod || 0;
    
    const currentTotalMin = currH * 60 + currM;
    const thresholdTotalMin = startH * 60 + startM + grace;
    
    const computedStatus = currentTotalMin > thresholdTotalMin ? 'late' : 'present';

    // Single atomic upsert — no .save() ever called.
    // This completely eliminates the E11000 duplicate key race condition.
    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: today },
      {
        $setOnInsert: { userId, date: today },
        $set: { checkIn: now, status: computedStatus }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

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
              ? `You checked in late (after ${settings.officeStartTime})`
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
          checkInTime: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          officeStartTime: settings?.officeStartTime || '09:15',
          minutesLate
        })
      }).catch(err => console.error('Late Arrival Email failed:', err));
    }
    // --- END EMAIL NOTIFICATION ---

    // Fire-and-forget admin notifications after responding
    const admins = await User.find({ role: 'admin' });
    if (admins.length > 0) {
      const notifications = admins.map(admin => ({
        recipient: admin._id,
        sender: userId,
        type: 'check_in',
        title: attendance.status === 'late' ? 'Late Check-in' : 'New Check-in',
        message: `${req.user.name} checked in at ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} (${attendance.status.toUpperCase()})`,
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
      checkInTime: new Date().toISOString(),
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
    const today = getTodayDate();
    const now = new Date();

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
    // Handle the current ongoing break in the breaks array
    const ongoingBreakIndex = attendance.breaks.findIndex(b => !b.breakEnd);
    if (ongoingBreakIndex !== -1) {
      const autoBreakEnd = new Date();
      const breakStart = attendance.breaks[ongoingBreakIndex].breakStart;
      const duration = Math.floor((autoBreakEnd - new Date(breakStart)) / (1000 * 60));
      
      attendance.breaks[ongoingBreakIndex].breakEnd = autoBreakEnd;
      attendance.breaks[ongoingBreakIndex].duration = duration;
    }
    // --- END AUTO-END BREAK ---

    // Fetch dynamic settings
    const settings = await Settings.getSettings();

    // Update check-out
    attendance.checkOut = now;

    // --- RECALCULATE NET WORKING TIME ---
    const checkInTime = new Date(attendance.checkIn);
    const checkOutTime = now;
    const grossMinutes = Math.floor((checkOutTime - checkInTime) / 60000);
    
    // Total break time is the sum of all completed breaks
    const totalBreakMinutes = attendance.breaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    attendance.totalBreakTime = totalBreakMinutes;
    attendance.totalWorkingHours = Math.max(0, grossMinutes - totalBreakMinutes);
    // --- END RECALCULATE ---
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
          session.endTime = new Date()
          session.duration = Math.floor(
            (session.endTime - session.startTime) / 1000
          )
          await session.save()
          task.totalTime += session.duration
        }
        task.status = "paused"
        await task.save()
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
      checkOutTime: new Date().toISOString(),
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

/**
 * @desc    Start a break
 * @route   POST /api/attendance/break/start
 * @access  Private
 */
const startBreak = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();
    const now = new Date();

    // Find today's attendance record
    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You need to check in first',
        errors: [],
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out',
        errors: [],
      });
    }

    // Check if there's already an ongoing break
    const ongoingBreak = attendance.breaks.find((b) => !b.breakEnd);
    if (ongoingBreak) {
      return res.status(400).json({
        success: false,
        message: 'You already have an ongoing break',
        errors: [],
      });
    }

    // Fetch dynamic settings
    const settings = await Settings.getSettings();

    // Add new break
    attendance.breaks.push({
      breakStart: now,
    });

    // Attach settings for pre-save middleware
    attendance._settings = settings;
    await attendance.save();

    res.status(200).json({
      success: true,
      data: {
        break: attendance.breaks[attendance.breaks.length - 1],
      },
      message: 'Break started',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    End a break
 * @route   POST /api/attendance/break/end
 * @access  Private
 */
const endBreak = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();
    const now = new Date();

    // Find today's attendance record
    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found',
        errors: [],
      });
    }

    // Find ongoing break
    const ongoingBreakIndex = attendance.breaks.findIndex((b) => !b.breakEnd);

    if (ongoingBreakIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'No ongoing break found',
        errors: [],
      });
    }

    // End the break
    const breakStart = attendance.breaks[ongoingBreakIndex].breakStart;
    const duration = Math.floor((now - new Date(breakStart)) / (1000 * 60));

    // Fetch dynamic settings
    const settings = await Settings.getSettings();

    attendance.breaks[ongoingBreakIndex].breakEnd = now;
    attendance.breaks[ongoingBreakIndex].duration = duration;

    // Attach settings for pre-save middleware
    attendance._settings = settings;
    await attendance.save();

    res.status(200).json({
      success: true,
      data: {
        break: attendance.breaks[ongoingBreakIndex],
        totalBreakTime: attendance.totalBreakTime,
      },
      message: 'Break ended',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get today's attendance record
 * @route   GET /api/attendance/today
 * @access  Private
 */
const getTodayAttendance = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = getTodayDate();

    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance) {
      // 🏆 Check if actually on Leave today
      const Leave = require('../models/Leave');
      const onLeave = await Leave.findOne({
        userId,
        status: 'approved',
        startDate: { $lte: today },
        endDate: { $gte: today }
      });

      return res.status(200).json({
        success: true,
        data: {
          attendance: onLeave ? { status: 'on-leave', leaveType: onLeave.leaveType } : null,
          message: onLeave ? `You are on ${onLeave.leaveType} leave today` : 'No attendance record for today',
        },
        message: onLeave ? 'On Leave' : 'No record found',
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
    let startD, endD;

    if (month && year) {
      const { startStr, endStr } = getMonthRange(parseInt(year), parseInt(month));
      query.date = { $gte: startStr, $lte: endStr };
      startD = new Date(startStr);
      endD = new Date(endStr);
    }

    // 1. Get real attendance records
    const attendanceRecords = await Attendance.find(query).sort({ date: 1 });
    let finalAttendance = attendanceRecords.map(a => a.toObject());
    const todayStr = getTodayDate();

    // 2. Inject Approved Leaves (The "Virtual" Records)
    if (startD && endD) {
      const leaves = await Leave.find({
        userId: userId,
        status: 'approved',
        startDate: { $lte: endD },
        endDate: { $gte: startD }
      });

      leaves.forEach(leave => {
        let current = new Date(Math.max(new Date(leave.startDate), startD));
        const leaveEnd = new Date(Math.min(new Date(leave.endDate), endD));

        while (current <= leaveEnd) {
          // 🛠️ Skip Sundays from leave counting (User Rule)
          if (current.getDay() !== 0) {
            const dateStr = current.toISOString().split('T')[0];
            const hasAttendance = finalAttendance.some(a => a.date.startsWith(dateStr));
            
            if (!hasAttendance && dateStr <= todayStr) {
              finalAttendance.push({
                userId,
                date: dateStr,
                status: 'leave',
                leaveType: leave.type,
                isVirtual: true
              });
            }
          }
          current.setDate(current.getDate() + 1);
        }
      });
    }

    // 3. Inject Holidays (The "Public" Records)
    if (startD && endD) {
      const holidays = await Holiday.find({
        date: { $gte: startD, $lte: endD }
      });

      holidays.forEach(holiday => {
        const dateStr = holiday.date.toISOString().split('T')[0];
        const hasAttendanceOrLeave = finalAttendance.some(a => a.date.startsWith(dateStr));
        
        if (!hasAttendanceOrLeave && dateStr <= todayStr) {
          finalAttendance.push({
            userId,
            date: dateStr,
            status: 'holiday',
            title: holiday.title,
            isVirtual: true
          });
        }
      });
    }

    // 4. 🚀 Auto-Inject Sundays as Holidays (New Feature)
    if (startD && endD) {
      let current = new Date(startD);
      while (current <= endD) {
        if (current.getDay() === 0) { // Sunday
          const dateStr = current.toISOString().split('T')[0];
          const hasRecord = finalAttendance.some(a => a.date.startsWith(dateStr));
          
          if (!hasRecord && dateStr <= todayStr) {
            finalAttendance.push({
              userId,
              date: dateStr,
              status: 'holiday',
              title: 'Sunday',
              isVirtual: true
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Sort by date descending for history view
    finalAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

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

    // 🏆 Step 3: Get approved leaves for the target date
    const leaves = await Leave.find({
      status: 'approved',
      userId: { $in: employeeIds },
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate }
    });

    // 🏆 Step 4: Merge everything
    const combined = employees.map(emp => {
      // Find attendance
      const record = attendanceRecords.find(a => a.userId._id.toString() === emp._id.toString());
      
      if (record) {
        return {
          ...record.toObject(),
          userId: emp // Ensure full user object is present
        };
      }

      // Check if on leave
      const leave = leaves.find(l => l.userId.toString() === emp._id.toString());
      if (leave) {
        return {
          userId: emp,
          date: targetDate,
          status: 'leave',
          leaveType: leave.leaveType,
          isVirtual: true,
          breaks: []
        };
      }

      // Otherwise Absent (if not today or if it's today and past start time, etc.)
      // For now, mark as absent if no record and no leave
      return {
        userId: emp,
        date: targetDate,
        status: 'absent',
        isVirtual: true,
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
const getAttendanceReport = async (req, res, next) => {
  try {
    const { from, to, userId, department } = req.query;

    // Build query
    const query = {};

    if (from && to) {
      query.date = { $gte: from, $lte: to };
    } else if (from) {
      query.date = { $gte: from };
    } else if (to) {
      query.date = { $lte: to };
    }

    if (userId) {
      query.userId = userId;
    }

    // If department filter is applied, get users from that department first
    if (department && !userId) {
      const usersInDept = await User.find({ department }).select('_id');
      const userIds = usersInDept.map((u) => u._id);
      query.userId = { $in: userIds };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .populate('userId', 'name email employeeId department designation');

    // 🏆 Step 2: Fetch corresponding Leaves to fill in the gaps
    const leaveQuery = { status: 'approved' };
    if (from && to) {
      leaveQuery.$or = [
        { startDate: { $lte: to }, endDate: { $gte: from } }
      ];
    }
    if (userId) leaveQuery.userId = userId;
    else if (department) {
      const usersInDept = await User.find({ department }).select('_id');
      const userIds = usersInDept.map((u) => u._id);
      leaveQuery.userId = { $in: userIds };
    }

    const leaves = await Leave.find(leaveQuery).populate('userId', 'name email employeeId department designation');

    // Combine them: For each day of leave, if no attendance exists, add a virtual record
    const combinedRecords = [...attendance];

    // We only create leave records if they don't already have an attendance record for that specific date
    leaves.forEach(leave => {
      let curr = new Date(Math.max(new Date(leave.startDate), new Date(from || leave.startDate)));
      const last = new Date(Math.min(new Date(leave.endDate), new Date(to || leave.endDate)));

      while (curr <= last) {
        const dateStr = curr.toISOString().split('T')[0];
        const hasAttendance = attendance.find(a =>
          a.date === dateStr && a.userId._id.toString() === leave.userId._id.toString()
        );

        if (!hasAttendance) {
          combinedRecords.push({
            userId: leave.userId,
            date: dateStr,
            status: 'leave',
            isVirtual: true, // Internal flag
            totalWorkingHours: 0,
            totalBreakTime: 0
          });
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    // Re-sort combined list
    combinedRecords.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate statistics
    const stats = calculateStats(combinedRecords);

    res.status(200).json({
      success: true,
      data: {
        attendance: combinedRecords,
        stats,
        filters: { from, to, userId, department },
      },
      message: 'Attendance report generated with leave integration',
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
    const nowIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    const settings = await Settings.getSettings();
    const todayDay = nowIST.getUTCDay(); // 0=Sun,1=Mon...6=Sat in IST
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
  startBreak,
  endBreak,
  getTodayAttendance,
  getAttendanceHistory,
  getAllAttendance,
  getAttendanceReport,
  getTodayStats,
  checkInValidation,
  checkOutValidation,
  historyValidation,
  reportValidation,
};
