const { validationResult, body, query, param } = require('express-validator');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Holiday = require('../models/Holiday');
const Payroll = require('../models/Payroll');
const { 
  getISTDateString, 
  getCurrentYear,
  toIST,
  getCurrentISTTime
} = require('../utils/timeUtils');
const { logAudit } = require('../utils/auditLogger');
const {
  distributeLeave,
  getDatesBetween
} = require('../utils/leaveHelpers');
const { sendEmail } = require('../utils/emailService');
const { 
  leaveRequestAdminTemplate, 
  leaveApprovedTemplate, 
  leaveRejectedTemplate 
} = require('../utils/emailTemplates');
const { emitToAdmins, emitToUser } = require('../socket/socketManager.js');

/**
 * @desc    Apply for leave (Accrual Engine)
 */
const applyLeave = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array().map(e => e.msg) });

    const { startDate, endDate, reason, isHalfDay } = req.body;
    const userId = req.user._id;

    // 1. Fetch Policies and User Balance
    const [settings, holidays, user] = await Promise.all([
      Settings.getSettings(),
      Holiday.find({ isActive: true }),
      User.findById(userId)
    ]);

    const holidayStrings = holidays.map(h => {
      const d = new Date(h.date);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    });

    const allDates = getDatesBetween(new Date(startDate), new Date(endDate)).filter(dStr => {
      const [y, m, d] = dStr.split('-').map(Number);
      const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
      return !isSunday && !holidayStrings.includes(dStr);
    });

    if (allDates.length === 0) {
      return res.status(400).json({ success: false, message: 'No working days found in selected range (Sundays or Holidays)' });
    }

    // 2. OVERLAP CHECK
    const existingLeaves = await Leave.find({
      userId,
      status: { $in: ['pending', 'approved'] }
    });
    
    const bookedDates = new Set();
    existingLeaves.forEach(lv => {
      (lv.dailyBreakdown || []).forEach(b => bookedDates.add(b.date));
    });

    if (allDates.some(d => bookedDates.has(d))) {
      return res.status(400).json({ success: false, message: 'Overlapping leave exists on these dates.' });
    }

    // 3. LEAVE DISTRIBUTION (Strict Balance Check + Monthly Policy)
    const selectedType = req.body.leaveType || 'casual';
    const typeKeyMap = { casual: 'cl', sick: 'sl', religious: 'rl', unpaid: 'lwp' };
    const internalKey = typeKeyMap[selectedType] || 'lwp';

    // Fetch actual balance dynamically from Attendance
    const Attendance = require('../models/Attendance');
    const { calculateDynamicLeaveBalance } = require('../utils/leaveHelpers');
    const istNow = new Date();
    const dynamicBalance = await calculateDynamicLeaveBalance(user, Attendance, istNow.getFullYear());
    
    const balance = {
      cl: dynamicBalance.cl.available,
      sl: dynamicBalance.sl.available,
      rl: dynamicBalance.rl.available
    };

    // --- MONTHLY CL POLICY ENFORCEMENT ---
    const { getMonthRange } = require('../utils/attendanceHelpers');
    const { startStr, endStr } = getMonthRange(istNow.getFullYear(), istNow.getMonth() + 1);
    const startOfMonth = new Date(startStr);
    const endOfMonth = new Date(endStr);

    const monthlyLeaves = await Leave.find({
      userId,
      status: 'approved',
      startDate: { $lte: endOfMonth },
      endDate: { $gte: startOfMonth }
    });

    let clUsedThisMonth = 0;
    monthlyLeaves.forEach(l => {
      (l.dailyBreakdown || []).forEach(day => {
        const d = new Date(day.date);
        if (d >= startOfMonth && d <= endOfMonth && day.leaveType === 'cl') {
          clUsedThisMonth += (day.days || 1);
        }
      });
    });

    const monthlyCLRemaining = Math.max(0, (settings.clPerMonth || 1) - clUsedThisMonth);
    const breakdown = distributeLeave(allDates, internalKey, balance, isHalfDay, monthlyCLRemaining);

    if (breakdown.sl > 2 && !req.body.attachment) {
      return res.status(400).json({
        success: false,
        message: 'Medical certificate attachment is required for sick leave exceeding 2 days.'
      });
    }

    const yearBreakdown = {};
    breakdown.dailyBreakdown.forEach(day => {
      const year = day.date.slice(0, 4);
      if (!yearBreakdown[year]) yearBreakdown[year] = [];
      yearBreakdown[year].push(day.date);
    });

    const totalDaysValue = isHalfDay ? 0.5 : allDates.length;

    // 4. Create Leave Record
    const leave = await Leave.create({
      userId,
      leaveType: selectedType,
      startDate,
      endDate,
      totalDays: totalDaysValue,
      clDays: breakdown.cl,
      slDays: breakdown.sl,
      rlDays: breakdown.rl,
      lwpDays: breakdown.lwp,
      dailyBreakdown: breakdown.dailyBreakdown,
      yearBreakdown,
      reason,
      attachment: req.body.attachment || null,
      isHalfDay,
      status: 'pending'
    });

    res.status(201).json({ 
      success: true, 
      message: 'Leave request submitted successfully',
      data: { leave, breakdown: { cl: breakdown.cl, sl: breakdown.sl, rl: breakdown.rl, lwp: breakdown.lwp } }
    });

    emitToAdmins('notification:new', {
      type: 'leave_request',
      title: '📋 New Leave Request',
      message: `${req.user.name} applied for ${totalDaysValue} days.`,
      link: '/admin/leaves'
    });
  } catch (error) {
    next(error);
  }
};

const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const leave = await Leave.findById(id).populate('userId');
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: `Request is already ${leave.status}` });

    // 1. Update Status (Atomic check)
    const updatedLeave = await Leave.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { 
        $set: { 
          status: 'approved',
          reviewedBy: adminId,
          reviewedAt: getCurrentISTTime()
        } 
      },
      { new: true }
    );

    if (!updatedLeave) {
      return res.status(400).json({ success: false, message: 'Leave is no longer pending or already processed' });
    }

    // 2. DEDUCT FROM USER BALANCE (With Negative Prevention)
    const user = await User.findById(leave.userId._id);
    const newBalance = {
      cl: Math.max(0, (user.leaveBalance?.cl || 0) - updatedLeave.clDays),
      sl: Math.max(0, (user.leaveBalance?.sl || 0) - updatedLeave.slDays),
      rl: Math.max(0, (user.leaveBalance?.rl || 0) - updatedLeave.rlDays)
    };

    await User.findByIdAndUpdate(leave.userId._id, {
      $set: { leaveBalance: newBalance }
    });

    // 3. SYNC ATTENDANCE
    const Attendance = require('../models/Attendance');
    const settings = await Settings.getSettings();
    const syncResults = [];

    for (const item of updatedLeave.dailyBreakdown) {
      const date = item.date;
      const meta = { cl: 0, sl: 0, rl: 0, lwp: 0 };
      meta[item.leaveType] = item.days || (updatedLeave.isHalfDay ? 0.5 : 1);

      const notes = `Approved Leave: ${updatedLeave.leaveType.toUpperCase()} (ID: ${id})`;
      let record = await Attendance.findOne({ userId: updatedLeave.userId._id, date });
      
      if (record) {
        // Merge with existing leaveMeta if any (rare overlap)
        record.leaveMeta = {
          cl: (record.leaveMeta?.cl || 0) + meta.cl,
          sl: (record.leaveMeta?.sl || 0) + meta.sl,
          rl: (record.leaveMeta?.rl || 0) + meta.rl,
          lwp: (record.leaveMeta?.lwp || 0) + meta.lwp,
        };
        record.notes = notes;
        record._settings = settings;
        await record.save();
      } else {
        record = await Attendance.create({
          userId: updatedLeave.userId._id,
          date,
          leaveMeta: meta,
          notes,
          _settings: settings
        });

      }
      syncResults.push({ date, status: record.status });
    }

    // 4. AUDIT LOG
    await logAudit({
      action: 'LEAVE_APPROVE',
      module: 'leave',
      entityId: updatedLeave._id,
      details: `Approved ${updatedLeave.totalDays}d leave for ${updatedLeave.userId.name}. Breakdown: CL:${updatedLeave.clDays}, SL:${updatedLeave.slDays}, RL:${updatedLeave.rlDays}, LWP:${updatedLeave.lwpDays}`,
      req
    });

    res.status(200).json({ success: true, message: 'Leave request approved and balance deducted' });

    emitToUser(updatedLeave.userId._id.toString(), 'notification:new', {
      type: 'leave_approved',
      title: '✅ Leave Approved',
      message: 'Your leave request has been approved and balance updated.',
      link: '/leaves'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject leave
 */
const rejectLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;
    const adminId = req.user._id;

    const leave = await Leave.findById(id).populate('userId');
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: `Request is already ${leave.status}` });

    leave.status = 'rejected';
    leave.adminComment = adminComment;
    leave.reviewedBy = adminId;
    leave.reviewedAt = getCurrentISTTime();
    await leave.save();

    // --- AUDIT LOG (UPGRADED) ---
    await logAudit({
      action: 'LEAVE_REJECT',
      module: 'leave',
      entityId: leave._id,
      before: { status: 'pending' },
      after: { status: 'rejected', adminComment },
      details: `Rejected ${leave.leaveType} leave for ${leave.userId.name}`,
      req
    });

    res.status(200).json({ success: true, message: 'Leave request rejected' });
  } catch (error) {
    next(error);
  }
};

const getMyLeaves = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const leaves = await Leave.find({ userId }).sort({ appliedAt: -1 });
    res.status(200).json({ success: true, data: { leaves } });
  } catch (error) { next(error); }
};

const getMyBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const Attendance = require('../models/Attendance');
    const { calculateDynamicLeaveBalance } = require('../utils/leaveHelpers');
    const year = getCurrentYear();
    const balanceResult = await calculateDynamicLeaveBalance(user, Attendance, year);

    res.status(200).json({ 
      success: true, 
      data: { 
        balance: {
          cl: balanceResult.cl.available,
          sl: balanceResult.sl.available,
          rl: balanceResult.rl.available
        },
        year 
      } 
    });
  } catch (error) { next(error); }
};

const getEmployeeBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const Attendance = require('../models/Attendance');
    const { calculateDynamicLeaveBalance } = require('../utils/leaveHelpers');
    const year = getCurrentYear();
    const balanceResult = await calculateDynamicLeaveBalance(user, Attendance, year);

    res.status(200).json({ 
      success: true, 
      data: { 
        balance: {
          cl: balanceResult.cl.available,
          sl: balanceResult.sl.available,
          rl: balanceResult.rl.available
        },
        year 
      } 
    });
  } catch (error) { next(error); }
};

const getAllLeaves = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const leaves = await Leave.find(query)
      .populate('userId', 'name email employeeId department leaveBalance')
      .sort({ appliedAt: -1 });

    // Optimization: Get usage summary for these users
    const userIds = [...new Set(leaves.map(l => l.userId?._id).filter(Boolean))];
    const year = getCurrentYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const Attendance = require('../models/Attendance');
    const attendanceRecords = await Attendance.find({
      userId: { $in: userIds },
      date: { $gte: startDate, $lte: endDate }
    });

    const userUsageMap = {};
    userIds.forEach(id => {
      userUsageMap[id.toString()] = { cl: 0, sl: 0, rl: 0, lwp: 0 };
    });

    attendanceRecords.forEach(rec => {
      const uId = rec.userId.toString();
      if (userUsageMap[uId]) {
        const meta = rec.leaveMeta || {};
        userUsageMap[uId].cl += (meta.cl || 0);
        userUsageMap[uId].sl += (meta.sl || 0);
        userUsageMap[uId].rl += (meta.rl || 0);
        userUsageMap[uId].lwp += (meta.lwp || 0);
      }
    });

    const leavesWithUsage = leaves.map(l => {
      const obj = l.toObject();
      if (obj.userId) {
        obj.usageSummary = userUsageMap[obj.userId._id.toString()] || { cl: 0, sl: 0, rl: 0, lwp: 0 };
      }
      return obj;
    });

    res.status(200).json({ success: true, data: { leaves: leavesWithUsage } });
  } catch (error) { next(error); }
};

const cancelLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findOne({ _id: id, userId: req.user._id });
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
    
    // Only allow cancelling if pending or approved
    if (!['pending', 'approved'].includes(leave.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${leave.status} request` });
    }

    // 🛡️ LEAVE CANCELLATION FIX: Reverse balance if it was already approved
    if (leave.status === 'approved') {
      await User.findByIdAndUpdate(leave.userId, {
        $inc: {
          'leaveBalance.cl': leave.clDays,
          'leaveBalance.sl': leave.slDays,
          'leaveBalance.rl': leave.rlDays
        }
      });

      // Revert Attendance Marks
      const Attendance = require('../models/Attendance');
      const records = await Attendance.find({ 
        userId: leave.userId, 
        date: { $in: leave.dailyBreakdown.map(i => i.date) }
      });
      
      const settings = await Settings.getSettings();

      for (const record of records) {
        // Reset leaveMeta and notes
        record.leaveMeta = { cl: 0, sl: 0, rl: 0, lwp: 0 };
        record.notes = 'Leave Cancelled: Balance Restored';
        record._settings = settings;
        await record.save(); // Triggers status recalculation
      }
    }

    leave.status = 'cancelled';
    await leave.save();

    // --- AUDIT LOG ---
    await logAudit({
      action: 'LEAVE_CANCEL',
      module: 'leave',
      entityId: leave._id,
      before: { status: leave.status },
      after: { status: 'cancelled' },
      details: `Cancelled ${leave.leaveType} leave request for ${req.user.name}. Balance restored if applicable.`,
      req
    });

    res.status(200).json({ success: true, message: 'Leave request cancelled and balance restored' });
  } catch (error) { next(error); }
};

/**
 * 📊 LEAVE USAGE SUMMARY
 * Source of Truth: Attendance Records (leaveMeta)
 */
const getLeaveUsageSummary = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user._id;
    const year = req.query.year || getCurrentYear();
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const Attendance = require('../models/Attendance');
    const { calculateDynamicLeaveBalance } = require('../utils/leaveHelpers');
    
    const balanceResult = await calculateDynamicLeaveBalance(user, Attendance, year);

    // Sync user.leaveBalance.cl in background as requested (Step 4 Logic)
    User.findByIdAndUpdate(userId, {
      $set: { 
        'leaveBalance.cl': balanceResult.cl.available,
        'leaveBalance.sl': balanceResult.sl.available,
        'leaveBalance.rl': balanceResult.rl.available
      }
    }).catch(err => console.error('Balance sync failed:', err));

    res.status(200).json({ 
      success: true, 
      data: { 
        summary: balanceResult, 
        year 
      } 
    });
  } catch (error) { next(error); }
};

// Validation rules
const applyLeaveValidation = [
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('reason').notEmpty().withMessage('Reason is required')
];

const myLeavesValidation = [
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled']),
  query('year').optional().isInt({ min: 2000, max: 2100 })
];

const rejectLeaveValidation = [
  param('id').isMongoId(),
  body('adminComment').optional().isLength({ max: 500 })
];

module.exports = {
  applyLeave,
  getMyLeaves,
  getMyBalance,
  getLeaveUsageSummary,
  cancelLeave,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  getEmployeeBalance,
  applyLeaveValidation,
  myLeavesValidation,
  rejectLeaveValidation
};
