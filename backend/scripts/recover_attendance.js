const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Constants
const ATTENDANCE_ID = '69d47e1913c74e3024746a81';

// Load env (one levels up from /scripts)
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import model relative to script
const Attendance = require('../models/Attendance');

const recover = async () => {
    try {
        console.log('Connecting to MongoDB...');
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI not found in environment');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const record = await Attendance.findById(ATTENDANCE_ID);
        if (!record) {
            console.log('Record not found.');
            process.exit(1);
        }

        console.log('Record found. userId:', record.userId, 'date:', record.date);
        console.log('Current checkOut:', record.checkOut);

        // Undo checkout
        record.checkOut = null;
        record.totalWorkingHours = 0;
        // status will be recalculated in pre-save
        
        await record.save();
        console.log('Update successful. Record is now:', record);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

recover();
