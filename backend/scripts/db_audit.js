const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');

const runAudit = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- STARTING DB CONSISTENCY AUDIT ---');

        // 1. Check for Orphan Leaves
        const approvedLeaves = await Leave.find({ status: 'approved' });
        let orphans = 0;
        for (const lv of approvedLeaves) {
            for (const item of lv.dailyBreakdown) {
                const att = await Attendance.findOne({ userId: lv.userId, date: item.date });
                if (!att || !att.leaveMeta || (att.leaveMeta.cl + att.leaveMeta.sl + att.leaveMeta.rl + att.leaveMeta.lwp === 0)) {
                    console.log(`[ORPHAN] Leave ${lv._id} Day ${item.date} has no leaveMeta in Attendance.`);
                    orphans++;
                }
            }
        }

        // 2. Check for Over-Quota Days (> 1.0)
        const allAtt = await Attendance.find({ 
            $or: [
                { 'leaveMeta.cl': { $gt: 0 } },
                { 'leaveMeta.sl': { $gt: 0 } },
                { 'leaveMeta.rl': { $gt: 0 } },
                { 'leaveMeta.lwp': { $gt: 0 } }
            ]
        });
        
        let overQuota = 0;
        for (const att of allAtt) {
            const meta = att.leaveMeta;
            const totalLeave = meta.cl + meta.sl + meta.rl + meta.lwp;
            if (totalLeave > 1.0) {
                console.log(`[ERROR] Date ${att.date} (User ${att.userId}) has Leave Quota ${totalLeave} (> 1.0)`);
                overQuota++;
            }
        }

        console.log('\n--- AUDIT SUMMARY ---');
        console.log(`Approved Leaves Analyzed: ${approvedLeaves.length}`);
        console.log(`Attendance Records Analyzed: ${allAtt.length}`);
        console.log(`Orphan Days Found: ${orphans}`);
        console.log(`Over-Quota Days Found: ${overQuota}`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runAudit();
