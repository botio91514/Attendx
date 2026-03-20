const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { apiLimiter } = require('../middleware/rateLimiter');

// All leave routes are protected
router.use(protect, apiLimiter);

/**
 * @route   POST /api/leave/apply
 * @desc    Apply for leave
 * @access  Private (Employee)
 */
router.post('/apply', applyLeaveValidation, applyLeave);

/**
 * @route   GET /api/leave/my
 * @desc    Get my leave history
 * @access  Private (Employee)
 */
router.get('/my', myLeavesValidation, getMyLeaves);

/**
 * @route   GET /api/leave/balance
 * @desc    Get my leave balance
 * @access  Private (Employee)
 */
router.get('/balance', getMyBalance);

/**
 * @route   PUT /api/leave/cancel/:id
 * @desc    Cancel a pending leave
 * @access  Private (Employee)
 */
router.put('/cancel/:id', cancelLeave);

// Admin only routes
/**
 * @route   GET /api/leave/admin/all
 * @desc    Get all leave requests
 * @access  Private/Admin
 */
router.get('/admin/all', isAdmin, getAllLeaves);

/**
 * @route   PUT /api/leave/admin/:id/approve
 * @desc    Approve a leave request
 * @access  Private/Admin
 */
router.put('/admin/:id/approve', isAdmin, approveLeave);

/**
 * @route   PUT /api/leave/admin/:id/reject
 * @desc    Reject a leave request
 * @access  Private/Admin
 */
router.put('/admin/:id/reject', isAdmin, rejectLeaveValidation, rejectLeave);

/**
 * @route   GET /api/leave/admin/balance/:userId
 * @desc    Get employee leave balance
 * @access  Private/Admin
 */
router.get('/admin/balance/:userId', isAdmin, getEmployeeBalance);

module.exports = router;
