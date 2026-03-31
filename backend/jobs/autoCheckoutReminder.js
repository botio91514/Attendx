const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Leave = require('../models/Leave');
const { sendEmail } = require('../utils/emailService');
const { checkoutReminderTemplate } = require('../utils/emailTemplates');

/**
 * @desc    node-cron job: Runs at 11:00 PM IST (5:30 PM UTC) every night.
 *          Finds employees checked in today but no checkOut.
 */
const startCheckoutReminderJob = () => {
  // Cron for 11:00 PM IST (5:30 PM UTC / 17:30 UTC): '30 17 * * *'
  cron.schedule('30 17 * * *', async () => {
    try {
      console.log('⏰ Starting 11 PM Checkout Reminder Cron Job (UTC 17:30)...');
      
      // Calculate today string in IST (YYYY-MM-DD)
      const now = new Date();
      const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
      const [m, d, y] = now.toLocaleDateString('en-US', options).split('/');
      const todayStr = `${y}-${m}-${d}`;

      // 🏆 Query Attendance: Checked in today but NO checkOut
      const pendingRecords = await Attendance.find({
        date: todayStr,
        checkIn: { $exists: true },
        checkOut: { $exists: false }
      }).populate('userId', 'name email role isActive');

      if (pendingRecords.length === 0) {
        console.log('✅ All employees checked out for today.');
        return;
      }

      console.log(`🔍 Found ${pendingRecords.length} pending checkouts. Checking leave status...`);

      // 🏆 Parallel check for each record
      await Promise.allSettled(pendingRecords.map(async (record) => {
        const emp = record.userId;
        if (!emp || !emp.isActive || emp.role === 'admin' || !emp.email) return;

        // 🏆 Skip if employee is on Approved Leave today
        const onLeave = await Leave.findOne({
          userId: emp._id,
          status: 'approved',
          startDate: { $lte: todayStr },
          endDate: { $gte: todayStr }
        });

        if (onLeave) {
          console.log(`🍃 Skipping ${emp.name} (On approved leave)`);
          return;
        }

        // 🏆 Send Email Reminder
        const checkInTimeStr = new Date(record.checkIn).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit'
        });

        const currentTimeStr = now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit'
        });

        const html = checkoutReminderTemplate({
          employeeName: emp.name,
          checkInTime: checkInTimeStr,
          currentTime: currentTimeStr
        });

        await sendEmail({
          to: emp.email,
          subject: '🔔 Attendance Reminder: Please log your checkout',
          html
        });
      }));

      console.log('✅ Checkout reminder emails sent.');
    } catch (error) {
      console.error('❌ Error in Checkout Reminder Cron:', error);
    }
  });

  console.log('🚀 11 PM IST Checkout Reminder Job Registered Successfully.');
};

module.exports = { startCheckoutReminderJob };
