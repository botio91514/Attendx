const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Attendance = require('./models/Attendance');
const User = require('./models/User');
const { getISTDateString } = require('./utils/timeUtils');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const dipak = await User.findOne({ name: /dipak/i });
  
  const startD = new Date('2026-04-01');
  const endD = new Date('2026-04-30');
  
  let current = new Date(startD);
  current.setHours(0,0,0,0);
  
  console.log('Start:', current.toISOString());
  
  while (current <= endD) {
    const day = current.getDay();
    const dateStr = getISTDateString(current);
    if (day === 0) {
      console.log(`BINGO: Found Sunday. Date: ${current.toISOString()}, getDay: ${day}, IST: ${dateStr}`);
    }
    current.setDate(current.getDate() + 1);
  }
  process.exit(0);
}
test();
