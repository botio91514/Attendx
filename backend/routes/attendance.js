const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayAttendance,
  getAttendanceHistory,
  getAllAttendance,
  getAttendanceReport,
  getTodayStats,
  historyValidation,
  reportValidation,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { apiLimiter } = require('../middleware/rateLimiter');

// All attendance routes are protected
router.use(protect, apiLimiter);

/**
 * @route   POST /api/attendance/checkin
 * @desc    Check-in for the day
 * @access  Private (Employee)
 */
router.post('/checkin', checkIn);

/**
 * @route   POST /api/attendance/checkout
 * @desc    Check-out for the day
 * @access  Private (Employee)
 */
router.post('/checkout', checkOut);

/**
 * @route   POST /api/attendance/break/start
 * @desc    Start a break
 * @access  Private (Employee)
 */
router.post('/break/start', startBreak);

/**
 * @route   POST /api/attendance/break/end
 * @desc    End a break
 * @access  Private (Employee)
 */
router.post('/break/end', endBreak);

/**
 * @route   GET /api/attendance/today
 * @desc    Get today's attendance record
 * @access  Private (Employee)
 */
router.get('/today', getTodayAttendance);

/**
 * @route   GET /api/attendance/history
 * @desc    Get attendance history for logged-in user
 * @access  Private (Employee)
 */
router.get('/history', historyValidation, getAttendanceHistory);

// Admin only routes
/**
 * @route   GET /api/attendance/admin/all
 * @desc    Get all attendance records
 * @access  Private/Admin
 */
router.get('/admin/all', isAdmin, getAllAttendance);

/**
 * @route   GET /api/attendance/admin/report
 * @desc    Get attendance report
 * @access  Private/Admin
 */
router.get('/admin/report', isAdmin, reportValidation, getAttendanceReport);

/**
 * @route   GET /api/attendance/admin/stats
 * @desc    Get today's stats
 * @access  Private/Admin
 */
router.get('/admin/stats', isAdmin, getTodayStats);

module.exports = router;
