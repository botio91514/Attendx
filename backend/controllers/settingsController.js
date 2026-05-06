const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/emailService');
const { policyChangeTemplate } = require('../utils/emailTemplates');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');
const { triggerAbsentReschedule } = require('../jobs/autoCheckoutReminder');

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
      minWorkMinutes,
      lateGraceMinutes,
      autoCheckoutTime,
      maxDailyCredit,
      weekendPolicy,
      autoBreakMinutes,
      breakPolicy,
      maxBreakLimit,
      breakDurationMinutes,
      workingDays
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    // Capture changes for email notification
    const changes = [];
    if (officeStartTime !== undefined && officeStartTime !== settings.officeStartTime) {
      changes.push({ type: 'Office Start Time', old: settings.officeStartTime, new: officeStartTime });
      settings.officeStartTime = officeStartTime;
    }
    if (officeEndTime !== undefined && officeEndTime !== settings.officeEndTime) {
      changes.push({ type: 'Office End Time', old: settings.officeEndTime, new: officeEndTime });
      settings.officeEndTime = officeEndTime;
    }
    if (lateGracePeriod !== undefined && lateGracePeriod !== settings.lateGracePeriod) {
      changes.push({ type: 'Late Grace Period', old: `${settings.lateGracePeriod}m`, new: `${lateGracePeriod}m` });
      settings.lateGracePeriod = lateGracePeriod;
    }
    if (workingDays !== undefined && JSON.stringify(workingDays) !== JSON.stringify(settings.workingDays)) {
      changes.push({ type: 'Working Days Schedule', old: settings.workingDays.join(','), new: workingDays.join(',') });
      settings.workingDays = workingDays;
    }
    
    // Other fields without granular change tracking for now
    if (halfDayThreshold !== undefined) settings.halfDayThreshold = halfDayThreshold;
    if (minWorkMinutes !== undefined) settings.minWorkMinutes = minWorkMinutes;
    if (lateGraceMinutes !== undefined) settings.lateGraceMinutes = lateGraceMinutes;
    if (autoCheckoutTime !== undefined) settings.autoCheckoutTime = autoCheckoutTime;
    if (maxDailyCredit !== undefined) settings.maxDailyCredit = maxDailyCredit;
    if (weekendPolicy !== undefined) settings.weekendPolicy = weekendPolicy;
    if (autoBreakMinutes !== undefined) settings.autoBreakMinutes = autoBreakMinutes;
    if (breakPolicy !== undefined) settings.breakPolicy = breakPolicy;
    if (maxBreakLimit !== undefined) settings.maxBreakLimit = maxBreakLimit;
    if (breakDurationMinutes !== undefined) settings.breakDurationMinutes = breakDurationMinutes;
    
    const before = settings.toObject();
    
    // ... apply changes ...

    await settings.save();
    const after = settings.toObject();
    
    // --- AUDIT LOG (UPGRADED) ---
    await logAudit({
      action: 'SETTINGS_UPDATE',
      module: 'settings',
      entityId: settings._id,
      before,
      after,
      details: `Updated office configuration: ${changes.length > 0 ? changes.map(c => c.type).join(', ') : 'Minor changes'}`,
      req
    });

    res.status(200).json({
      success: true,
      data: settings,
      message: 'Office settings updated successfully',
    });

    // --- EMAIL NOTIFICATION (ADDED) ---
    // Notify employees if policy-impacting changes were made
    if (changes.length > 0) {
      const activeEmployees = await User.find({ role: 'employee', isActive: true });
      
      const broadcastUpdate = async () => {
        // Handle in batches for scalability
        for (let i = 0; i < activeEmployees.length; i += 10) {
          const batch = activeEmployees.slice(i, i + 10);
          await Promise.allSettled(batch.map(emp => 
            sendEmail({
              to: emp.email,
              subject: '⚖️ Important: Office Policy Updated',
              html: policyChangeTemplate({
                employeeName: emp.name,
                changeType: changes.map(c => c.type).join(' & '),
                oldValue: changes.map(c => `${c.type}: ${c.old}`).join(' | '),
                newValue: changes.map(c => `${c.type}: ${c.new}`).join(' | '),
                effectiveFrom: new Date().toLocaleDateString('en-IN'),
                updatedBy: req.user.name
              })
            })
          ));
        }
      };

      broadcastUpdate().catch(err => console.error('Policy Update Broadcast failed:', err));
    }

    // --- DYNAMIC CRON RESCHEDULE (ADDED) ---
    // If office timing or grace period changed, re-schedule the absent alert job
    if (changes.some(c => ['Office Start Time', 'Late Grace Period'].includes(c.type))) {
      triggerAbsentReschedule().catch(err => console.error('Absent Reschedule failed:', err));
    }
    // --- END DYNAMIC CRON RESCHEDULE ---
    // --- END EMAIL NOTIFICATION ---

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
