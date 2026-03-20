const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const { getMonthRange } = require('../utils/attendanceHelpers');

/**
 * @desc    Get payroll summary for a specific month
 * @route   GET /api/payroll/admin/summary
 * @access  Private/Admin
 */
const getPayrollSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Please provide month and year' });
    }

    const { startStr, endStr } = getMonthRange(parseInt(year), parseInt(month));
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    // Get all employees (not admins)
    const employees = await User.find({ role: 'employee', isActive: true }).select('name employeeId department baseSalary designation');

    // Get all holidays in this range
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    });
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    // Calculate total working days in month (excluding weekends and holidays - optional, let's just count week days)
    let totalWorkingDays = 0;
    let tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const day = tempDate.getDay();
      const isWeekend = (day === 0 || day === 6); // Sun or Sat
      const isHoliday = holidayDates.includes(tempDate.toISOString().split('T')[0]);
      
      if (!isWeekend && !isHoliday) {
        totalWorkingDays++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const payrollData = await Promise.all(employees.map(async (emp) => {
      const attendance = await Attendance.find({
        userId: emp._id,
        date: { $gte: startStr, $lte: endStr }
      });

      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;

      attendance.forEach(record => {
        if (record.status === 'present') presentCount++;
        else if (record.status === 'late') { presentCount++; lateCount++; }
        else if (record.status === 'half-day') halfDayCount++;
        else absentCount++;
      });

      // Simple Payroll Logic:
      // (Base Salary / Total Possible Working Days) * (Equivalent Days)
      // Equivalent Days = Present + (HalfDay * 0.5)
      const dailyRate = totalWorkingDays > 0 ? emp.baseSalary / totalWorkingDays : 0;
      const payableDays = presentCount + (halfDayCount * 0.5);
      const grossSalary = payableDays * dailyRate;

      return {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
        designation: emp.designation,
        baseSalary: emp.baseSalary,
        stats: {
          present: presentCount,
          halfDay: halfDayCount,
          absent: totalWorkingDays - payableDays, // Approximation
          late: lateCount
        },
        calculations: {
          totalWorkingDays,
          payableDays,
          dailyRate: Math.round(dailyRate),
          grossSalary: Math.round(grossSalary)
        }
      };
    }));

    res.status(200).json({
      success: true,
      data: {
        month,
        year,
        totalStaff: employees.length,
        payroll: payrollData
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayrollSummary
};
