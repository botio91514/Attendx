const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Attendance = require('./models/Attendance');
const User = require('./models/User');

async function sync() {
  await mongoose.connect(process.env.MONGO_URI);
  const dipak = await User.findOne({ name: /dipak/i });
  if (!dipak) {
    console.log('Dipak not found');
    process.exit(1);
  }

  const records = await Attendance.find({ userId: dipak._id });
  console.log(`Syncing ${records.length} records for Dipak...`);

  for (const record of records) {
    if (!record.checkIn || !record.checkOut) {
      // Ensure virtual records are correctly marked
      if (record.status === 'absent' && record.isVirtual) {
        record.workFraction = 0;
        await record.save();
      }
      continue;
    }

    // 1. Recalculate duration
    const diff = (new Date(record.checkOut) - new Date(record.checkIn)) / (1000 * 60);
    const breakTime = record.totalBreakTime || 0;
    const workingMinutes = Math.floor(diff - breakTime);
    
    record.totalWorkingHours = Math.max(0, workingMinutes);

    // 2. Determine Status & Work Fraction (User Rule: 7h = Full Day)
    // Threshold is 420 mins. We use 410 for grace.
    if (workingMinutes >= 410) {
      record.workFraction = 1.0;
      record.status = 'present';
    } else if (workingMinutes > 30) {
      record.workFraction = 0.5;
      record.status = 'half-day';
    } else {
      record.workFraction = 0;
      record.status = 'absent';
    }

    record.isManualOverride = true;
    
    console.log(`Date: ${record.date} | Working: ${workingMinutes}m | Status: ${record.status} | Fraction: ${record.workFraction}`);
    await record.save();
  }

  console.log('Sync complete!');
  process.exit(0);
}

sync();
