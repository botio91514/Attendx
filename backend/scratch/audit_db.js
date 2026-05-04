const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Attendance = require('../models/Attendance');

const auditTime = async () => {
  try {
    const uri = process.env.MONGO_URI;
    console.log('Connecting to:', uri.split('@')[1]); // Log host only for privacy
    
    await mongoose.connect(uri);
    console.log('--- STEP 1: DATABASE CHECK ---');
    
    // Get a recent record with checkIn
    const record = await Attendance.findOne({ checkIn: { $ne: null } }).sort({ createdAt: -1 });
    
    if (record) {
      console.log('Record ID:', record._id);
      console.log('User ID:', record.userId);
      console.log('Date String (YYYY-MM-DD):', record.date);
      console.log('Check-in Raw (Date Object):', record.checkIn);
      console.log('Check-in ISO String:', record.checkIn.toISOString());
      
      const hours = record.checkIn.getUTCHours();
      const minutes = record.checkIn.getUTCMinutes();
      console.log(`Interpreted Wall Clock (if IST-as-UTC): ${hours}:${minutes}`);
      
      // Check for consistency with the model methods
      console.log('Working Hours (Calculated):', record.calculateWorkingHours());
    } else {
      console.log('No attendance records with check-in found.');
    }

    mongoose.connection.close();
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
};

auditTime();
