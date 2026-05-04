const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Attendance = require('./models/Attendance');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const dates = ['2026-04-05', '2026-04-12', '2026-04-19', '2026-04-26'];
  const records = await Attendance.find({ 
    userId: '69bbbe752b60b651a6410b03', 
    date: { $in: dates } 
  });
  console.log(records.map(r => ({ date: r.date, status: r.status })));
  process.exit(0);
}
check();
