const Settings = require('../models/Settings');

/**
 * @desc    Get current office settings
 * @route   GET /api/settings
 * @access  Private/Admin
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: settings,
      message: 'Office settings retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update office settings
 * @route   PUT /api/settings
 * @access  Private/Admin
 */
const updateSettings = async (req, res, next) => {
  try {
    const { 
      officeStartTime, 
      officeEndTime, 
      lateGracePeriod, 
      halfDayThreshold, 
      maxBreakLimit,
      workingDays
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    if (officeStartTime !== undefined) settings.officeStartTime = officeStartTime;
    if (officeEndTime !== undefined) settings.officeEndTime = officeEndTime;
    if (lateGracePeriod !== undefined) settings.lateGracePeriod = lateGracePeriod;
    if (halfDayThreshold !== undefined) settings.halfDayThreshold = halfDayThreshold;
    if (maxBreakLimit !== undefined) settings.maxBreakLimit = maxBreakLimit;
    if (workingDays !== undefined) settings.workingDays = workingDays;
    
    settings.updatedBy = req.user._id;

    await settings.save();

    res.status(200).json({
      success: true,
      data: settings,
      message: 'Office settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
