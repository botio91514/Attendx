const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');

const clearEmployees = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // 1. Delete all Attendance records
    await Attendance.deleteMany({});
    console.log('Cleared all attendance records.');

    // 2. Delete all Leave records
    await Leave.deleteMany({});
    console.log('Cleared all leave records.');

    // 3. Delete all Leave Balance records
    await LeaveBalance.deleteMany({});
    console.log('Cleared all leave balances.');

    // 4. Delete all users EXCEPT the admin
    const result = await User.deleteMany({ role: { $ne: 'admin' } });
    console.log(`Deleted ${result.deletedCount} employee accounts.`);

    console.log('--- START FROM SCRATCH READY ---');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearEmployees();
