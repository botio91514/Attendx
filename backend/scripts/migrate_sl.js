const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const LeaveBalance = require('../models/LeaveBalance');
const Payroll = require('../models/Payroll');
const User = require('../models/User');

async function migrateSL() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const affectedUsers = new Set();
    const affectedMonths = new Set(); // Format: "YYYY-MM"

    // 1. Find all Leave records that have SL fractions or are marked as half-day SL
    const leaves = await Leave.find({
      $or: [
        { slDays: { $mod: [1, 0.5] } }, // records where slDays % 1 != 0 (e.g. 0.5, 1.5)
        { $and: [{ leaveType: 'sick' }, { isHalfDay: true }] }
      ],
      status: 'approved'
    });

    console.log(`Found ${leaves.length} approved leave records with partial SL to migrate.`);

    for (const leave of leaves) {
      console.log(`Processing Leave ID: ${leave._id} for User: ${leave.userId}`);
      affectedUsers.add(leave.userId.toString());

      let newSlDays = 0;
      let newLwpDays = 0;
      const newDailyBreakdown = [];

      // Group breakdown by date to merge SL and LWP if needed
      const dateMap = {};
      for (const item of leave.dailyBreakdown) {
        if (!dateMap[item.date]) dateMap[item.date] = { sl: 0, lwp: 0, cl: 0, rl: 0 };
        dateMap[item.date][item.leaveType] += item.days;
      }

      for (const [date, meta] of Object.entries(dateMap)) {
        let finalSL = meta.sl;
        let finalLWP = meta.lwp;

        if (meta.sl > 0 && meta.sl < 1) {
          // Rule: Convert 0.5 SL -> 1.0 SL. Remove corresponding LWP if any.
          const shortage = 1.0 - meta.sl;
          finalSL = 1.0;
          finalLWP = Math.max(0, meta.lwp - shortage);
          console.log(`  - Combined partial SL at ${date}: SL ${meta.sl}->1.0, LWP ${meta.lwp}->${finalLWP}`);
        }

        if (finalSL > 0) newDailyBreakdown.push({ date, leaveType: 'sl', days: finalSL });
        if (finalLWP > 0) newDailyBreakdown.push({ date, leaveType: 'lwp', days: finalLWP });
        if (meta.cl > 0) newDailyBreakdown.push({ date, leaveType: 'cl', days: meta.cl });
        if (meta.rl > 0) newDailyBreakdown.push({ date, leaveType: 'rl', days: meta.rl });

        newSlDays += finalSL;
        newLwpDays += finalLWP;
        
        affectedMonths.add(date.slice(0, 7));
      }

      // Update Leave record
      leave.slDays = newSlDays;
      leave.lwpDays = newLwpDays;
      leave.dailyBreakdown = newDailyBreakdown;
      if (leave.leaveType === 'sick') leave.isHalfDay = false;
      leave.totalDays = newSlDays + newLwpDays + leave.clDays + leave.rlDays;
      
      await leave.save();

      // 2. Sync Attendance
      for (const [date, meta] of Object.entries(dateMap)) {
        const attendance = await Attendance.findOne({ userId: leave.userId, date });
        if (attendance) {
          // Re-calculate leaveMeta from the new record's dailyBreakdown for this date
          const dayMeta = { cl: 0, sl: 0, rl: 0, lwp: 0 };
          newDailyBreakdown.filter(i => i.date === date).forEach(i => {
             dayMeta[i.leaveType] = i.days;
          });
          
          attendance.leaveMeta = dayMeta;
          // Force status to leave if total is >= 1.0 (which it should be now)
          if ((dayMeta.cl + dayMeta.sl + dayMeta.rl + dayMeta.lwp) >= 1.0) {
            attendance.status = 'leave';
          }
          await attendance.save();
        }
      }
    }

    // 3. Recalculate Balance for all affected users
    console.log('Recalculating Leave Balances...');
    for (const userId of affectedUsers) {
      const currentYear = new Date().getFullYear();
      const userLeaves = await Leave.find({ userId, status: 'approved' });
      
      const used = { cl: 0, sl: 0, rl: 0, lwp: 0 };
      userLeaves.forEach(lv => {
        used.cl += (lv.clDays || 0);
        used.sl += (lv.slDays || 0);
        used.rl += (lv.rlDays || 0);
        used.lwp += (lv.lwpDays || 0);
      });

      await LeaveBalance.findOneAndUpdate(
        { userId, year: currentYear },
        { 
          $set: { 
            'casual.used': used.cl,
            'sick.used': used.sl,
            'religious.used': used.rl,
            'unpaid.used': used.lwp
          } 
        },
        { upsert: true }
      );
      console.log(`  - Balanced restored for user ${userId}`);
    }

    // 4. Handle Payroll (Recalculate affected months)
    console.log('Affected Months:', Array.from(affectedMonths));
    for (const monthStr of affectedMonths) {
      const [year, month] = monthStr.split('-').map(Number);
      // Logic to trigger payroll recalculation or just warn
      // In this system, Payroll has a "status" or "isFinalized".
      // Let's check for finalized payrolls in these months.
      const finalizedPayload = await Payroll.findOne({ month, year });
      if (finalizedPayload) {
        console.log(`  [WARNING] Payroll for ${monthStr} is already generated. You may need to RE-GENERATE it.`);
      }
    }

    console.log('Migration Completed Successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateSL();
