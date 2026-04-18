const mongoose = require('mongoose');
const User = require('../models/User');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');

const MONGO_URI = "mongodb+srv://gatistwamgroup_db_user:NUgKDcOcQFvnGqtj@gatistwam.mnpuwmn.mongodb.net/test?appName=Gatistwam";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const gopal = await User.findOne({ name: /Gopal/i });
        if (!gopal) {
            console.log('Gopal not found');
            const all = await User.find({}).select('name');
            console.log('Available users:', all);
            process.exit(0);
        }

        console.log('Gopal ID:', gopal._id);
        const balance = await LeaveBalance.findOne({ userId: gopal._id, year: 2026 });
        console.log('Balance:', JSON.stringify(balance, null, 2));

        const leaves = await Leave.find({ userId: gopal._id }).sort({ startDate: 1 });
        console.log('Leaves Summary:');
        leaves.forEach(l => {
            console.log(`- ${l.startDate.toISOString().split('T')[0]}: ${l.leaveType} (${l.status}) | CL: ${l.clDays}, SL: ${l.slDays}, LWP: ${l.lwpDays}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
