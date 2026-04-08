const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Leave = require('../models/Leave');
const Settings = require('../models/Settings');
const Task = require('../models/Task');
const WorkSession = require('../models/WorkSession');
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
// JOB 1: CHECKOUT REMINDER (6:20 PM IST)
//   - Finds employees who checked IN but did NOT check OUT
// ═════════════════════════════════════════════
const startCheckoutReminderJob = () => {
  // 20 18 * * * = 6:20 PM IST
  cron.schedule('20 18 * * *', async () => {
    try {
      console.log('⏰ [CRON] Checkout Reminder Job started (6:20 PM IST)...');

      const settings = await Settings.getSettings();
      const todayStr  = getTodayIST();
      const nowIST    = toISTTimeStr(new Date());
      const todayFmt  = toISTDateStr(todayStr);

      // Skip if today is not a working day
      if (!isTodayWorkingDay(settings.workingDays)) {
        console.log(`📅 [CRON] ${todayStr} is not a working day. Skipping reminder.`);
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

      console.log(`🔍 [CRON] Found ${pendingRecords.length} records without checkout for today.`);

      const results = await Promise.allSettled(
        pendingRecords.map(async (record) => {
          const emp = record.userId;

          if (!emp) {
            console.log('⚠️ [CRON] Record missing userId logic.');
            return;
          }
          
          if (!emp.isActive) {
            console.log(`⏭️ [CRON] Skipping inactive user: ${emp.name}`);
            return;
          }
          
          if (emp.role === 'admin') {
            console.log(`⏭️ [CRON] Skipping admin: ${emp.name}`);
            return;
          }
          
          if (!emp.email) {
            console.log(`⚠️ [CRON] Skipping user without email: ${emp.name}`);
            return;
          }

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

          console.log(`📧 [CRON] Reminder sent → ${emp.name}`);
        })
      );

      console.log(`✅ [CRON] Reminder job done. Success: ${results.filter(r => r.status === 'fulfilled').length}`);

    } catch (error) {
      console.error('❌ [CRON] Error in Checkout Reminder Job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('🚀 [CRON] Checkout Reminder Job registered (runs daily at 6:20 PM IST).');
};


// ═════════════════════════════════════════════
// JOB 2: ABSENT ALERT (Runs after late grace period every working day)
// ═════════════════════════════════════════════
const startAbsentAlertJob = async () => {
  /**
   * We calculate the exact IST time (officeStart + gracePeriod + 5 min buffer)
   * and schedule a ONE-TIME check for that time every day.
   * We use a daily cron at 12:01 AM IST to re-schedule the job for that day.
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

      const cronExpr    = `${deadlineMin} ${deadlineHour} * * *`;
      const deadlineStr = `${String(deadlineHour).padStart(2, '0')}:${String(deadlineMin).padStart(2, '0')}`;

      console.log(`📅 [CRON] Absent Alert scheduled at ${deadlineStr} IST (cron: ${cronExpr})`);

      if (scheduledAbsentJob) {
        scheduledAbsentJob.destroy();
        scheduledAbsentJob = null;
      }

      scheduledAbsentJob = cron.schedule(cronExpr, async () => {
        await runAbsentAlertCheck(settings, deadlineStr);
      }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
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
  cron.schedule('01 00 * * *', async () => {
    console.log('🔄 [CRON] Recalculating Absent Alert schedule for tomorrow...');
    await scheduleAbsentCheck();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
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
        // Skip employees on approved leave (they get 'leave' status, not 'absent')
        if (await isOnLeave(emp._id, todayStr)) {
          // Create a leave record if not already present
          await Attendance.findOneAndUpdate(
            { userId: emp._id, date: todayStr },
            { $setOnInsert: { userId: emp._id, date: todayStr, status: 'leave' } },
            { upsert: true, new: true }
          );
          console.log(`🍃 [CRON] ${emp.name} is on leave — marked as 'leave'.`);
          return;
        }

        // ✅ Create ABSENT record in DB (upsert = safe, won't duplicate)
        const record = await Attendance.findOneAndUpdate(
          { userId: emp._id, date: todayStr },
          {
            $setOnInsert: {
              userId: emp._id,
              date: todayStr,
              status: 'absent',
              checkIn: null,
              checkOut: null,
              totalWorkingHours: 0
            }
          },
          { upsert: true, new: true }
        );

        console.log(`🚨 [CRON] Marked ${emp.name} as ABSENT for ${todayStr}.`);

        // Send email notification
        if (emp.email) {
          const deadlineTimeFmt = (() => {
            const [h, m] = deadlineStr.split(':').map(Number);
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
          })();

          const html = absentAlertTemplate({
            employeeName      : emp.name,
            todayDate         : todayFmt,
            officeStartTime   : settings.officeStartTime,
            gracePeriodMinutes: settings.lateGracePeriod || 0,
            deadlineTime      : deadlineTimeFmt
          });

          await sendEmail({
            to     : emp.email,
            subject: `🚨 AttendX: You have been marked Absent — ${todayFmt}`,
            html
          });
        }
      })
    );

    const marked  = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ [CRON] Absent Alert done — ${marked} employee(s) marked absent.`);
  } catch (error) {
    console.error('❌ [CRON] Error in Absent Alert Job:', error);
  }
};


// ═════════════════════════════════════════════
// JOB 3: AUTO-CHECKOUT (6:30 PM IST)
//   - Automatically checks out anyone still checked in
// ═════════════════════════════════════════════
const startAutoCheckoutJob = () => {
  // 30 18 * * * = 6:30 PM IST
  cron.schedule('30 18 * * *', async () => {
    try {
      console.log('⏰ [CRON] Auto-Checkout Job started (6:30 PM IST)...');

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
          // 🏆 Construct the correct UTC date from IST office end time
          // If officeEndTime is 18:30 (IST), we want a UTC Date where (UTC Time + 5.5h) = 18:30
          const [endH, endM] = (settings.officeEndTime || '18:15').split(':').map(Number);
          
          const now = new Date();
          const istOffset = 5.5 * 60 * 60 * 1000;
          
          // 1. Get today's date in IST
          const istDate = new Date(now.getTime() + istOffset);
          // 2. Set the desired IST clock time on this IST day (using UTC methods on the offsetted date)
          istDate.setUTCHours(endH, endM, 0, 0);
          // 3. Convert back to absolute UTC by subtracting the offset
          const checkoutDate = new Date(istDate.getTime() - istOffset);

          // Update record
          record.checkOut = checkoutDate;
          record.notes = (record.notes ? record.notes + ' ' : '') + `[Auto-Checkout by System at ${settings.officeEndTime || '18:15'} IST]`;
          
          record._settings = settings; 
          await record.save();

          // ── Auto-pause any in-progress tasks for this user ──────
          try {
            const activeTasks = await Task.find({
              assignedTo: record.userId,
              status: 'in-progress'
            });

            for (const task of activeTasks) {
              const session = await WorkSession.findOne({
                taskId: task._id,
                endTime: null
              });
              if (session) {
                // Cap the session at the office end time (not current time)
                session.endTime = checkoutDate;
                session.duration = Math.max(
                  0,
                  Math.floor((session.endTime - session.startTime) / 1000)
                );
                await session.save();
                task.totalTime += session.duration;
              }
              task.status = 'paused';
              await task.save();
              console.log(`⏸️ [CRON] Auto-paused task "${task.title}" for user ${record.userId}`);
            }
          } catch (taskErr) {
            console.error('⚠️ [CRON] Task auto-pause failed during auto-checkout:', taskErr);
          }
          // ────────────────────────────────────────────────────────
        })
      );

      console.log(`✅ [CRON] Auto-checkout completed for ${results.length} employees.`);
    } catch (error) {
      console.error('❌ [CRON] Error in Auto-Checkout Job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('🚀 [CRON] Auto-Checkout Job registered (runs daily at 6:30 PM IST).');
};


module.exports = { 
  startCheckoutReminderJob, 
  startAbsentAlertJob, 
  startAutoCheckoutJob 
};
