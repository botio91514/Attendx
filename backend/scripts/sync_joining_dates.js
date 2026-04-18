const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');

async function syncJoiningDates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('connected to database');

    const employees = await User.find({ role: 'employee' });

    for (const e of employees) {
      const firstAtt = await Attendance.findOne({ userId: e._id }).sort({ date: 1 });
      const firstLeave = await Leave.findOne({ userId: e._id }).sort({ startDate: 1 });

      let earliestActivity = [
        firstAtt ? firstAtt.date : null,
        firstLeave ? firstLeave.startDate.toISOString().split('T')[0] : null
      ].filter(Boolean).sort()[0];

      if (earliestActivity) {
        const earliestDate = new Date(earliestActivity);
        const currentJoiningDate = e.joiningDate ? new Date(e.joiningDate) : null;

        // If official joining date is later than actual activity, pull it back
        if (!currentJoiningDate || earliestDate < currentJoiningDate) {
          await User.findByIdAndUpdate(e._id, { joiningDate: earliestDate });
          console.log(`✅ SYNCED: ${e.name} | Old: ${currentJoiningDate?.toISOString().split('T')[0]} | New: ${earliestActivity}`);
        } else {
          console.log(`ℹ️ OK: ${e.name} joined on ${currentJoiningDate?.toISOString().split('T')[0]}`);
        }
      }
    }

    console.log('All employee joining dates have been synchronized with their actual activity.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

syncJoiningDates();
