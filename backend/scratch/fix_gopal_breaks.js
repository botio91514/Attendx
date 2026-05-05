const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
require('dotenv').config();

const fixGopalBreaks = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const gopal = await User.findOne({ name: /Gopal/i });
        if (!gopal) return;

        const date = '2026-05-04';
        const attendance = await Attendance.findOne({ userId: gopal._id, date });

        if (attendance && attendance.break) {
            console.log(`Current duration: ${attendance.break.durationMinutes}`);
            
            const start = new Date(attendance.break.startTime);
            const end = new Date(attendance.break.endTime);
            
            // The fix: treat both as UTC/Absolute times for the delta calculation
            const actualMinutes = Math.floor((end - start) / 60000);
            
            // If actualMinutes is still negative, it means 'end' was stored as Local time (IST) 
            // while 'start' was stored as shifted UTC.
            // We need to add 330 minutes to correct it if it was stored incorrectly.
            
            let correctedMinutes = actualMinutes;
            if (actualMinutes < 0) {
                correctedMinutes = actualMinutes + 330;
            }

            console.log(`Corrected duration: ${correctedMinutes}`);
            
            attendance.break.durationMinutes = correctedMinutes;
            attendance.totalBreakTime = correctedMinutes;
            
            await attendance.save();
            console.log('Gopal break record fixed.');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
};

fixGopalBreaks();
