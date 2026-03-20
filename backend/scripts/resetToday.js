const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Attendance = require('../models/Attendance');

const resetToday = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const res = await Attendance.deleteMany({ date: today });
    console.log(`Successfully cleared ${res.deletedCount} attendance records for today (${today}).`);
    process.exit(0);
  } catch (error) {
    console.error('Error resetting today:', error);
    process.exit(1);
  }
};

resetToday();
