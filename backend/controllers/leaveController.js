const { validationResult, body, query, param } = require('express-validator');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Holiday = require('../models/Holiday');
const {
  calculateWorkingDays,
  getCurrentYear,
  dateRangesOverlap,
} = require('../utils/leaveHelpers');

/**
 * @desc    Apply for leave
 * @route   POST /api/leave/apply
 * @access  Private
 */
const applyLeave = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((err) => err.msg),
      });
    }

    const { leaveType, startDate, endDate, reason } = req.body;
    const userId = req.user._id;

    // 🏆 Fetch Dynamic Policies
    const [settings, holidays] = await Promise.all([
      Settings.findOne(),
      Holiday.find({ isActive: true }) // Only consider active holidays
    ]);

    const workingDays = settings?.workingDays || [1, 2, 3, 4, 5]; // Fallback to Mon-Fri
    const holidayDates = holidays.map(h => h.date);

    // Calculate total working days accurately
    const totalDays = calculateWorkingDays(startDate, endDate, workingDays, holidayDates);

    if (totalDays === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected dates are non-working days or holidays. Please select valid working days.',
        errors: [],
      });
    }

    // Check for overlapping approved/pending leaves
    const overlappingLeaves = await Leave.find({
      userId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
      ],
    });

    if (overlappingLeaves.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for the selected dates',
        errors: [],
      });
    }

    // Check leave balance (skip for unpaid leave)
    if (leaveType !== 'unpaid') {
      const year = getCurrentYear();
      let leaveBalance = await LeaveBalance.findOne({ userId, year });

      if (!leaveBalance) {
        // Create default balance
        leaveBalance = await LeaveBalance.create({ userId, year });
      }

      if (leaveBalance[leaveType].remaining < totalDays) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${leaveType} leave balance. Available: ${leaveBalance[leaveType].remaining} days, Requested: ${totalDays} days`,
          errors: [],
        });
      }
    }

    // Create leave request
    const leave = await Leave.create({
      userId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: {
        leave: await Leave.findById(leave._id).populate(
          'userId',
          'name email employeeId'
        ),
      },
      message: 'Leave application submitted successfully',
    });

    // Notify Admins
    const admins = await User.find({ role: 'admin' });
    const notifications = admins.map(admin => ({
      recipient: admin._id,
      sender: userId,
      type: 'leave_request',
      title: 'New Leave Request',
      message: `${req.user.name} has applied for ${leaveType} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}.`,
      link: '/admin/leaves',
      targetRole: 'admin',
      referenceId: leave._id
    }));
    await Notification.insertMany(notifications);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my leave history
 * @route   GET /api/leave/my
 * @access  Private
 */
const getMyLeaves = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, year, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { userId };

    if (status) {
      query.status = status;
    }

    if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leaves, total] = await Promise.all([
      Leave.find(query)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Leave.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        leaves,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'Leave history retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my leave balance
 * @route   GET /api/leave/balance
 * @access  Private
 */
const getMyBalance = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const year = getCurrentYear();

    let leaveBalance = await LeaveBalance.findOne({ userId, year });

    if (!leaveBalance) {
      // Create default balance
      leaveBalance = await LeaveBalance.create({ userId, year });
    }

    res.status(200).json({
      success: true,
      data: {
        balance: leaveBalance.getSummary(),
        year,
      },
      message: 'Leave balance retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel a pending leave
 * @route   PUT /api/leave/cancel/:id
 * @access  Private
 */
const cancelLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const leave = await Leave.findOne({ _id: id, userId });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
        errors: [],
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel ${leave.status} leave request`,
        errors: [],
      });
    }

    leave.status = 'cancelled';
    await leave.save();

    res.status(200).json({
      success: true,
      data: { leave },
      message: 'Leave request cancelled successfully',
    });

    // Notify Admins
    const admins = await User.find({ role: 'admin' });
    const notifications = admins.map(admin => ({
      recipient: admin._id,
      sender: userId,
      type: 'leave_request',
      title: 'Leave Request Cancelled',
      message: `${req.user.name} has cancelled their ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()}.`,
      link: '/admin/leaves',
      targetRole: 'admin'
    }));
    await Notification.insertMany(notifications);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all leave requests (Admin only)
 * @route   GET /api/leave/admin/all
 * @access  Private/Admin
 */
const getAllLeaves = async (req, res, next) => {
  try {
    const { status, month, year, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (month && year) {
      const startOfMonth = new Date(`${year}-${month}-01`);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      query.startDate = { $gte: startOfMonth, $lt: endOfMonth };
    } else if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leaves, total] = await Promise.all([
      Leave.find(query)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email employeeId department designation'),
      Leave.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        leaves,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'All leave requests retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a leave request (Admin only)
 * @route   PUT /api/leave/admin/:id/approve
 * @access  Private/Admin
 */
const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
        errors: [],
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status}`,
        errors: [],
      });
    }

    // Deduct leave balance (skip for unpaid leave)
    if (leave.leaveType !== 'unpaid') {
      const year = new Date(leave.startDate).getFullYear();
      let leaveBalance = await LeaveBalance.findOne({
        userId: leave.userId,
        year,
      });

      if (!leaveBalance) {
        leaveBalance = await LeaveBalance.create({ userId: leave.userId, year });
      }

      if (leaveBalance[leave.leaveType].remaining < leave.totalDays) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${leave.leaveType} leave balance for this employee`,
          errors: [],
        });
      }

      leaveBalance.useLeave(leave.leaveType, leave.totalDays);
      await leaveBalance.save();
    }

    // Approve leave
    leave.status = 'approved';
    leave.reviewedBy = adminId;
    leave.reviewedAt = new Date();
    await leave.save();

    res.status(200).json({
      success: true,
      data: {
        leave: await Leave.findById(id).populate(
          'userId',
          'name email employeeId'
        ),
      },
      message: 'Leave request approved successfully',
    });

    // ✅ Clean Up Admin Notifications (Mark as read for everyone)
    await Notification.updateMany(
      { referenceId: id, type: 'leave_request' },
      { $set: { isRead: true } }
    );

    // Notify Employee
    await Notification.create({
      recipient: leave.userId,
      sender: adminId,
      type: 'leave_approved',
      title: 'Leave Approved',
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} has been approved.`,
      link: '/leaves',
      targetRole: 'employee'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a leave request (Admin only)
 * @route   PUT /api/leave/admin/:id/reject
 * @access  Private/Admin
 */
const rejectLeave = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((err) => err.msg),
      });
    }

    const { id } = req.params;
    const { adminComment } = req.body;
    const adminId = req.user._id;

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
        errors: [],
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status}`,
        errors: [],
      });
    }

    // Reject leave
    leave.status = 'rejected';
    leave.reviewedBy = adminId;
    leave.reviewedAt = new Date();
    if (adminComment) {
      leave.adminComment = adminComment;
    }
    await leave.save();

    res.status(200).json({
      success: true,
      data: {
        leave: await Leave.findById(id).populate(
          'userId',
          'name email employeeId'
        ),
      },
      message: 'Leave request rejected',
    });

    // ✅ Clean Up Admin Notifications
    await Notification.updateMany(
      { referenceId: id, type: 'leave_request' },
      { $set: { isRead: true } }
    );

    // Notify Employee
    await Notification.create({
      recipient: leave.userId,
      sender: adminId,
      type: 'leave_rejected',
      title: 'Leave Rejected',
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} was rejected. ${adminComment ? `Reason: ${adminComment}` : ''}`,
      link: '/leaves',
      targetRole: 'employee'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get employee leave balance (Admin only)
 * @route   GET /api/leave/admin/balance/:userId
 * @access  Private/Admin
 */
const getEmployeeBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const year = req.query.year || getCurrentYear();

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        errors: [],
      });
    }

    let leaveBalance = await LeaveBalance.findOne({ userId, year });

    if (!leaveBalance) {
      // Create default balance
      leaveBalance = await LeaveBalance.create({ userId, year });
    }

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: user._id,
          name: user.name,
          email: user.email,
          employeeId: user.employeeId,
        },
        balance: leaveBalance.getSummary(),
        year,
      },
      message: 'Employee leave balance retrieved',
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const applyLeaveValidation = [
  body('leaveType')
    .notEmpty()
    .withMessage('Leave type is required')
    .isIn(['sick', 'casual', 'earned', 'unpaid'])
    .withMessage('Invalid leave type'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ max: 1000 })
    .withMessage('Reason cannot exceed 1000 characters'),
];

const myLeavesValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'cancelled'])
    .withMessage('Invalid status'),
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
];

const rejectLeaveValidation = [
  param('id').isMongoId().withMessage('Invalid leave ID'),
  body('adminComment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Admin comment cannot exceed 500 characters'),
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
  rejectLeaveValidation,
};
