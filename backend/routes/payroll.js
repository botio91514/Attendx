const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { getPayrollSummary } = require('../controllers/payrollController');

// All routes are admin only
router.use(protect, isAdmin);

/**
 * @route   GET /api/payroll/admin/summary
 * @desc    Get payroll summary for a month
 * @access  Private/Admin
 */
router.get('/admin/summary', getPayrollSummary);

module.exports = router;
