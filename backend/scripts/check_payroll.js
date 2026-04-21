const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Payroll = require('../models/Payroll');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const payrolls = await Payroll.find({ year: 2026, month: { $in: [3, 4] } });
    if (payrolls.length === 0) {
      console.log('No payrolls found for March/April 2026.');
    } else {
      payrolls.forEach(p => {
        console.log(`Payroll for ${p.month}/${p.year} - User Count: ${p.employeeData?.length || 0}`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
