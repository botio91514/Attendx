/**
 * Maintenance Script: Recalculate Attendance Status
 * Fixes historical data that was incorrectly marked 'present' due to timezone bugs.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');

async function run() {
  try {
    await connectDB();
    console.log('📦 Database connected.');

    const settings = await Settings.getSettings();
    console.log('⚙️ Settings retrieved:', {
      officeStartTime: settings.officeStartTime,
      lateGracePeriod: settings.lateGracePeriod
    });

    // Find all attendance records from the current month/year 
    // or just all records to be safe (if not too many)
    const records = await Attendance.find({ 
      checkIn: { $ne: null } 
    });

    console.log(`🔍 Found ${records.length} records to verify.`);

    let updatedCount = 0;
    for (const record of records) {
      const oldStatus = record.status;
      
      // Attach settings for the pre-save middleware
      record._settings = settings;
      
      // We force re-calculation by calling the method directly 
      // though .save() would also do it.
      const newStatus = record.determineStatus(settings);
      
      if (oldStatus !== newStatus) {
        console.log(`⚡ Updating record for ${record.date} (User: ${record.userId}): ${oldStatus} -> ${newStatus}`);
        record.status = newStatus;
        await record.save();
        updatedCount++;
      }
    }

    console.log(`✅ Success! Recalculated ${records.length} records. Updated ${updatedCount} records.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

run();
