const mongoose = require('mongoose');
const User = require('../models/User');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Attendance = require('../models/Attendance');
const { distributeLeave } = require('../utils/leaveHelpers');

const MONGO_URI = "mongodb+srv://gatistwamgroup_db_user:NUgKDcOcQFvnGqtj@gatistwam.mnpuwmn.mongodb.net/test?appName=Gatistwam";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const gopal = await User.findOne({ name: /Gopal/i });
        if (!gopal) { console.log('Gopal not found'); process.exit(1); }

        console.log(`Fixing Gopal's April Sick Leaves...`);

        // 1. Fetch his 2026-04-11 leave
        const lv11 = await Leave.findOne({ userId: gopal._id, startDate: new Date('2026-04-11') });
        if (lv11) {
            console.log('Found Apr 11 leave. Recalculating breakdown...');
            // Force 0.5 SL + 0.5 LWP for this specific day
            lv11.slDays = 0.5;
            lv11.lwpDays = 0.5;
            lv11.dailyBreakdown = [
                { date: '2026-04-11', leaveType: 'sl', days: 0.5 },
                { date: '2026-04-11', leaveType: 'lwp', days: 0.5 }
            ];
            await lv11.save();
            
            // Sync to Attendance
            await Attendance.findOneAndUpdate(
                { userId: gopal._id, date: '2026-04-11' },
                { $set: { leaveMeta: { cl: 0, sl: 0.5, rl: 0, lwp: 0.5 }, status: 'leave' } },
                { upsert: true }
            );
            console.log('Apr 11 Fixed.');
        }

        // 2. Fetch his 2026-04-13 leave (Wait, if he already used 0.5 SL on Apr 11, this stays LWP)
        const lv13 = await Leave.findOne({ userId: gopal._id, startDate: new Date('2026-04-13') });
        if (lv13) {
            console.log('Checking Apr 13 leave...');
            lv13.slDays = 0;
            lv13.lwpDays = 1;
            lv13.dailyBreakdown = [
                { date: '2026-04-13', leaveType: 'lwp', days: 1 }
            ];
            await lv13.save();
            
            await Attendance.findOneAndUpdate(
                { userId: gopal._id, date: '2026-04-13' },
                { $set: { leaveMeta: { cl: 0, sl: 0, rl: 0, lwp: 1 }, status: 'leave' } },
                { upsert: true }
            );
            console.log('Apr 13 Confirmed as Full LWP (Monthly SL Quota spent on Apr 11).');
        }

        // 3. Final Reconciliation for Balances
        console.log('Running final balance reconciliation...');
        const approvedLeaves = await Leave.find({ userId: gopal._id, status: 'approved' });
        let cl = 0, sl = 0, rl = 0, lwp = 0;
        for (const lv of approvedLeaves) {
            cl += (lv.clDays || 0);
            sl += (lv.slDays || 0);
            rl += (lv.rlDays || 0);
            lwp += (lv.lwpDays || 0);
        }
        await LeaveBalance.findOneAndUpdate(
            { userId: gopal._id, year: 2026 },
            { $set: { 'casual.used': cl, 'sick.used': sl, 'religious.used': rl, 'unpaid.used': lwp } }
        );

        console.log(`Gopal Updated: CL:${cl}, SL:${sl}, RL:${rl}, LWP:${lwp}`);
        console.log('Operation Successful.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
