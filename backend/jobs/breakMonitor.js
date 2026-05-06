const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');
const { breakExceededTemplate } = require('../utils/emailTemplates');
const { getTodayDate } = require('../utils/attendanceHelpers');
const { emitToUser } = require('../socket/socketManager.js');

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
      const { toIST } = require('../utils/timeUtils');
      const now = toIST(new Date());

      // 1. Find employees currently on break (using authoritative array)
      const activeBreaks = await Attendance.find({
        date: today,
        'breaks.breakEnd': null
      }).populate('userId', 'name email');


      for (const record of activeBreaks) {
        const ongoing = record.breaks.find(b => !b.breakEnd);
        if (!ongoing) continue;

        const startTime = ongoing.breakStart;
        const startTimeDate = new Date(startTime);
        const currentSessionMinutes = Math.floor((now - startTimeDate) / 60000);
        
        // 🛡️ STALE SESSION DETECTION (Quarantine)
        // If a break is active for > 6 hours, mark as corrupted and auto-close (safety)
        if (currentSessionMinutes > 360) {
           console.warn(`[Audit] Stale break session detected for ${record.userId?.name}. Quarantining.`);
           record.isCorrupted = true;
           record.corruptionReason = `Stale break: Active for ${currentSessionMinutes}m`;
           record.corruptedAt = new Date();
           
           // Force close at policy limit to isolate payroll damage
           ongoing.breakEnd = now;
           ongoing.duration = allowedMinutes;
           record.break.isOnBreak = false;
           await record.save();
           continue;
        }

        const totalElapsedMinutes = record.getBreakMinutes() + currentSessionMinutes;

        // Skip if already alerted
        if (record.break.alertSent) continue;


        if (totalElapsedMinutes > allowedMinutes) {
          // 1. Mark as exceeded and alert sent (prevent repeat)
          record.break.exceededPolicy = true;
          record.break.alertSent = true;
          await record.save();

          // 2. Send Email Alert
          if (record.userId && record.userId.email) {
            const { formatISTTime } = require('../utils/timeUtils');
            const istTime = formatISTTime(startTime);

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

          // --- SOCKET EMIT (ADDED) ---
          emitToUser(record.userId._id, 'notification:new', {
            type: 'break_alert',
            title: '⚠️ Break Time Exceeded',
            message: `You have exceeded your allowed break time. Please return immediately.`,
            link: '/dashboard'
          });

          emitToUser(record.userId._id, 'break:exceeded', {
            breakStartTime: record.break.startTime,
            elapsedMinutes: totalElapsedMinutes,
            allowedMinutes: allowedMinutes
          });
          // --- END SOCKET EMIT ---
        }
      }
    } catch (error) {
      console.error('[BreakMonitor] Job error:', error);
    }
  });

  console.log('[BreakMonitor] Background job registered (Every 1 minute)');
};

module.exports = { startBreakMonitorJob };
