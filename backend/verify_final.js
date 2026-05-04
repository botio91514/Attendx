const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const Attendance = require('./models/Attendance');
const User = require('./models/User');
const Settings = require('./models/Settings');
const { parseISTToShiftedDate } = require('./utils/timeUtils');

const verifyDipakFinal = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const dipak = await User.findOne({ name: /dipak/i });
    const settings = await Settings.getSettings();

    // User's specific request: 1st April, 9:10 to 13:20, half-day
    const date = '2026-04-01';
    
    // Simulating frontend ISO strings
    const checkInStr = `${date}T09:10:00.000Z`;
    const checkOutStr = `${date}T13:20:00.000Z`;

    let record = await Attendance.findOne({ userId: dipak._id, date });
    if (!record) record = new Attendance({ userId: dipak._id, date });

    record.checkIn = parseISTToShiftedDate(checkInStr);
    record.checkOut = parseISTToShiftedDate(checkOutStr);
    record.status = 'half-day';
    record.isManualOverride = true;
    record._settings = settings;

    await record.save();
    
    console.log(`Final Verification for ${date}:`);
    console.log(`  Check-in:  ${record.checkIn.toISOString()}`);
    console.log(`  Check-out: ${record.checkOut.toISOString()}`);
    console.log(`  Status:    ${record.status}`);
    console.log(`  Work:      ${record.workFraction}`);

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await mongoose.connection.close();
  }
};

verifyDipakFinal();
