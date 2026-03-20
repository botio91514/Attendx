const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const {
  getAllHolidays,
  createHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');

// All routes are protected
router.use(protect);

/**
 * @route   GET /api/holidays
 * @desc    Get all holidays
 * @access  Private
 */
router.get('/', getAllHolidays);

/**
 * @route   POST /api/holidays
 * @desc    Create a holiday
 * @access  Private/Admin
 */
router.post('/', isAdmin, createHoliday);

/**
 * @route   DELETE /api/holidays/:id
 * @desc    Delete a holiday
 * @access  Private/Admin
 */
router.delete('/:id', isAdmin, deleteHoliday);

module.exports = router;
