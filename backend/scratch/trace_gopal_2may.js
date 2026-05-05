const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');

async function traceRecord() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const gopal = await User.findOne({ name: /Gopal/i });
    if (!gopal) {
      console.log('Gopal not found');
      return;
    }

    console.log('Found User:', gopal.name, gopal._id);

    const record = await Attendance.findOne({
      userId: gopal._id,
      date: '2026-05-02'
    });

    if (!record) {
      console.log('No attendance record for 2026-05-02');
    } else {
      console.log('--- RAW DATABASE RECORD ---');
      console.log('Status:', record.status);
      console.log('WorkFraction:', record.workFraction);
      console.log('LeaveMeta:', JSON.stringify(record.leaveMeta));
      console.log('CheckIn:', record.checkIn);
      console.log('CheckOut:', record.checkOut);
      console.log('Breakdown:', record.getBreakdownString());
      console.log('---------------------------');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

traceRecord();
