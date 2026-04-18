const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { distributeLeave } = require('../utils/leaveHelpers');

const traceExecution = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- RUNTIME DEBUG TRACE (Final) ---');

        const user = await User.findOne({ employeeId: 'EMP002' }); // Gopal
        if (!user) { throw new Error('User Gopal not found'); }

        // Cleanup
        await Attendance.deleteMany({ userId: user._id, date: { $in: ['2026-04-11', '2026-04-13'] } });
        
        console.log('STEP 1: User Context Prepared');

        // 2. LEAVE CALCULATION (April 11)
        const clDates = ['2026-04-11'];
        const clDist = distributeLeave(clDates, 'cl', { '2026-04': { cl: 0, sl: 0 } }, 0, false);
        console.log(`STEP 2: CL April 11 Distributed. dailyBreakdown: ${JSON.stringify(clDist.dailyBreakdown[0])}`);

        // 3. LEAVE CALCULATION (April 13) - Split expected
        const slDates = ['2026-04-13'];
        const slDist = distributeLeave(slDates, 'sl', { '2026-04': { cl: 1, sl: 0 } }, 0, false);
        console.log(`STEP 3: SL April 13 Distributed. dailyBreakdown: ${JSON.stringify(slDist.dailyBreakdown)}`);

        // 4. MIRROR LAYER SYNC (Simulated Approve)
        const meta13 = { cl: 0, sl: 0.5, rl: 0, lwp: 0.5 }; // Derived from breakdown
        await Attendance.findOneAndUpdate(
            { userId: user._id, date: '2026-04-13' },
            { $set: { status: 'leave', leaveMeta: meta13, notes: 'Trace Sync' } },
            { upsert: true }
        );
        console.log(`STEP 4: Mirror Layer Updated. April 13 leaveMeta populated.`);

        // 5. RUNTIME CHECK-IN (April 13)
        const checkInTime = new Date('2026-04-13T09:00:00Z');
        let statusToSet = 'present'; 
        const existingAtt = await Attendance.findOne({ userId: user._id, date: '2026-04-13' });
        const totalLeave = (existingAtt.leaveMeta.cl + existingAtt.leaveMeta.sl + existingAtt.leaveMeta.rl + existingAtt.leaveMeta.lwp);
        
        if (totalLeave >= 1.0) statusToSet = 'leave';

        await Attendance.findOneAndUpdate(
            { userId: user._id, date: '2026-04-13' },
            { $set: { checkIn: checkInTime, status: statusToSet } }
        );
        
        const runtimeState = await Attendance.findOne({ userId: user._id, date: '2026-04-13' });
        console.log(`STEP 5: Check-in logic executed.`);
        console.log(`- Final Status: ${runtimeState.status}`);
        console.log(`- LeaveMeta Total: ${totalLeave}`);

        // 6. PAYROLL ENGINE EXECUTION
        const payrollRecord = await Attendance.findOne({ userId: user._id, date: '2026-04-13' });
        const meta = payrollRecord.leaveMeta;
        const paidLv = meta.cl + meta.sl + meta.rl;
        const totalLv = meta.cl + meta.sl + meta.rl + meta.lwp;
        
        let workPay = 0;
        if (totalLv < 1.0) {
            const workCredit = 1.0; 
            workPay = Math.min(workCredit, 1.0 - totalLv);
        }

        console.log(`STEP 6: Payroll Engine Result for April 13:`);
        console.log(`- Paid Leave Part: ${paidLv}`);
        console.log(`- Work Credit Part: ${workPay}`);
        console.log(`- Total Day Pay: ${paidLv + workPay}`);
        console.log(`- Total Day Unpaid (LWP): ${meta.lwp}`);

        console.log('\n--- TRACE COMPLETE ---');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

traceExecution();
