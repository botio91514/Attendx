const Holiday = require('../models/Holiday');
const { validationResult } = require('express-validator');

/**
 * @desc    Get all holidays
 * @route   GET /api/holidays
 * @access  Private
 */
const getAllHolidays = async (req, res, next) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a holiday (Admin only)
 * @route   POST /api/holidays
 * @access  Private/Admin
 */
const createHoliday = async (req, res, next) => {
  try {
    const { title, date, description, type } = req.body;

    // Check if date already exists
    const holidayExists = await Holiday.findOne({ date: new Date(date).setHours(0,0,0,0) });
    if (holidayExists) {
        return res.status(400).json({
            success: false,
            message: 'A holiday already exists on this date',
            errors: []
        });
    }

    const holiday = await Holiday.create({
      title,
      date,
      description,
      type: type || 'company',
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: holiday,
      message: 'Holiday created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a holiday (Admin only)
 * @route   DELETE /api/holidays/:id
 * @access  Private/Admin
 */
const deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found',
        errors: [],
      });
    }

    await holiday.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllHolidays,
  createHoliday,
  deleteHoliday,
};
