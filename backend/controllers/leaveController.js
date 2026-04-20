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
  calculateAccrualBalance,
  distributeLeave
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

    // 1. Fetch Policies
    const [settings, holidays] = await Promise.all([
      Settings.getSettings(),
      Holiday.find({ isActive: true })
    ]);

    const holidayStrings = holidays.map(h => new Date(h.date).toISOString().split('T')[0]);

    // 🛡️ TIMEZONE-SAFE FILTERING (Sundays and Holidays)
    const allDates = getDatesBetween(new Date(startDate), new Date(endDate)).filter(dStr => {
      const [y, m, d] = dStr.split('-').map(Number);
      const isSunday = new Date(y, m - 1, d).getDay() === 0;
      return !isSunday && !holidayStrings.includes(dStr);
    });

    if (allDates.length === 0) {
      return res.status(400).json({ success: false, message: 'No working days found in selected range (Sundays or Holidays)' });
    }

    // 🛡️ OVERLAP CHECK (Using dailyBreakdown for precision)
    const existingLeaves = await Leave.find({
      userId,
      status: { $in: ['pending', 'approved'] }
    });
    
    const bookedDates = new Set();
    existingLeaves.forEach(lv => {
      if (lv.dailyBreakdown && lv.dailyBreakdown.length > 0) {
        lv.dailyBreakdown.forEach(b => bookedDates.add(b.date));
      } else {
        // Fallback for older records
        getDatesBetween(lv.startDate, lv.endDate).forEach(d => bookedDates.add(d));
      }
    });

    if (allDates.some(d => bookedDates.has(d))) {
      return res.status(400).json({ success: false, message: 'Overlapping leave exists on these dates.' });
    }

    // 4. STRICT MONTHLY & YEARLY LIMIT ENGINE
    const monthsInvolved = [...new Set(allDates.map(d => d.slice(0, 7)))];
    const currentYear = new Date(startDate).getFullYear().toString();

    const monthlyUsed = {};
    monthsInvolved.forEach(m => monthlyUsed[m] = { cl: 0, sl: 0 });
    let yearlyRLUsed = 0;

    existingLeaves.forEach(lv => {
      (lv.dailyBreakdown || []).forEach(day => {
        const monthKey = day.date.slice(0, 7);
        const yearKey = day.date.slice(0, 4);

        if (monthlyUsed[monthKey]) {
          const dayVal = day.days || (lv.isHalfDay ? 0.5 : 1);
          if (day.leaveType === 'cl') monthlyUsed[monthKey].cl += dayVal;
          if (day.leaveType === 'sl') monthlyUsed[monthKey].sl += dayVal;
        }

        if (yearKey === currentYear && day.leaveType === 'rl') {
           yearlyRLUsed += (day.days || (lv.isHalfDay ? 0.5 : 1));
        }
      });
    });

    const selectedType = req.body.leaveType || 'casual';
    const typeKeyMap = { casual: 'cl', sick: 'sl', religious: 'rl', unpaid: 'lwp' };
    const internalKey = typeKeyMap[selectedType] || 'lwp';

    const totalDaysValue = isHalfDay ? 0.5 : allDates.length;
    const breakdown = distributeLeave(allDates, internalKey, monthlyUsed, yearlyRLUsed, isHalfDay);

    if (breakdown.sl > 2 && !req.body.attachment) {
      return res.status(400).json({
        success: false,
        message: 'Medical certificate attachment is required for sick leave exceeding 2 days.'
      });
    }

    // 5. Create Leave Record
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
      reason,
      attachment: req.body.attachment || null,
      isHalfDay,
      status: 'pending'
    });

    res.status(201).json({ 
      success: true, 
      message: 'Leave request submitted successfully',
      data: { leave }
    });

    // Notify admins
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

/**
 * @desc    Approve leave (Accrual Engine)
 */
const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const leave = await Leave.findById(id).populate('userId');
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: `Request is already ${leave.status}` });

    // 1. PAYROLL LOCK PROTECTION
    for (const [year, dates] of leave.yearBreakdown) {
      const months = [...new Set(dates.map(d => new Date(d).getMonth() + 1))];
      for (const m of months) {
        const finalized = await Payroll.findOne({ month: m, year: parseInt(year) });
        if (finalized) {
          return res.status(400).json({
            success: false,
            message: 'Payroll already finalized for this period. Unlock to proceed.'
          });
        }
      }
    }

    // 2. UPDATE BALANCE (Used counts)
    const currentYear = getCurrentYear();
    await LeaveBalance.findOneAndUpdate(
      { userId: leave.userId._id, year: currentYear },
      { 
        $inc: { 
          'casual.used': leave.clDays,
          'sick.used': leave.slDays,
          'religious.used': leave.rlDays,
          'unpaid.used': leave.lwpDays
        }
      }
    );

    // 3. Update Status (🛡️ APPROVAL SAFETY: Atomic check)
    const updatedLeave = await Leave.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { 
        $set: { 
          status: 'approved',
          reviewedBy: adminId,
          reviewedAt: new Date()
        } 
      },
      { new: true }
    );

    if (!updatedLeave) {
      return res.status(400).json({ success: false, message: 'Leave is no longer pending or already processed' });
    }

    // 4. SYNC ATTENDANCE (Source of Truth)
    const Attendance = require('../models/Attendance');
    
    // Group breakdown by date to handle split days correctly
    const dateMap = {};
    for (const item of updatedLeave.dailyBreakdown) {
      if (!dateMap[item.date]) dateMap[item.date] = { cl: 0, sl: 0, rl: 0, lwp: 0 };
      const val = item.days || (updatedLeave.isHalfDay ? 0.5 : 1);
      const type = item.leaveType.toLowerCase();
      if (dateMap[item.date].hasOwnProperty(type)) {
        dateMap[item.date][type] += val;
      }
    }

    const syncResults = [];
    for (const [date, meta] of Object.entries(dateMap)) {
      const totalLeave = meta.cl + meta.sl + meta.rl + meta.lwp;
      const notes = `Approved Leave: ${updatedLeave.leaveType.toUpperCase()} (ID: ${id})`;
      
      let record = await Attendance.findOne({ userId: updatedLeave.userId._id, date });
      
      if (record) {
        // Update existing record
        record.leaveMeta = meta;
        record.notes = notes;
        
        // Priority: If full leave (1.0), force 'leave' status
        if (totalLeave >= 1.0) record.status = 'leave';
        // If partial leave, only set 'leave' status if currently 'absent'
        else if (record.status === 'absent') record.status = 'leave';
        
        await record.save();
      } else {
        // Create new record
        record = await Attendance.create({
          userId: updatedLeave.userId._id,
          date,
          status: 'leave',
          leaveMeta: meta,
          notes
        });
      }
      syncResults.push({ date, totalLeave, status: record.status });
    }

    console.log(`[DEBUG] Final Sync for Leave ${id}:`, syncResults);

    // 5. Audit Log
    await AuditLog.create({
      action: 'LEAVE_APPROVE',
      performedBy: adminId,
      details: `Approved ${updatedLeave.totalDays}d leave for ${updatedLeave.userId.name}.`
    });

    res.status(200).json({ success: true, message: 'Leave request approved' });

    emitToUser(updatedLeave.userId._id.toString(), 'notification:new', {
      type: 'leave_approved',
      title: '✅ Leave Approved',
      message: 'Your leave request has been approved.',
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
    res.status(200).json({ success: true, data: { balance: balance.getAccrualSummary(req.user.joiningDate), year } });
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
    
    // Only allow cancelling if pending or approved
    if (!['pending', 'approved'].includes(leave.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${leave.status} request` });
    }

    // 🛡️ LEAVE CANCELLATION FIX: Reverse balance if it was already approved
    if (leave.status === 'approved') {
      const currentYear = getCurrentYear();
      await LeaveBalance.findOneAndUpdate(
        { userId: leave.userId, year: currentYear },
        { 
          $inc: { 
            'casual.used': -leave.clDays,
            'sick.used': -leave.slDays,
            'religious.used': -leave.rlDays,
            'unpaid.used': -leave.lwpDays
          }
        }
      );

      // Revert Attendance Marks (Change 'leave' back to 'absent')
      const Attendance = require('../models/Attendance');
      await Attendance.updateMany(
        { userId: leave.userId, date: { $in: leave.dailyBreakdown.map(i => i.date) }, status: 'leave' },
        { $set: { status: 'absent', notes: 'Leave Cancelled: Reverted to Absent' } }
      );
    }

    leave.status = 'cancelled';
    await leave.save();

    // --- AUDIT LOG (ADDED) ---
    await AuditLog.create({
      action: 'LEAVE_CANCEL',
      performedBy: req.user._id,
      details: `Cancelled ${leave.leaveType} leave request for ${req.user.name}. Status was ${leave.status}.`
    });

    res.status(200).json({ success: true, message: 'Leave request cancelled and balance restored' });
  } catch (error) { next(error); }
};

const getEmployeeBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const year = getCurrentYear();
    let balance = await LeaveBalance.findOne({ userId, year });
    if (!balance) balance = await LeaveBalance.create({ userId, year });
    res.status(200).json({ success: true, data: { balance: balance.getAccrualSummary(), year } });
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
  cancelLeave,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  getEmployeeBalance,
  applyLeaveValidation,
  myLeavesValidation,
  rejectLeaveValidation
};
