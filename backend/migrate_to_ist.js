const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const Attendance = require('./models/Attendance');
const WorkSession = require('./models/WorkSession');

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const migrateDatabaseToIST = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for Global Migration...');

    const FOUR_HOURS_AGO = new Date(Date.now() - 4 * 60 * 60 * 1000);

    // 1. Update Attendance Records (Only those created BEFORE I started working today)
    const attendanceRecords = await Attendance.find({
      createdAt: { $lt: FOUR_HOURS_AGO },
      $or: [
        { checkIn: { $ne: null } },
        { checkOut: { $ne: null } }
      ]
    });

    console.log(`Migrating ${attendanceRecords.length} Attendance records...`);
    for (const record of attendanceRecords) {
      let changed = false;
      if (record.checkIn) {
        record.checkIn = new Date(record.checkIn.getTime() + IST_OFFSET);
        changed = true;
      }
      if (record.checkOut) {
        record.checkOut = new Date(record.checkOut.getTime() + IST_OFFSET);
        changed = true;
      }
      if (record.breaks && record.breaks.length > 0) {
        record.breaks = record.breaks.map(b => ({
          ...b.toObject(),
          breakStart: b.breakStart ? new Date(b.breakStart.getTime() + IST_OFFSET) : null,
          breakEnd: b.breakEnd ? new Date(b.breakEnd.getTime() + IST_OFFSET) : null
        }));
        changed = true;
      }

      if (changed) {
        // Disable pre-save hooks or manual override checks for the migration
        record.isManualOverride = true; 
        await record.save();
      }
    }

    // 2. Update WorkSessions (Task timers)
    const sessions = await WorkSession.find({
      createdAt: { $lt: FOUR_HOURS_AGO }
    });
    console.log(`Migrating ${sessions.length} Work Sessions...`);
    for (const session of sessions) {
      if (session.startTime) session.startTime = new Date(session.startTime.getTime() + IST_OFFSET);
      if (session.endTime) session.endTime = new Date(session.endTime.getTime() + IST_OFFSET);
      await session.save();
    }

    console.log('✅ DATABASE MIGRATION COMPLETE! All records moved to IST.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.connection.close();
  }
};

migrateDatabaseToIST();
