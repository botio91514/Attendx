const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Leave = require('../models/Leave');

async function fixLegacyLeaves() {
  try {
    // 1. Connect to DB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const leaves = await Leave.find({});
    console.log(`📊 Processing ${leaves.length} leave records...`);

    let updatedCount = 0;

    for (const leave of leaves) {
      let changed = false;

      // 🛡️ RECOVERY 1: If breakdown fields are missing/zero but leaveType exists
      const hasBreakdown = (leave.clDays || 0) + (leave.slDays || 0) + (leave.rlDays || 0) + (leave.lwpDays || 0) > 0;
      
      if (!hasBreakdown && leave.totalDays > 0) {
        console.log(`[FIX] Populating breakdown for Leave ID: ${leave._id} (${leave.leaveType})`);
        
        const type = leave.leaveType === 'earned' ? 'casual' : (leave.leaveType || 'casual').toLowerCase();

        if (type === 'casual') leave.clDays = leave.totalDays;
        else if (type === 'sick') leave.slDays = leave.totalDays;
        else if (type === 'religious') leave.rlDays = leave.totalDays;
        else if (type === 'unpaid') leave.lwpDays = leave.totalDays;
        else {
          // Assume CL for everything else
          leave.clDays = leave.totalDays;
        }

        // 🛡️ Fix invalid leaveType enum if necessary
        if (leave.leaveType === 'earned') {
          leave.leaveType = 'casual';
        }
        
        changed = true;
      }

      // 🛡️ RECOVERY 2: If dailyBreakdown is missing but yearBreakdown (dates) exists
      if ((!leave.dailyBreakdown || leave.dailyBreakdown.length === 0) && leave.yearBreakdown) {
        const allDates = [];
        for (const [year, dates] of leave.yearBreakdown) {
          dates.forEach(d => allDates.push(d));
        }
        
        if (allDates.length > 0) {
          console.log(`[FIX] Populating dailyBreakdown for Leave ID: ${leave._id}`);
          
          // Re-map types based on totals
          let clRem = leave.clDays || 0;
          let slRem = leave.slDays || 0;
          let rlRem = leave.rlDays || 0;
          
          leave.dailyBreakdown = allDates.map(date => {
            let type = 'lwp';
            if (clRem > 0) { type = 'cl'; clRem--; }
            else if (slRem > 0) { type = 'sl'; slRem--; }
            else if (rlRem > 0) { type = 'rl'; rlRem--; }
            return { date, leaveType: type };
          });
          changed = true;
        }
      }

      if (changed) {
        await leave.save();
        updatedCount++;
      }
    }

    console.log(`✨ Finished! Updated ${updatedCount} records.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

fixLegacyLeaves();
