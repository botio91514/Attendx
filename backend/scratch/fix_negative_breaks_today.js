const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixNegativeBreaks = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const today = '2026-05-04';
    const records = await Attendance.find({ 
      date: today,
      $or: [
        { 'break.durationMinutes': { $lt: 0 } },
        { totalBreakTime: { $lt: 0 } }
      ]
    });

    console.log(`Found ${records.length} corrupted break records for ${today}`);

    for (const record of records) {
      const user = await User.findById(record.userId);
      console.log(`Fixing record for ${user?.name || record.userId}`);

      if (record.break.startTime && record.break.endTime) {
        const start = new Date(record.break.startTime);
        const end = new Date(record.break.endTime);
        
        // Calculate real duration
        let duration = Math.floor((end - start) / 60000);
        
        // If it's still negative, one was shifted and other wasn't.
        // We know IST shift is 330 minutes.
        if (duration < 0) {
          console.log(`  Adjusting drift: ${duration}m`);
          duration = duration + 330; // Add 5.5 hours
        }

        console.log(`  New Duration: ${duration}m`);
        
        record.break.durationMinutes = Math.max(0, duration);
        record.totalBreakTime = Math.max(0, duration);
        
        // Also fix any sub-breaks if they exist
        if (record.breaks && record.breaks.length > 0) {
          record.breaks.forEach(b => {
            if (b.duration < 0) b.duration = b.duration + 330;
          });
          record.totalBreakTime = record.breaks.reduce((acc, b) => acc + (b.duration || 0), 0) + record.break.durationMinutes;
        }

        // Recalculate working hours
        if (record.checkIn && record.checkOut) {
            const cIn = new Date(record.checkIn);
            const cOut = new Date(record.checkOut);
            const totalWork = Math.floor((cOut - cIn) / 60000);
            record.totalWorkingHours = Math.max(0, totalWork - record.totalBreakTime);
        }

        await record.save();
        console.log(`  ✅ Fixed.`);
      }
    }

    console.log('Final Cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

fixNegativeBreaks();
