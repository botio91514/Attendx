const {
  generateAttendancePDF,
  generateBulkAttendancePDF,
  generatePayslipPDF,
  generateLeaveReportPDF,
  addReportHeader,
  addEmployeeInfoCard,
  addPageFooter,
  addAttendanceSection
} = require('../utils/pdfGenerator.js');

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const LeaveBalance = require('../models/LeaveBalance');
const { getMonthRange } = require('../utils/attendanceHelpers');

// Helper: get date range from query params
const getDateRange = (query) => {
  const from = query.from || 
    new Date(new Date().getFullYear(), 
      new Date().getMonth(), 1)
      .toISOString().split('T')[0];
  const to = query.to || 
    new Date().toISOString().split('T')[0];
  return { from, to };
};

// 1. Export single employee attendance PDF
const exportAttendancePDF = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const dateRange = getDateRange(req.query);

    // Fetch employee details
    const employee = await User.findById(employeeId)
      .select('name email employeeId department role joiningDate');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Fetch attendance records for date range
    const records = await Attendance.find({
      userId: employeeId,
      date: { $gte: dateRange.from, $lte: dateRange.to }
    }).sort({ date: 1 });

    await generateAttendancePDF(res, employee, records, dateRange);
  } catch (err) {
    console.error('Export attendance PDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
  }
};

// 2. Export ALL employees attendance PDF (bulk)
const exportAllAttendancePDF = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    
    // Fetch all attendance for all employees in one go
    const records = await Attendance.find({
      date: { $gte: dateRange.from, $lte: dateRange.to }
    })
    .populate('userId', 'name employeeId department')
    .sort({ date: 1, 'userId.name': 1 });

    // Remove any admin records if somehow picked up
    const filteredRecords = records.filter(r => r.userId?.role !== 'admin');

    await generateBulkAttendancePDF(res, filteredRecords, dateRange);
    
  } catch (err) {
    console.error('Bulk export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate bulk PDF' });
    }
  }
};

// 3. Export payslip PDF
const exportPayslipPDF = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const employee = await User.findById(employeeId)
      .select('name email employeeId department role joiningDate baseSalary');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Reconstruct payroll data
    const { startStr, endStr } = getMonthRange(parseInt(year), parseInt(month));
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    let totalWorkingDays = 0;
    let tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const day = tempDate.getDay();
      if (day !== 0 && day !== 6 && !holidayDates.includes(tempDate.toISOString().split('T')[0])) {
        totalWorkingDays++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const attendance = await Attendance.find({
      userId: employeeId,
      date: { $gte: startStr, $lte: endStr }
    });

    let p = 0, h = 0, l = 0, a = 0;
    attendance.forEach(r => {
      if (r.status === 'present') p++;
      else if (r.status === 'late') { p++; l++; }
      else if (r.status === 'half-day') h++;
      else a++;
    });

    const dailyRate = totalWorkingDays > 0 ? (employee.baseSalary || 0) / totalWorkingDays : 0;
    const payableDays = p + (h * 0.5);
    
    // Simulate payroll record
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[parseInt(month) - 1] || month;
    
    const payrollData = {
      month: monthName,
      year,
      basicSalary: employee.baseSalary || 0,
      bonus: 0,
      absentDeduction: Math.abs(Math.round(((totalWorkingDays - payableDays) * dailyRate))),
      lateDeduction: 0,
      workingDays: totalWorkingDays,
      presentDays: p,
      absentDays: totalWorkingDays - payableDays,
      lateDays: l,
      onLeaveDays: 0
    };

    const dateRange = { 
      from: `01 ${payrollData.month} ${year}`, 
      to: `${endDate.getDate()} ${payrollData.month} ${year}` 
    };

    await generatePayslipPDF(res, employee, payrollData, dateRange);
  } catch (err) {
    console.error('Export payslip PDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate payslip PDF' });
    }
  }
};

// 4. Export leave report PDF
const exportLeavePDF = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const dateRange = getDateRange(req.query);

    const employee = await User.findById(employeeId)
      .select('name email employeeId department role joiningDate');

    const leaveRecords = await Leave.find({
      userId: employeeId,
      createdAt: {
        $gte: new Date(dateRange.from),
        $lte: new Date(dateRange.to + 'T23:59:59.999Z')
      }
    }).sort({ createdAt: -1 });

    const currentYear = new Date().getFullYear();
    let leaveBalance = await LeaveBalance.findOne({ userId: employeeId, year: currentYear });
    if (!leaveBalance) {
        // Fallback if no balance
        leaveBalance = { sick: {}, casual: {}, earned: {} };
    }

    await generateLeaveReportPDF(res, employee, leaveRecords, leaveBalance, dateRange);
  } catch (err) {
    console.error('Export leave PDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate leave PDF' });
    }
  }
};

// 5. Export attendance CSV (all records in range)
const exportAttendanceCSV = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const records = await Attendance.find({
      date: { $gte: dateRange.from, $lte: dateRange.to }
    })
    .populate('userId', 'name employeeId department role')
    .sort({ date: 1 });  // Sort only by date (can't sort by populated field)

    const filtered = records.filter(r => r.userId && r.userId.role !== 'admin');

    // Helper: format YYYY-MM-DD string to DD-MMM-YYYY (prevents Excel auto-conversion)
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      const [y, m, d] = dateStr.split('-');
      return `${d}-${MONTH_NAMES[parseInt(m, 10) - 1]}-${y}`;
    };

    // Helper: convert total minutes to Xh Ym
    const formatHours = (mins) => {
      if (!mins || mins === 0) return '0h 0m';
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    // Build CSV
    const headers = [
      'Employee Name', 'Employee ID', 'Department',
      'Date (DD/MM/YYYY)', 'Day of Week',
      'Check In (IST)', 'Check Out (IST)',
      'Working Hours', 'Break Time',
      'Status'
    ];

    const rows = filtered.map(r => {
      // Format date string explicitly
      const dateFormatted = formatDate(r.date);
      const dayName = r.date
        ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })
        : 'N/A';

      return [
        r.userId?.name || 'N/A',
        r.userId?.employeeId || 'N/A',
        r.userId?.department || 'N/A',
        dateFormatted,
        dayName,
        r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : 'N/A',
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : 'N/A',
        formatHours(r.totalWorkingHours),
        r.totalBreakTime ? `${r.totalBreakTime}m` : '0m',
        (r.status || 'N/A').toUpperCase()
      ].map(field => `"${field}"`).join(',');
    });

    const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    // Add BOM for proper UTF-8 encoding in Excel
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="staff_attendance_${dateRange.from}_to_${dateRange.to}.csv"`);
    res.status(200).send(bom + csv);

  } catch (err) {
    console.error('CSV Export Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate CSV' });
  }
};

// 6. Bulk Leave CSV
const exportBulkLeaveCSV = async (req, res) => {
  try {
    const from = req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = req.query.to || new Date().toISOString().split('T')[0];

    const leaves = await Leave.find({
      createdAt: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') }
    }).populate('userId', 'name employeeId department role').sort({ createdAt: -1 });

    const filtered = leaves.filter(l => l.userId?.role !== 'admin');

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDate = (d) => {
      if (!d) return 'N/A';
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${MONTH_NAMES[dt.getMonth()]}-${dt.getFullYear()}`;
    };

    const headers = ['Employee Name','Employee ID','Department','Leave Type','Start Date','End Date','Total Days','Reason','Status','Applied On'];
    const rows = filtered.map(l => [
      l.userId?.name || 'N/A',
      l.userId?.employeeId || 'N/A',
      l.userId?.department || 'N/A',
      (l.leaveType || 'N/A').toUpperCase(),
      fmtDate(l.startDate),
      fmtDate(l.endDate),
      l.totalDays || 'N/A',
      (l.reason || 'N/A').replace(/"/g, "'"),
      (l.status || 'N/A').toUpperCase(),
      fmtDate(l.createdAt)
    ].map(f => `"${f}"`).join(','));

    const bom = '\uFEFF';
    const csv = bom + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leave_report_${from}_to_${to}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('Bulk Leave CSV Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate leave CSV' });
  }
};

// 7. Bulk Payroll CSV
const exportBulkPayrollCSV = async (req, res) => {
  try {
    const month  = parseInt(req.query.month  || new Date().getMonth() + 1);
    const year   = parseInt(req.query.year   || new Date().getFullYear());
    const { startStr, endStr } = getMonthRange(year, month);

    const employees = await User.find({ role: 'employee', isActive: true })
      .select('name employeeId department baseSalary');

    const holidays = await Holiday.find({ date: { $gte: new Date(startStr), $lte: new Date(endStr) } });
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    let totalWorkingDays = 0;
    let tempDate = new Date(startStr);
    while (tempDate <= new Date(endStr)) {
      const day = tempDate.getDay();
      if (day !== 0 && day !== 6 && !holidayDates.includes(tempDate.toISOString().split('T')[0])) totalWorkingDays++;
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const headers = ['Employee Name','Employee ID','Department','Month/Year','Base Salary','Working Days','Present Days','Half Days','Absent Days','Daily Rate','Net Payable Days','Gross Salary'];

    const rows = [];
    for (const emp of employees) {
      const attendance = await Attendance.find({ userId: emp._id, date: { $gte: startStr, $lte: endStr } });
      let present = 0, halfDay = 0, late = 0;
      attendance.forEach(r => {
        if (r.status === 'present') present++;
        else if (r.status === 'late') { present++; late++; }
        else if (r.status === 'half-day') halfDay++;
      });
      const absent = totalWorkingDays - present - halfDay;
      const payableDays = present + (halfDay * 0.5);
      const dailyRate  = totalWorkingDays > 0 ? (emp.baseSalary || 0) / totalWorkingDays : 0;
      const grossSalary = Math.round(payableDays * dailyRate);

      rows.push([
        emp.name, emp.employeeId, emp.department || 'N/A',
        `${monthNames[month-1]} ${year}`,
        `${emp.baseSalary || 0}`,
        totalWorkingDays, present, halfDay, Math.max(0, absent),
        `${Math.round(dailyRate)}`,
        payableDays, grossSalary
      ].map(f => `"${f}"`).join(','));
    }

    const bom = '\uFEFF';
    const csv = bom + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${monthNames[month-1]}_${year}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('Bulk Payroll CSV Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate payroll CSV' });
  }
};

module.exports = {
  exportAttendancePDF,
  exportAllAttendancePDF,
  exportAttendanceCSV,
  exportBulkLeaveCSV,
  exportBulkPayrollCSV,
  exportPayslipPDF,
  exportLeavePDF
};
