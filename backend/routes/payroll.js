const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { 
  getPayrollSummary, 
  processPayroll, 
  updatePayroll, 
  bulkPay, 
  getMyPayroll,
  unlockPayroll
} = require('../controllers/payrollController');

// Shared routes
router.use(protect);

/**
 * @route   GET /api/payroll/my
 * @desc    Get personal payroll (history or month-specific)
 * @access  Private (Employee/Admin)
 */
router.get('/my', getMyPayroll);

/**
 * @route   GET /api/payroll/my-history
 * @desc    Get personal payroll history
 * @access  Private (Employee/Admin)
 */
router.get('/my-history', getMyPayroll);

// Admin only routes
router.use(isAdmin);

/**
 * @route   GET /api/payroll/admin/summary
 * @desc    Get payroll summary/preview for a month
 */
router.get('/admin/summary', getPayrollSummary);

/**
 * @route   POST /api/payroll/admin/process
 * @desc    Lock and save payroll records
 */
router.post('/admin/process', processPayroll);

/**
 * @route   PUT /api/payroll/admin/bulk-pay
 * @desc    Mark multiple payouts as completed
 */
router.put('/admin/bulk-pay', bulkPay);

/**
 * @route   PUT /api/payroll/admin/:id
 * @desc    Update individual payroll (adjustments)
 */
router.put('/admin/:id', updatePayroll);

/**
 * @route   DELETE /api/payroll/admin/unlock
 * @desc    Unlock and revert payroll records to draft
 */
router.delete('/admin/unlock', unlockPayroll);

module.exports = router;
