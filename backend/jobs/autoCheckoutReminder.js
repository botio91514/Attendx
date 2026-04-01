const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Leave = require('../models/Leave');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/emailService');
const { checkoutReminderTemplate, absentAlertTemplate } = require('../utils/emailTemplates');

// ─────────────────────────────────────────────
// HELPER: Get today's date string in IST (YYYY-MM-DD)
// ─────────────────────────────────────────────
const getTodayIST = () => {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const [m, d, y] = now.toLocaleDateString('en-US', options).split('/');
  return `${y}-${m}-${d}`;
};

// ─────────────────────────────────────────────
// HELPER: Format a Date to IST time string HH:MM AM/PM
// ─────────────────────────────────────────────
const toISTTimeStr = (date) =>
  new Date(date).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

// ─────────────────────────────────────────────
// HELPER: Format today's date nicely for email
// ─────────────────────────────────────────────
const toISTDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(`${y}-${m}-${d}T00:00:00`);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// ─────────────────────────────────────────────
// HELPER: Check if today is a configured working day
// ─────────────────────────────────────────────
const isTodayWorkingDay = (workingDays) => {
  const now = new Date();
  const dayOfWeek = new Date(now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
  return workingDays.includes(dayOfWeek);
};

// ─────────────────────────────────────────────
// HELPER: Is this employee on approved leave today?
// ─────────────────────────────────────────────
const isOnLeave = async (userId, todayStr) => {
  const leave = await Leave.findOne({
    userId,
    status: 'approved',
    startDate: { $lte: todayStr },
    endDate: { $gte: todayStr }
  });
  return !!leave;
};


// ═════════════════════════════════════════════
// JOB 1: CHECKOUT REMINDER (8:30 PM IST)
//   - Runs at 15:00 UTC = 8:30 PM IST
//   - Finds employees who checked IN but did NOT check OUT
//   - Sends a reminder email with their check-in time
// ═════════════════════════════════════════════
const startCheckoutReminderJob = () => {
  // 00 15 * * * = 15:00 UTC = 8:30 PM IST
  cron.schedule('00 15 * * *', async () => {
    try {
      console.log('⏰ [CRON] Checkout Reminder Job started (8:30 PM IST)...');

      const settings = await Settings.getSettings();
      const todayStr  = getTodayIST();
      const nowIST    = toISTTimeStr(new Date());
      const todayFmt  = toISTDateStr(todayStr);

      // Skip if today is not a working day
      if (!isTodayWorkingDay(settings.workingDays)) {
        console.log('📅 [CRON] Today is not a working day. Skipping checkout reminder.');
        return;
      }

      // Find employees checked in today but no check-out recorded
      const pendingRecords = await Attendance.find({
        date: todayStr,
        checkIn: { $exists: true, $ne: null },
        $or: [
          { checkOut: { $exists: false } },
          { checkOut: null }
        ]
      }).populate('userId', 'name email role isActive');

      if (pendingRecords.length === 0) {
        console.log('✅ [CRON] All employees have checked out. Nothing to do.');
        return;
      }

      console.log(`🔍 [CRON] ${pendingRecords.length} employee(s) have not checked out. Sending reminders...`);

      const results = await Promise.allSettled(
        pendingRecords.map(async (record) => {
          const emp = record.userId;

          // Guard: skip invalid/admin/inactive users
          if (!emp || !emp.isActive || emp.role === 'admin' || !emp.email) return;

          // Skip employees on approved leave
          if (await isOnLeave(emp._id, todayStr)) {
            console.log(`🍃 [CRON] Skipping ${emp.name} — on approved leave.`);
            return;
          }

          // Build and send the email
          const html = checkoutReminderTemplate({
            employeeName : emp.name,
            checkInTime  : toISTTimeStr(record.checkIn),
            todayDate    : todayFmt,
            currentTime  : nowIST
          });

          await sendEmail({
            to      : emp.email,
            subject : '⚠️ AttendX: You haven\'t checked out yet — Action required',
            html
          });

          console.log(`📧 [CRON] Checkout reminder sent → ${emp.name} <${emp.email}>`);
        })
      );

      const sent   = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`✅ [CRON] Checkout reminders done. Sent: ${sent}, Failed: ${failed}`);

    } catch (error) {
      console.error('❌ [CRON] Error in Checkout Reminder Job:', error);
    }
  });

  console.log('🚀 [CRON] Checkout Reminder Job registered (runs daily at 8:30 PM IST).');
};


// ═════════════════════════════════════════════
// JOB 2: ABSENT ALERT (Runs after late grace period every working day)
// ═════════════════════════════════════════════
const startAbsentAlertJob = async () => {
  /**
   * We calculate the exact IST time (officeStart + gracePeriod + 5 min buffer)
   * and schedule a ONE-TIME check for that time every day.
   * We use a daily cron at 00:01 AM IST to re-schedule the job for that day.
   */

  let scheduledAbsentJob = null;

  const scheduleAbsentCheck = async () => {
    try {
      const settings = await Settings.getSettings();
      const [startHour, startMin] = settings.officeStartTime.split(':').map(Number);
      const graceMinutes = settings.lateGracePeriod || 0;

      const totalOffset = graceMinutes + 5;
      let deadlineHour = startHour;
      let deadlineMin  = startMin + totalOffset;

      if (deadlineMin >= 60) {
        deadlineHour += Math.floor(deadlineMin / 60);
        deadlineMin   = deadlineMin % 60;
      }

      let utcHour = deadlineHour - 5;
      let utcMin  = deadlineMin - 30;

      if (utcMin < 0) {
        utcMin  += 60;
        utcHour -= 1;
      }
      if (utcHour < 0) {
        utcHour += 24;
      }

      const cronExpr    = `${utcMin} ${utcHour} * * *`;
      const deadlineStr = `${String(deadlineHour).padStart(2, '0')}:${String(deadlineMin).padStart(2, '0')}`;

      console.log(`📅 [CRON] Absent Alert scheduled at ${deadlineStr} IST (cron: ${cronExpr})`);

      if (scheduledAbsentJob) {
        scheduledAbsentJob.destroy();
        scheduledAbsentJob = null;
      }

      scheduledAbsentJob = cron.schedule(cronExpr, async () => {
        await runAbsentAlertCheck(settings, deadlineStr);
      });

    } catch (err) {
      console.error('❌ [CRON] Failed to schedule Absent Alert Job:', err);
    }
  };

  // ─────────────────────────────────────────────
  // CATCH-UP LOGIC: Run once on startup if we already missed today's deadline
  // ─────────────────────────────────────────────
  const runCatchUpCheck = async () => {
    try {
      const settings = await Settings.getSettings();
      const [startHour, startMin] = settings.officeStartTime.split(':').map(Number);
      const graceMinutes = settings.lateGracePeriod || 0;
      
      const deadline = new Date();
      // IST deadline for today
      deadline.setHours(startHour, startMin + graceMinutes + 5, 0, 0);

      const now = new Date();
      if (now > deadline && isTodayWorkingDay(settings.workingDays)) {
        console.log('🔄 [CRON] Server started after today\'s deadline. Running catch-up Absent Alert check...');
        const deadlineStr = `${String(startHour).padStart(2, '0')}:${String(startMin + graceMinutes + 5).padStart(2, '0')}`;
        await runAbsentAlertCheck(settings, deadlineStr);
      }
    } catch (error) {
      console.error('❌ [CRON] Error in catch-up check:', error);
    }
  };

  // Run the scheduler daily at 12:01 AM IST to pick up new settings
  cron.schedule('31 18 * * *', async () => {
    console.log('🔄 [CRON] Recalculating Absent Alert schedule for tomorrow...');
    await scheduleAbsentCheck();
  });

  // Initialize today's schedule and check if we missed it
  await scheduleAbsentCheck();
  await runCatchUpCheck();

  console.log('🚀 [CRON] Absent Alert Job registered.');
};

const runAbsentAlertCheck = async (settings, deadlineStr) => {
  try {
    console.log(`⏰ [CRON] Absent Alert Job running. Deadline was ${deadlineStr} IST...`);

    const todayStr = getTodayIST();
    const todayFmt = toISTDateStr(todayStr);

    if (!isTodayWorkingDay(settings.workingDays)) {
      console.log('📅 [CRON] Today is not a working day. Skipping absent alert.');
      return;
    }

    const allEmployees = await User.find({
      role    : 'employee',
      isActive: true,
      email   : { $exists: true, $ne: null }
    });

    if (allEmployees.length === 0) return;

    const checkedInToday = await Attendance.find({
      date   : todayStr,
      checkIn: { $exists: true, $ne: null }
    }).select('userId');

    const checkedInIds = new Set(checkedInToday.map(r => r.userId.toString()));

    const absentEmployees = allEmployees.filter(
      emp => !checkedInIds.has(emp._id.toString())
    );

    if (absentEmployees.length === 0) return;

    const results = await Promise.allSettled(
      absentEmployees.map(async (emp) => {
        if (await isOnLeave(emp._id, todayStr)) return;

        const deadlineTimeFmt = (() => {
          const [h, m] = deadlineStr.split(':').map(Number);
          const period = h >= 12 ? 'PM' : 'AM';
          const hour12 = h % 12 || 12;
          return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
        })();

        const html = absentAlertTemplate({
          employeeName     : emp.name,
          todayDate        : todayFmt,
          officeStartTime  : settings.officeStartTime,
          gracePeriodMinutes: settings.lateGracePeriod || 0,
          deadlineTime     : deadlineTimeFmt
        });

        await sendEmail({
          to      : emp.email,
          subject : `🚨 AttendX: You haven't checked in yet — ${todayFmt}`,
          html
        });
      })
    );

    console.log(`✅ [CRON] Absent alerts processed.`);
  } catch (error) {
    console.error('❌ [CRON] Error in Absent Alert Job:', error);
  }
};


// ═════════════════════════════════════════════
// JOB 3: AUTO-CHECKOUT (9:00 PM IST)
//   - Runs at 15:30 UTC = 9:00 PM IST
//   - Automatically checks out anyone still checked in
//   - Sets checkout time to officeEndTime from settings
//   - This ensures attendance records are complete for payroll
// ═════════════════════════════════════════════
const startAutoCheckoutJob = () => {
  // 30 15 * * * = 15:30 UTC = 9:00 PM IST
  cron.schedule('30 15 * * *', async () => {
    try {
      console.log('⏰ [CRON] Auto-Checkout Job started (9:00 PM IST)...');

      const settings = await Settings.getSettings();
      const todayStr = getTodayIST();

      // Find all records that have checkIn but NO checkOut for today
      const pendingRecords = await Attendance.find({
        date: todayStr,
        checkIn: { $exists: true, $ne: null },
        $or: [
          { checkOut: { $exists: false } },
          { checkOut: null }
        ]
      });

      if (pendingRecords.length === 0) {
        console.log('✅ [CRON] All attendance records are already closed for today.');
        return;
      }

      console.log(`🔄 [CRON] Auto-closing ${pendingRecords.length} attendance records...`);

      // Determine default checkout time (officeEndTime)
      const [endHour, endMin] = (settings.officeEndTime || '18:15').split(':').map(Number);
      
      const results = await Promise.allSettled(
        pendingRecords.map(async (record) => {
          // Construct the checkout Date object
          const checkoutDate = new Date();
          // Get today's year/month/day in IST
          const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          checkoutDate.setFullYear(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
          checkoutDate.setHours(endHour, endMin, 0, 0);

          // Update record
          record.checkOut = checkoutDate;
          record.notes = (record.notes ? record.notes + ' ' : '') + '[Auto-Checkout by System at 9 PM]';
          
          record._settings = settings; 
          await record.save();
        })
      );

      console.log(`✅ [CRON] Auto-checkout completed for ${results.length} employees.`);
    } catch (error) {
      console.error('❌ [CRON] Error in Auto-Checkout Job:', error);
    }
  });

  console.log('🚀 [CRON] Auto-Checkout Job registered (runs daily at 9:00 PM IST).');
};


module.exports = { 
  startCheckoutReminderJob, 
  startAbsentAlertJob, 
  startAutoCheckoutJob 
};
