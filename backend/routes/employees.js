const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeAttendance,
  getEmployeeLeaves,
  updateEmployeeValidation,
} = require('../controllers/employeeController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { apiLimiter } = require('../middleware/rateLimiter');

// All employee routes are admin only
router.use(protect, isAdmin, apiLimiter);

/**
 * @route   GET /api/employees
 * @desc    Get all employees
 * @access  Private/Admin
 */
router.get('/', getAllEmployees);

/**
 * @route   GET /api/employees/:id
 * @desc    Get single employee profile
 * @access  Private/Admin
 */
router.get('/:id', getEmployeeById);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee info
 * @access  Private/Admin
 */
router.put('/:id', updateEmployeeValidation, updateEmployee);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Permanently delete employee
 * @access  Private/Admin
 */
router.delete('/:id', deleteEmployee);

/**
 * @route   GET /api/employees/:id/attendance
 * @desc    Get employee attendance history
 * @access  Private/Admin
 */
router.get('/:id/attendance', getEmployeeAttendance);

/**
 * @route   GET /api/employees/:id/leaves
 * @desc    Get employee leave history
 * @access  Private/Admin
 */
router.get('/:id/leaves', getEmployeeLeaves);

module.exports = router;
