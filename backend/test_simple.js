const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Attendance = require('./models/Attendance');
const User = require('./models/User');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const u = await User.findOne({ name: /dipak/i });
  const records = await Attendance.find({ userId: u._id, date: '2026-04-01' }).lean();
  console.log(JSON.stringify(records, null, 2));
  process.exit(0);
}
test();
