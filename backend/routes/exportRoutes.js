const express = require('express');
const { 
  exportAttendancePDF,
  exportAllAttendancePDF,
  exportPayslipPDF,
  exportLeavePDF
} = require('../controllers/exportController.js');

const { protect } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/isAdmin.js');

const router = express.Router();

// All routes: admin only
router.use(protect, isAdmin);

// Single employee exports
router.get('/attendance/:employeeId', exportAttendancePDF);
router.get('/payslip/:employeeId', exportPayslipPDF);
router.get('/leave/:employeeId', exportLeavePDF);

// Bulk exports (all employees)
router.get('/attendance/all/bulk', exportAllAttendancePDF);

module.exports = router;
