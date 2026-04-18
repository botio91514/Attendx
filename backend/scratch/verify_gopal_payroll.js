const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');

const fetchPayrollStatsGopal = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const gopal = await User.findOne({ employeeId: 'EMP002' });
        if (!gopal) {
            console.log('Gopal not found');
            process.exit(0);
        }

        const m = 4; // April
        const y = 2026;
        const startStr = '2026-04-01';
        const endStr = '2026-04-30';

        const leaves = await Leave.find({
            userId: gopal._id,
            status: 'approved',
            startDate: { $lte: endStr },
            endDate: { $gte: startStr }
        });

        let lwp = 0;
        let cl = 0;
        let sl = 0;
        
        leaves.forEach(lv => {
            lv.dailyBreakdown.forEach(day => {
                if (day.date.startsWith('2026-04')) {
                    const val = day.days || (lv.isHalfDay ? 0.5 : 1);
                    if (day.leaveType === 'cl') cl += val;
                    if (day.leaveType === 'sl') sl += val;
                    if (day.leaveType === 'lwp') lwp += val;
                }
            });
        });

        console.log(`Gopal Payroll Stats (April):`);
        console.log(`CL: ${cl}`);
        console.log(`SL: ${sl}`);
        console.log(`LWP: ${lwp}`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fetchPayrollStatsGopal();
