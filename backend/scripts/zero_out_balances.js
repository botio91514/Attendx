const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from current directory
dotenv.config();

const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');

async function zeroOutBalances() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('connected to database');

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Find all employees
    const employees = await User.find({ role: 'employee' });

    for (const emp of employees) {
      // Calculate what they HAVE accrued so far
      let monthsWorked = currentMonth;
      if (emp.joiningDate) {
        const join = new Date(emp.joiningDate);
        if (join.getFullYear() === currentYear) {
          monthsWorked = Math.max(1, currentMonth - join.getMonth());
        }
      }

      const clAccrued = Math.min(12, monthsWorked * 1);
      const slAccrued = Math.min(6, monthsWorked * 0.5);

      // Force 'used' to match 'accrued' so Available = 0
      await LeaveBalance.findOneAndUpdate(
        { userId: emp._id, year: currentYear },
        { 
          $set: { 
            'casual.used': clAccrued,
            'sick.used': slAccrued,
            'casual.total': 12,
            'sick.total': 6
          }
        },
        { upsert: true }
      );
      
      console.log(`✅ Zeroed out CL/SL for ${emp.name} (Used set to ${clAccrued}/${slAccrued})`);
    }

    console.log('All employee balances have been set to 0 available for this month.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

zeroOutBalances();
