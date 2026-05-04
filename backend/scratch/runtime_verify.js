const mongoose = require('mongoose');
require('dotenv').config();
const Attendance = require('../models/Attendance');

const verifySystem = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. DATABASE CONSISTENCY
    const record = await Attendance.findOne({ checkIn: { $ne: null } }).sort({ createdAt: -1 });
    if (!record) {
      console.log('❌ No attendance records found to verify.');
      return;
    }

    const now = new Date();
    // In IST-as-UTC, new Date() on server might be UTC or IST. 
    // Let's use the actual local time of the environment.
    
    console.log('\n--- STEP 7: DATABASE CONSISTENCY ---');
    console.log('Record ID:', record._id);
    console.log('Check-in (Raw):', record.checkIn);
    console.log('Check-in (ISO):', record.checkIn.toISOString());
    
    const wallHours = record.checkIn.getUTCHours();
    const wallMinutes = record.checkIn.getUTCMinutes();
    console.log(`Wall Clock Time: ${wallHours}:${wallMinutes}`);
    
    // 2. LOGIC VALIDATION (SIMULATED FRONTEND)
    console.log('\n--- STEP 2: TIME DIFFERENCE VALIDATION (SIMULATED) ---');
    const dateStr = record.checkIn.toISOString();
    
    // Simulate parseDBDate (stripping Z)
    const start = new Date(dateStr.replace('Z', ''));
    
    // Simulate 'Now' in Browser (which would be local time)
    // If we are testing on a server in UTC, we need to shift 'now' to IST to match browser behavior in India
    const isLocalIST = now.getTimezoneOffset() === -330;
    const browserNow = isLocalIST ? now : new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    
    const diffMs = browserNow.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    console.log('Simulated Browser Now:', browserNow.toISOString());
    console.log('Parsed Start Time:', start.toISOString());
    console.log('Diff (ms):', diffMs);
    console.log('Diff (seconds):', diffSecs);
    
    if (diffSecs > 0) {
      console.log('✅ VERDICT: Diff is POSITIVE. Timer will RUN.');
    } else {
      console.log('❌ VERDICT: Diff is NEGATIVE/ZERO. Timer will be STUCK.');
    }

    // 3. BREAK LOGIC TEST
    console.log('\n--- STEP 5: BREAK LOGIC TEST ---');
    if (record.breaks && record.breaks.length > 0) {
        let breakSecs = 0;
        record.breaks.forEach(b => {
            if (b.breakStart && b.breakEnd) {
                const s = new Date(b.breakStart.toISOString().replace('Z', ''));
                const e = new Date(b.breakEnd.toISOString().replace('Z', ''));
                breakSecs += Math.floor((e.getTime() - s.getTime()) / 1000);
            }
        });
        console.log('Total Break Seconds:', breakSecs);
        console.log('Net Working Seconds:', diffSecs - breakSecs);
    } else {
        console.log('No breaks in this record to test.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

verifySystem();
