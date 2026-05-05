const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
require('dotenv').config();

const updateGopal = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const gopal = await User.findOne({ name: /Gopal/i });
        if (!gopal) return;

        const date = '2026-05-04';
        const attendance = await Attendance.findOne({ userId: gopal._id, date });

        if (attendance) {
            console.log(`Current Status for Gopal: ${attendance.status}`);
            await attendance.save(); // Triggers pre-save logic with new rules
            console.log(`Updated Status for Gopal: ${attendance.status}`);
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
};

updateGopal();
