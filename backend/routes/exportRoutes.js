const express = require('express');
const { 
  exportAttendancePDF,
  exportAllAttendancePDF,
  exportAttendanceCSV,
  exportBulkLeaveCSV,
  exportBulkPayrollCSV,
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

// Bulk exports
router.get('/attendance/all/bulk', exportAllAttendancePDF);
router.get('/attendance/all/csv', exportAttendanceCSV);

// Bulk Leave exports
router.get('/leave/all/csv', exportBulkLeaveCSV);

// Bulk Payroll exports
router.get('/payroll/all/csv', exportBulkPayrollCSV);

module.exports = router;
