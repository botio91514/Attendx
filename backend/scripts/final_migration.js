const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');

const migrateToLeaveMeta = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const leaves = await Leave.find({ status: 'approved' });
        console.log(`Found ${leaves.length} approved leaves to sync.`);

        let count = 0;
        for (const lv of leaves) {
            // Group breakdown by date
            const dateMap = {};
            for (const item of lv.dailyBreakdown) {
                if (!dateMap[item.date]) dateMap[item.date] = { cl: 0, sl: 0, rl: 0, lwp: 0 };
                const val = item.days || (lv.isHalfDay ? 0.5 : 1);
                const type = item.leaveType.toLowerCase();
                if (dateMap[item.date].hasOwnProperty(type)) {
                    dateMap[item.date][type] += val;
                }
            }

            for (const [date, meta] of Object.entries(dateMap)) {
                const totalLeave = meta.cl + meta.sl + meta.rl + meta.lwp;
                const notes = `System Migration: Leave Sync (ID: ${lv._id})`;
                
                let record = await Attendance.findOne({ userId: lv.userId, date });
                
                if (record) {
                    record.leaveMeta = meta;
                    if (totalLeave >= 1.0) record.status = 'leave';
                    else if (record.status === 'absent') record.status = 'leave';
                    await record.save();
                } else {
                    await Attendance.create({
                        userId: lv.userId,
                        date,
                        status: 'leave',
                        leaveMeta: meta,
                        notes
                    });
                }
                count++;
            }
        }

        console.log(`Migration Complete. Updated ${count} attendance records with leaveMeta.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrateToLeaveMeta();
