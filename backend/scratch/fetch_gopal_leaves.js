const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Leave = require('../models/Leave');

const fetchGopalLeaves = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find Gopal
    const gopal = await User.findOne({ name: /Gopal/i });
    if (!gopal) {
      console.log('Employee Gopal not found.');
      process.exit(0);
    }

    console.log(`Found Employee: ${gopal.name} (${gopal.employeeId})`);

    // Fetch leaves
    const leaves = await Leave.find({ userId: gopal._id }).sort({ startDate: -1 });
    
    if (leaves.length === 0) {
      console.log('No leaves found for Gopal.');
    } else {
      console.log(`\nLeaves for ${gopal.name}:`);
      console.log('---------------------------------------------------------');
      leaves.forEach(lv => {
        console.log(`Dates: ${lv.startDate.toISOString().split('T')[0]} to ${lv.endDate.toISOString().split('T')[0]}`);
        console.log(`Type: ${lv.leaveType} | Status: ${lv.status}`);
        console.log(`Breakdown: CL=${lv.clDays}, SL=${lv.slDays}, LWP=${lv.lwpDays}, RL=${lv.rlDays}`);
        console.log(`Daily Breakdown:`, lv.dailyBreakdown);
        console.log(`Reason: ${lv.reason}`);
        console.log('---------------------------------------------------------');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fetchGopalLeaves();
