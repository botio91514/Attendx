const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const { overrideAttendance } = require('../controllers/adminCorrectionController');

async function validateFix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const gopal = await User.findOne({ name: /Gopal/i });
    if (!gopal) {
      console.log('Gopal not found');
      return;
    }

    console.log('--- BEFORE FIX ---');
    let record = await Attendance.findOne({ userId: gopal._id, date: '2026-05-02' });
    console.log('Status:', record.status);
    console.log('Work Fraction:', record.workFraction);
    console.log('Manual Override:', record.isManualOverride);

    console.log('\n--- SIMULATING ADMIN UPDATE (RECALC) ---');
    // We will simulate the req/res for overrideAttendance
    const req = {
        body: {
            userId: gopal._id,
            date: '2026-05-02',
            // We provide the same times but NO status to trigger recalculation
            checkIn: '2026-05-02T09:15', 
            checkOut: '2026-05-02T13:14'
        },
        user: { _id: gopal._id }, // Dummy admin
        ip: '127.0.0.1',
        get: () => 'Test Agent'
    };
    
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log(`Response Code: ${code}`);
                console.log(`Response Message: ${data.message}`);
            }
        })
    };
    
    const next = (err) => { if (err) console.error('Error in controller:', err); };

    await overrideAttendance(req, res, next);

    console.log('\n--- AFTER FIX ---');
    record = await Attendance.findOne({ userId: gopal._id, date: '2026-05-02' });
    console.log('Status:', record.status);
    console.log('Work Fraction:', record.workFraction);
    console.log('Manual Override:', record.isManualOverride);
    
    // Check if it's HALF-DAY
    if (record.status === 'half-day' && record.workFraction === 0.5) {
        console.log('\n✅ VALIDATION SUCCESSFUL: Record correctly recalculated to HALF-DAY');
    } else {
        console.log('\n❌ VALIDATION FAILED: Record status is', record.status);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

validateFix();
