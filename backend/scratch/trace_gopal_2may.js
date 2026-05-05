const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');

async function traceRecord() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const gopal = await User.findOne({ name: /Gopal/i });
    if (!gopal) {
      console.log('Gopal not found');
      return;
    }

    const settings = await Settings.findOne();
    console.log('--- SECTION 3: THRESHOLD VALUES ---');
    console.log('Office Start Time:', settings.officeStartTime);
    console.log('Half Day / Full Day Threshold (Hours):', settings.halfDayThreshold); 
    const fullDayMinutes = (settings.halfDayThreshold || 7) * 60;
    console.log('Full Day Minutes:', fullDayMinutes);

    const record = await Attendance.findOne({
      userId: gopal._id,
      date: '2026-05-02'
    });

    if (!record) {
      console.log('Record not found for 2026-05-02');
      return;
    }

    console.log('\n--- SECTION 1: RAW RECORD ---');
    console.log('Check-In:', record.checkIn);
    console.log('Check-Out:', record.checkOut);
    console.log('Total Working Minutes (from DB):', record.totalWorkingHours);
    console.log('Total Break Minutes (from DB):', record.totalBreakTime);
    console.log('Work Fraction (from DB):', record.workFraction);
    console.log('Status (from DB):', record.status);
    console.log('Leave Meta (from DB):', JSON.stringify(record.leaveMeta));
    console.log('Manual Override:', record.isManualOverride);
    console.log('_isManualStatus:', record._isManualStatus);

    console.log('\n--- SECTION 2: MANUAL RECALCULATION ---');
    if (record.checkIn && record.checkOut) {
      const diffMs = new Date(record.checkOut) - new Date(record.checkIn);
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const totalBreaks = record.totalBreakTime || 0;
      const workedMinutes = diffMin - totalBreaks;
      
      console.log('Gross Minutes (Out - In):', diffMin);
      console.log('Net Work Minutes (Gross - Breaks):', workedMinutes);
      
      const expectedWorkFraction = workedMinutes / fullDayMinutes;
      console.log('Expected Work Fraction (Raw):', expectedWorkFraction);
      console.log('Expected Work Fraction (Capped):', Math.min(1, expectedWorkFraction));
    } else {
      console.log('Incomplete In/Out data for manual recalc');
    }

    console.log('\n--- SECTION 4 & 5: TRACING determineStatus() LOGIC ---');
    // Simulate determineStatus logic from Attendance.js
    const meta = record.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
    const paidLeave = (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0);
    const unpaidLeave = (meta.lwp || 0);
    const rawWorkFraction = record.workFraction; // The one stored in DB
    const effectiveCredit = Math.min(1.0, rawWorkFraction + paidLeave);

    console.log('Raw Work Fraction (from record):', rawWorkFraction);
    console.log('Paid Leave:', paidLeave);
    console.log('Unpaid Leave:', unpaidLeave);
    console.log('Effective Credit:', effectiveCredit);

    let finalStatus = 'absent';
    let path = '';
    
    if (rawWorkFraction >= 1.0) {
        path = "Matched condition: rawWorkFraction >= 1.0 → PRESENT/LATE";
        finalStatus = 'present'; 
    } else if (effectiveCredit >= 1.0) {
        path = "Matched condition: effectiveCredit >= 1.0 → PRESENT (Work + Paid Leave)";
        finalStatus = 'present';
    } else if (rawWorkFraction >= 0.5) {
        path = "Matched condition: rawWorkFraction >= 0.5 → HALF-DAY";
        finalStatus = 'half-day';
    } else if (effectiveCredit >= 0.5) {
        path = "Matched condition: effectiveCredit >= 0.5 → HALF-DAY (Work + Paid Leave)";
        finalStatus = 'half-day';
    } else {
        path = "Matched condition: Default → ABSENT";
        finalStatus = 'absent';
    }
    
    console.log('Tracing Path:', path);
    console.log('Calculated Status:', finalStatus);

    console.log('\n--- SECTION 6: OVERRIDE CHECK ---');
    if (record.isManualOverride || record._isManualStatus) {
        console.log('OVERRIDE IS ACTIVE. The determineStatus logic is bypassed in the model.');
        console.log('Current status is frozen as:', record.status);
    } else {
        console.log('Override is NOT active. Automatic logic should apply.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

traceRecord();
