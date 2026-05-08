const Holiday = require('../models/Holiday');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/emailService');
const { broadcastNoticeTemplate } = require('../utils/emailTemplates');
const User = require('../models/User');

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

    const { toIST } = require('../utils/timeUtils');
    const holidayDate = new Date(date);
    holidayDate.setUTCHours(0, 0, 0, 0); // Start at UTC midnight

    const holiday = await Holiday.create({
      title,
      date: toIST(holidayDate),
      description,
      type: type || 'company',
      createdBy: req.user._id,
    });

    // --- AUDIT LOG (ADDED) ---
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      action: 'HOLIDAY_CREATE',
      module: 'holiday',
      performedBy: req.user._id,
      details: `Created holiday: ${title} on ${new Date(date).toLocaleDateString()}`
    });

    res.status(201).json({
      success: true,
      data: holiday,
      message: 'Holiday created successfully',
    });

    // --- EMAIL NOTIFICATION (ADDED) ---
    // Notify all active employees about the new holiday
    const activeEmployees = await User.find({ role: 'employee', isActive: true });
    const { getISTDateString } = require('../utils/timeUtils');
    const istDate = getISTDateString(date);

    const broadcastHoliday = async () => {
      for (let i = 0; i < activeEmployees.length; i += 10) {
        const batch = activeEmployees.slice(i, i + 10);
        await Promise.allSettled(batch.map(emp => 
          sendEmail({
            to: emp.email,
            subject: `🎁 New Public Holiday: ${title}`,
            html: broadcastNoticeTemplate({
              employeeName: emp.name,
              noticeTitle: `New Holiday: ${title}`,
              noticeContent: `Greetings! Management has declared a public holiday on ${istDate}${description ? `. Details: ${description}` : ''}. Have a great time!`,
              postedBy: req.user.name,
              postedAt: new Date().toLocaleDateString('en-IN')
            })
          })
        ));
      }
    };

    broadcastHoliday().catch(err => console.error('Holiday Broadcast failed:', err));
    // --- END EMAIL NOTIFICATION ---

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

    // --- AUDIT LOG (ADDED) ---
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      action: 'HOLIDAY_DELETE',
      module: 'holiday',
      performedBy: req.user._id,
      details: `Deleted holiday: ${holiday.title} (${new Date(holiday.date).toLocaleDateString()})`
    });

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
