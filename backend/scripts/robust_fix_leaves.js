const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Attendance = require('../models/Attendance');
const { getDatesBetween } = require('../utils/leaveHelpers');

const robustFixLeaves = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const now = new Date();
    const currentYear = now.getFullYear();

    // 1. First, ensure all approved leaves have a dailyBreakdown
    console.log('Step 0: Ensuring all leaves have dailyBreakdown...');
    const allApproved = await Leave.find({ status: 'approved' });
    
    for (const lv of allApproved) {
      if (!lv.dailyBreakdown || lv.dailyBreakdown.length === 0) {
        const dates = getDatesBetween(lv.startDate, lv.endDate);
        const breakdown = [];
        let cl = lv.clDays || 0;
        let sl = lv.slDays || 0;
        let rl = lv.rlDays || 0;
        let lwp = lv.lwpDays || 0;

        for (const date of dates) {
          let type = 'lwp';
          const inc = lv.isHalfDay ? 0.5 : 1;
          
          if (cl >= inc) { type = 'cl'; cl -= inc; }
          else if (sl >= inc) { type = 'sl'; sl -= inc; }
          else if (rl >= inc) { type = 'rl'; rl -= inc; }
          else { type = 'lwp'; lwp -= inc; }
          
          breakdown.push({ date, leaveType: type });
        }
        lv.dailyBreakdown = breakdown;
        await lv.save();
      }
    }
    console.log('Sync complete.');

    // 2. RESET YEARLY BALANCE for current year (to be recalculated)
    console.log('Step 1: Resetting current year balances...');
    await LeaveBalance.updateMany({ year: currentYear }, { 
      $set: { 'casual.used': 0, 'sick.used': 0, 'religious.used': 0, 'unpaid.used': 0 } 
    });

    // 3. Process each employee chronologically across the WHOLE YEAR to enforce limits
    const employees = await User.find({ role: 'employee' });
    
    for (const emp of employees) {
      console.log(`Auditing: ${emp.name}`);
      const leaves = await Leave.find({ userId: emp._id, status: 'approved' }).sort({ startDate: 1 });
      
      const monthlyUsage = {}; // "YYYY-MM" -> { cl, sl }

      for (const lv of leaves) {
        let updated = false;
        let newCL = 0, newSL = 0, newRL = 0, newLWP = 0;
        const newDaily = [];

        for (const day of lv.dailyBreakdown) {
          const monthKey = day.date.slice(0, 7);
          if (!monthlyUsage[monthKey]) monthlyUsage[monthKey] = { cl: 0, sl: 0 };
          
          const inc = lv.isHalfDay ? 0.5 : 1;
          let type = day.leaveType;

          if (type === 'cl') {
            if (monthlyUsage[monthKey].cl + inc <= 1) {
              monthlyUsage[monthKey].cl += inc;
              newCL += inc;
            } else {
              type = 'lwp';
              newLWP += inc;
              updated = true;
            }
          } else if (type === 'sl') {
            if (monthlyUsage[monthKey].sl + inc <= 0.5) {
              monthlyUsage[monthKey].sl += inc;
              newSL += inc;
            } else {
              type = 'lwp';
              newLWP += inc;
              updated = true;
            }
          } else if (type === 'rl') {
            newRL += inc;
          } else {
            newLWP += inc;
          }
          newDaily.push({ date: day.date, leaveType: type });
        }

        if (updated) {
          lv.clDays = newCL;
          lv.slDays = newSL;
          lv.rlDays = newRL;
          lv.lwpDays = newLWP;
          lv.dailyBreakdown = newDaily;
          await lv.save();
          
          // Update Attendance notes for converted days
          for (const d of newDaily) {
             if (d.leaveType === 'lwp') {
                await Attendance.findOneAndUpdate(
                  { userId: emp._id, date: d.date },
                  { $set: { notes: `Strict Policy Enforcement: Converted to LWP (Limit exceeded)` } }
                );
             }
          }
        }
      }

      // Re-calculate Final Balance
      const finalLeaves = await Leave.find({ userId: emp._id, status: 'approved' });
      let tCL = 0, tSL = 0, tRL = 0, tLWP = 0;
      finalLeaves.forEach(l => {
        tCL += (l.clDays || 0);
        tSL += (l.slDays || 0);
        tRL += (l.rlDays || 0);
        tLWP += (l.lwpDays || 0);
      });

      await LeaveBalance.findOneAndUpdate(
        { userId: emp._id, year: currentYear },
        { $set: { 'casual.used': tCL, 'sick.used': tSL, 'religious.used': tRL, 'unpaid.used': tLWP } },
        { upsert: true }
      );
    }

    console.log('DONE.');
    process.exit(0);
  } catch (error) {
    console.error('CRASH:', error);
    process.exit(1);
  }
};

robustFixLeaves();
