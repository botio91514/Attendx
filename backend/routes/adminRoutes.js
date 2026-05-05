const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { overrideAttendance, overrideTask, recalculateAttendance } = require('../controllers/adminCorrectionController');
const { exportAttendanceMatrixExcel } = require('../controllers/exportController');

// All routes are protected and admin-only
router.use(protect);
router.use(isAdmin);

router.post('/attendance/override', overrideAttendance);
router.post('/attendance/recalculate', recalculateAttendance);
router.post('/tasks/override', overrideTask);

// Export routes
router.get('/export/attendance-csv', exportAttendanceMatrixExcel);

module.exports = router;
