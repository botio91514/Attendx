const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Attendance = require('./models/Attendance');
const User = require('./models/User');
const Settings = require('./models/Settings');
const Holiday = require('./models/Holiday');
const Leave = require('./models/Leave');
const { getISTDateString, toIST } = require('./utils/timeUtils');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const dipak = await User.findOne({ name: /dipak/i });
  const userId = dipak._id;
  const month = 4;
  const year = 2026;

  // Simulate getAttendanceHistory logic
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const startD = startDate;
  const endD = endDate;

  const attendanceRecords = await Attendance.find({ 
    userId, 
    date: { $gte: '2026-04-01', $lte: '2026-04-30' } 
  });
  
  const finalAttendance = attendanceRecords.map(a => ({ ...a.toObject(), date: a.date, status: a.status }));
  const todayStr = '2026-05-02';

  // Sundays logic
  let current = new Date(startD);
  current.setHours(0, 0, 0, 0);
  const limitDate = new Date(endD);
  limitDate.setHours(23, 59, 59, 999);

  while (current <= limitDate) {
    const day = current.getDay();
    const dateStr = getISTDateString(current);
    if (day === 0) {
      const hasRecord = finalAttendance.some(a => a.date.startsWith(dateStr));
      console.log(`Checking Sunday ${dateStr}: hasRecord=${hasRecord}`);
      if (!hasRecord && dateStr <= todayStr) {
        finalAttendance.push({ date: dateStr, status: 'holiday', title: 'Sunday' });
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const holidaysCount = finalAttendance.filter(a => a.status === 'holiday').length;
  console.log('Final Holidays Count:', holidaysCount);
  console.log('Holiday Dates:', finalAttendance.filter(a => a.status === 'holiday').map(a => a.date));
  process.exit(0);
}
test();
