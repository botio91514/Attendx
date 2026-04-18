const mongoose = require('mongoose');
const User = require('../models/User');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');

const MONGO_URI = "mongodb+srv://gatistwamgroup_db_user:NUgKDcOcQFvnGqtj@gatistwam.mnpuwmn.mongodb.net/test?appName=Gatistwam";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const users = await User.find({});
        console.log(`Reconciling balances for ${users.length} users...`);

        for (const user of users) {
          // Reset balance for 2026
          await LeaveBalance.findOneAndUpdate(
            { userId: user._id, year: 2026 },
            { $set: { 'casual.used': 0, 'sick.used': 0, 'religious.used': 0, 'unpaid.used': 0 } },
            { upsert: true }
          );

          const approvedLeaves = await Leave.find({ userId: user._id, status: 'approved' });
          
          let cl = 0, sl = 0, rl = 0, lwp = 0;
          for (const lv of approvedLeaves) {
            cl += (lv.clDays || 0);
            sl += (lv.slDays || 0);
            rl += (lv.rlDays || 0);
            lwp += (lv.lwpDays || 0);
          }

          if (cl > 0 || sl > 0 || rl > 0 || lwp > 0) {
            await LeaveBalance.findOneAndUpdate(
              { userId: user._id, year: 2026 },
              { $set: { 
                  'casual.used': cl, 
                  'sick.used': sl, 
                  'religious.used': rl, 
                  'unpaid.used': lwp 
              } }
            );
            console.log(`Updated ${user.name}: CL:${cl}, SL:${sl}, RL:${rl}, LWP:${lwp}`);
          }
        }

        console.log('Reconciliation Complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
