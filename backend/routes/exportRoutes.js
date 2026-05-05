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

// All routes: protect
router.use(protect);

// Single employee exports (Access control handled in controller for employees)
router.get('/attendance/:employeeId', exportAttendancePDF);
router.get('/payslip/:employeeId', exportPayslipPDF);
router.get('/leave/:employeeId', exportLeavePDF);

// Bulk exports (Admin only)
router.get('/attendance/all/bulk', isAdmin, exportAllAttendancePDF);
router.get('/attendance/all/csv', isAdmin, exportAttendanceCSV);

// Bulk Leave exports
router.get('/leave/all/csv', isAdmin, exportBulkLeaveCSV);

// Bulk Payroll exports
router.get('/payroll/all/csv', isAdmin, exportBulkPayrollCSV);

module.exports = router;
