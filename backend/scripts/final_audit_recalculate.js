const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const User = require('../models/User');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const { calculateAccrualBalance } = require('../utils/leaveHelpers');

async function finalAuditRecalculate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('connected to database');

    const employees = await User.find({ role: 'employee' });
    const currentYear = new Date().getFullYear();

    for (const e of employees) {
      // 1. Calculate Actual Used from Leave Records (Approved only)
      const approvedLeaves = await Leave.find({ 
        userId: e._id, 
        status: 'approved',
        startDate: { $gte: new Date(currentYear, 0, 1) } // Only this year
      });

      const actualUsed = approvedLeaves.reduce((acc, lv) => {
        acc.cl += (lv.clDays || 0);
        acc.sl += (lv.slDays || 0);
        acc.rl += (lv.rlDays || 0);
        acc.lwp += (lv.lwpDays || 0);
        return acc;
      }, { cl: 0, sl: 0, rl: 0, lwp: 0 });

      // 2. Update LeaveBalance
      await LeaveBalance.findOneAndUpdate(
        { userId: e._id, year: currentYear },
        { 
          $set: { 
            'casual.used': actualUsed.cl,
            'sick.used': actualUsed.sl,
            'religious.used': actualUsed.rl,
            'unpaid.used': actualUsed.lwp,
            'casual.total': 12,
            'sick.total': 6,
            'religious.total': 2
          }
        },
        { upsert: true }
      );

      console.log(`✅ RECALCULATED: ${e.name} | Used -> CL:${actualUsed.cl}, SL:${actualUsed.sl}, LWP:${actualUsed.lwp}`);
    }

    console.log('Final Database Audit Complete. All balances are now perfectly synchronized with historic records.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

finalAuditRecalculate();
