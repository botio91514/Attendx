const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const Attendance = require('./models/Attendance');
const User = require('./models/User');
const Settings = require('./models/Settings');
const { parseISTToShiftedDate } = require('./utils/timeUtils');

const repairDipakHistoryFinal = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for Final Dipak Repair...');

    const dipak = await User.findOne({ name: /dipak/i });
    const settings = await Settings.getSettings();
    settings.halfDayThreshold = 7; // Ensure 7h threshold

    // 1. Specific Fixes for the broken days
    const specificFixes = [
      { date: '2026-04-01', in: '09:10', out: '13:20' }, // 4h 10m -> Half-day
      { date: '2026-04-23', in: '09:13', out: '14:20' }, // 5h 07m -> Half-day
      { date: '2026-04-15', in: '09:15', out: '18:15' }, // 9h 00m -> Present (Was 11pm Absent)
      { date: '2026-04-04', in: '09:24', out: '18:24' }  // 9h 00m -> Present (Was 11pm)
    ];

    for (const fix of specificFixes) {
      const checkIn = parseISTToShiftedDate(`${fix.date}T${fix.in}:00.000Z`);
      const checkOut = parseISTToShiftedDate(`${fix.date}T${fix.out}:00.000Z`);
      
      await Attendance.findOneAndUpdate(
        { userId: dipak._id, date: fix.date },
        { 
          checkIn, 
          checkOut, 
          status: (fix.date === '2026-04-01' || fix.date === '2026-04-23') ? 'half-day' : 'present',
          isManualOverride: true 
        },
        { upsert: true }
      );
      console.log(`Fixed ${fix.date} specifically.`);
    }

    // 2. Global Recalculation for April (To fix the "Absent" vs "Half-day" vs "Present" status)
    const aprilRecords = await Attendance.find({ 
      userId: dipak._id, 
      date: /^2026-04/ 
    });

    console.log(`Recalculating ${aprilRecords.length} April records...`);
    for (const record of aprilRecords) {
      // Only recalculate if NOT one of our specific fixes above (which already have isManualOverride)
      if (record.checkIn && record.checkOut && !record.isManualOverride) {
        // Trigger pre-save logic which now uses 7h threshold
        record._settings = settings;
        await record.save();
      }
    }

    console.log('✅ DIPAK HISTORY REPAIRED! All records are now logical and IST-compliant.');

  } catch (err) {
    console.error('Repair failed:', err);
  } finally {
    await mongoose.connection.close();
  }
};

repairDipakHistoryFinal();
