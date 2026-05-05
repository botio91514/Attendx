const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { overrideAttendance, overrideTask, recalculateAttendance } = require('../controllers/adminCorrectionController');

// All routes are protected and admin-only
router.use(protect);
router.use(isAdmin);

router.post('/attendance/override', overrideAttendance);
router.post('/attendance/recalculate', recalculateAttendance);
router.post('/tasks/override', overrideTask);

module.exports = router;
