const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');
const { breakExceededTemplate } = require('../utils/emailTemplates');
const { getTodayDate } = require('../utils/attendanceHelpers');

/**
 * @desc    Background job to monitor breaks and alert if policy exceeded
 */
const startBreakMonitorJob = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const today = getTodayDate();
      const settings = await Settings.getSettings();
      const allowedMinutes = settings.breakDurationMinutes || 60;
      const now = new Date();

      // Find employees currently on break who haven't been alerted yet
      const activeBreaks = await Attendance.find({
        date: today,
        'break.isOnBreak': true,
        'break.alertSent': false
      }).populate('userId', 'name email');

      for (const record of activeBreaks) {
        const startTime = new Date(record.break.startTime);
        const currentSessionMinutes = Math.floor((now - startTime) / 60000);
        const totalElapsedMinutes = (record.break.durationMinutes || 0) + currentSessionMinutes;

        if (totalElapsedMinutes > allowedMinutes) {
          // 1. Mark as exceeded and alert sent (prevent repeat)
          record.break.exceededPolicy = true;
          record.break.alertSent = true;
          await record.save();

          // 2. Send Email Alert
          if (record.userId && record.userId.email) {
            const istTime = startTime.toLocaleTimeString('en-IN', { 
              timeZone: 'Asia/Kolkata',
              hour: '2-digit', 
              minute: '2-digit' 
            });

            sendEmail({
              to: record.userId.email,
              subject: '⚠️ Break Time Exceeded — Please Return',
              html: breakExceededTemplate({
                employeeName: record.userId.name,
                breakStartTime: istTime,
                allowedMinutes,
                elapsedMinutes: totalElapsedMinutes
              })
            }).catch(err => console.error('Break Alert Email failed:', err));
          }

          console.log(`[BreakMonitor] Alert sent to ${record.userId?.name} (Total: ${totalElapsedMinutes}min)`);

          // 3. Send In-App Notification (Added)
          try {
            const admin = await User.findOne({ role: 'admin' });
            if (admin) {
              await Notification.create({
                recipient: record.userId._id,
                sender: admin._id,
                type: 'announcement', // Schema-compatible type
                title: '⚡ Break Time Exceeded',
                message: `You have been on break for ${totalElapsedMinutes}m (Limit: ${allowedMinutes}m). Please return to work.`,
                link: '/dashboard',
                targetRole: 'employee'
              });
            }
          } catch (notifErr) {
            console.error('Failed to create in-app notification:', notifErr);
          }
        }
      }
    } catch (error) {
      console.error('[BreakMonitor] Job error:', error);
    }
  });

  console.log('[BreakMonitor] Background job registered (Every 1 minute)');
};

module.exports = { startBreakMonitorJob };
