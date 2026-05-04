const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Attendance = require('./models/Attendance');
const User = require('./models/User');
const Settings = require('./models/Settings');
const { getISTDateString } = require('./utils/timeUtils');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const from = '2026-04-01';
  const to = '2026-04-30';
  const employees = await User.find({ name: /dipak/i });
  console.log('Employees found:', employees.map(e => ({ name: e.name, id: e._id })));
  const settings = await Settings.getSettings();
  
  const startD = new Date(from);
  const endD = new Date(to);
  const todayStr = getISTDateString();
  const employeeIds = employees.map(e => e._id);

  const attendanceRecords = await Attendance.find({
    date: { $gte: from, $lte: to },
    userId: { $in: employeeIds }
  }).lean();
  console.log('Records found count:', attendanceRecords.length);

  const results = [];
  for (const emp of employees) {
    let current = new Date(startD);
    while (current <= endD) {
      const dateStr = getISTDateString(current);
      const attendance = attendanceRecords.find(a => 
        a.date === dateStr && a.userId.toString() === emp._id.toString()
      );
      if (attendance) {
        results.push({ date: dateStr, status: attendance.status, in: attendance.checkIn, out: attendance.checkOut });
      } else if (dateStr === '2026-04-01') {
        console.log('DEBUG: Match failed for 2026-04-01');
        console.log('Sample record from DB:', attendanceRecords[0]);
        console.log('Comparison: dateStr=', dateStr, 'a.date=', attendanceRecords[0].date);
      }
      current.setDate(current.getDate() + 1);
    }
  }
  
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

test();
