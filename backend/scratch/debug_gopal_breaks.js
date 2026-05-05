const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
require('dotenv').config();

const debugGopalBreaks = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const gopal = await User.findOne({ name: /Gopal/i });
        if (!gopal) return;

        const date = '2026-05-04';
        const attendance = await Attendance.findOne({ userId: gopal._id, date });

        if (attendance) {
            console.log(`Gopal Attendance on ${date}:`);
            console.log(`Total Break Time: ${attendance.totalBreakTime}`);
            console.log(`Breaks Array:`, JSON.stringify(attendance.breaks, null, 2));
            console.log(`Break Object:`, JSON.stringify(attendance.break, null, 2));
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
};

debugGopalBreaks();
