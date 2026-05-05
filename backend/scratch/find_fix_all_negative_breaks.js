const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
require('dotenv').config();

const findNegativeBreaks = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const records = await Attendance.find({
            $or: [
                { totalBreakTime: { $lt: 0 } },
                { 'break.durationMinutes': { $lt: 0 } }
            ]
        }).populate('userId', 'name');

        if (records.length === 0) {
            console.log('No negative breaks found.');
            return;
        }

        console.log(`Found ${records.length} records with negative breaks:`);
        for (const r of records) {
            console.log(`User: ${r.userId?.name}, Date: ${r.date}, TotalBreak: ${r.totalBreakTime}, BreakObj: ${r.break?.durationMinutes}`);
            
            // Fix them if they are from today or recent
            const start = new Date(r.break.startTime);
            const end = new Date(r.break.endTime);
            const actual = Math.floor((end - start) / 60000);
            let corrected = actual;
            if (actual < 0) corrected = actual + 330;
            
            r.break.durationMinutes = corrected;
            r.totalBreakTime = corrected;
            await r.save();
            console.log(`  -> Fixed to: ${corrected}`);
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
};

findNegativeBreaks();
