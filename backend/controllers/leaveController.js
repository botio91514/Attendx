const { validationResult, body, query, param } = require('express-validator');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Holiday = require('../models/Holiday');
const Payroll = require('../models/Payroll');
const AuditLog = require('../models/AuditLog');
const {
  getLeaveBreakdown,
  getCurrentYear,
  dateRangesOverlap,
} = require('../utils/leaveHelpers');
const { sendEmail } = require('../utils/emailService');
const { 
  leaveRequestAdminTemplate, 
  leaveApprovedTemplate, 
  leaveRejectedTemplate 
} = require('../utils/emailTemplates');
const { emitToAdmins, emitToUser } = require('../socket/socketManager.js');

/**
 * @desc    Apply for leave
 */
const applyLeave = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array().map(e => e.msg) });

    const { leaveType, startDate, endDate, reason } = req.body;
    const userId = req.user._id;

    // 1. Fetch Policies
    const [settings, holidays] = await Promise.all([
      Settings.getSettings(),
      Holiday.find({ isActive: true })
    ]);

    const workingDays = settings.workingDays || [1, 2, 3, 4, 5, 6];
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    // 2. BACKDATED ABUSE PROTECTION
    const startObj = new Date(startDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffDays = Math.ceil((today - startObj) / (1000 * 60 * 60 * 24));
    
    if (diffDays > settings.backdatedLeaveLimit) {
      return res.status(400).json({
        success: false,
        message: `Backdated leave limit exceeded. You can only apply for leaves within ${settings.backdatedLeaveLimit} days of the past.`
      });
    }

    // 3. PAYROLL LOCK PROTECTION (Check all months involved)
    const breakdownData = getLeaveBreakdown(startDate, endDate, workingDays, holidayDates);
    if (breakdownData.total === 0) return res.status(400).json({ success: false, message: 'No working days found in the selected range.' });

    for (const year in breakdownData.breakdown) {
      const dates = breakdownData.breakdown[year];
      const months = [...new Set(dates.map(d => new Date(d).getMonth() + 1))];
      
      for (const m of months) {
        const finalized = await Payroll.findOne({ month: m, year: parseInt(year) });
        if (finalized) {
          return res.status(400).json({
            success: false,
            message: `Selected dates span into ${new Date(0, m-1).toLocaleString('default', { month: 'long' })} ${year}, which has a finalized payroll. Application blocked.`
          });
        }
      }
    }

    // 4. PRECISE OVERLAP & DAILY LIMIT CHECK
    const existingLeaves = await Leave.find({
      userId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    });

    const datesToApply = breakdownData.breakdown;
    const requestedAllDates = Object.values(datesToApply).flat();

    for (const date of requestedAllDates) {
      let dailyTotal = 0;
      // Calculate how much leave is already taken on this specific date
      existingLeaves.forEach(lv => {
        const lvStart = lv.startDate.toISOString().split('T')[0];
        const lvEnd = lv.endDate.toISOString().split('T')[0];
        if (date >= lvStart && date <= lvEnd) {
          // If it's a half-day, add 0.5, else 1
          dailyTotal += lv.isHalfDay ? 0.5 : 1;
        }
      });

      // If already 1 day full, block
      if (dailyTotal >= 1) {
        return res.status(400).json({
          success: false,
          message: `You already have a full day leave or overlapping requests on ${date}.`
        });
      }
    }

    // 5. YEAR BOUNDARY BALANCE CHECK
    if (leaveType !== 'unpaid') {
      for (const year in breakdownData.breakdown) {
        const count = breakdownData.breakdown[year].length;
        let balance = await LeaveBalance.findOne({ userId, year: parseInt(year) });
        if (!balance) balance = await LeaveBalance.create({ userId, year: parseInt(year) });
        
        if (balance[leaveType].remaining < count) {
          return res.status(400).json({
            success: false,
            message: `Insufficient ${leaveType} balance for year ${year}. Needed: ${count}, Available: ${balance[leaveType].remaining}`
          });
        }
      }
    }

    // 6. Create Leave Record
    const leave = await Leave.create({
      userId,
      leaveType,
      startDate,
      endDate,
      totalDays: breakdownData.total,
      yearBreakdown: breakdownData.breakdown,
      reason,
      status: 'pending'
    });

    res.status(201).json({ success: true, message: 'Leave request submitted successfully' });

    // Notifications
    emitToAdmins('notification:new', {
      type: 'leave_request',
      title: '📋 New Leave Request',
      message: `${req.user.name} applied for ${leaveType} (${breakdownData.total} days).`,
      link: '/admin/leaves'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve leave (Hardened)
 */
const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const leave = await Leave.findById(id).populate('userId');
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: `Request is already ${leave.status}` });

    // 1. PAYROLL LOCK PROTECTION (Check again)
    for (let [year, dates] of leave.yearBreakdown) {
      const months = [...new Set(dates.map(d => new Date(d).getMonth() + 1))];
      for (const m of months) {
        const finalized = await Payroll.findOne({ month: m, year: parseInt(year) });
        if (finalized) {
          return res.status(400).json({
            success: false,
            message: 'This leave belongs to a finalized payroll period. Please unlock payroll to proceed.'
          });
        }
      }
    }

    // 2. ATOMIC BALANCE DEDUCTION
    if (leave.leaveType !== 'unpaid') {
      for (let [year, dates] of leave.yearBreakdown) {
        const count = dates.length;
        const result = await LeaveBalance.findOneAndUpdate(
          {
            userId: leave.userId._id,
            year: parseInt(year),
            [`${leave.leaveType}.remaining`]: { $gte: count }
          },
          { 
            $inc: { [`${leave.leaveType}.used`]: count, [`${leave.leaveType}.remaining`]: -count } 
          },
          { new: true }
        );

        if (!result) {
          return res.status(400).json({
            success: false,
            message: `Approval failed: Insufficient ${leave.leaveType} balance in year ${year} (Atomic check failed).`
          });
        }
      }
    }

    // 3. Update Status
    leave.status = 'approved';
    leave.reviewedBy = adminId;
    leave.reviewedAt = new Date();
    await leave.save();

    // 4. SYNC ATTENDANCE
    const Attendance = require('../models/Attendance');
    for (let [year, dates] of leave.yearBreakdown) {
      for (const dateStr of dates) {
        await Attendance.findOneAndUpdate(
          { userId: leave.userId._id, date: dateStr, status: 'absent' },
          { $set: { status: 'leave', notes: `Converted from absent (Leave ID: ${id})` } }
        );
      }
    }

    // 5. Audit Log
    await AuditLog.create({
      action: 'LEAVE_APPROVE',
      performedBy: adminId,
      details: `Approved ${leave.leaveType} leave for ${leave.userId.name} (${leave.totalDays} days)`
    });

    res.status(200).json({ success: true, message: 'Leave request approved' });

    // Notification
    emitToUser(leave.userId._id.toString(), 'notification:new', {
      type: 'leave_approved',
      title: '✅ Leave Approved',
      message: `Your ${leave.leaveType} leave has been approved.`,
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
    leave.reviewedAt = new Date();
    await leave.save();

    await AuditLog.create({
      action: 'LEAVE_REJECT',
      performedBy: adminId,
      details: `Rejected ${leave.leaveType} leave for ${leave.userId.name}. Reason: ${adminComment || 'None'}`
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
    const userId = req.user._id;
    const year = getCurrentYear();
    let balance = await LeaveBalance.findOne({ userId, year });
    if (!balance) balance = await LeaveBalance.create({ userId, year });
    res.status(200).json({ success: true, data: { balance: balance.getSummary(), year } });
  } catch (error) { next(error); }
};

const getAllLeaves = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const leaves = await Leave.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ appliedAt: -1 });
    res.status(200).json({ success: true, data: { leaves } });
  } catch (error) { next(error); }
};

const cancelLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findOne({ _id: id, userId: req.user._id });
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Can only cancel pending requests' });

    leave.status = 'cancelled';
    await leave.save();
    res.status(200).json({ success: true, message: 'Leave request cancelled' });
  } catch (error) { next(error); }
};

const getEmployeeBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const year = getCurrentYear();
    let balance = await LeaveBalance.findOne({ userId, year });
    if (!balance) balance = await LeaveBalance.create({ userId, year });
    res.status(200).json({ success: true, data: { balance: balance.getSummary(), year } });
  } catch (error) { next(error); }
};

// Validation rules
const applyLeaveValidation = [
  body('leaveType').isIn(['sick', 'casual', 'religious', 'unpaid']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('reason').notEmpty()
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
  cancelLeave,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  getEmployeeBalance,
  applyLeaveValidation,
  myLeavesValidation,
  rejectLeaveValidation
};
