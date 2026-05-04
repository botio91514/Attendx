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
const Payroll = require('../models/Payroll');
const Settings = require('../models/Settings');
const { toIST, formatISTTime } = require('../utils/timeUtils');
const { getMonthRange, calculateStats } = require('../utils/attendanceHelpers');
const { processComprehensiveAttendance } = require('./attendanceController');

// Helper: get date range from query params
const getDateRange = (query) => {
  const now = toIST(new Date());
  // now is already shifted to IST, so UTC methods will return IST components
  const from = query.from || 
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString().split('T')[0];
  const to = query.to || now.toISOString().split('T')[0];
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

    // Fetch comprehensive records for the single employee
    const settings = await Settings.getSettings();
    const records = await processComprehensiveAttendance(dateRange.from, dateRange.to, [employee], settings);

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
    
    // Fetch all relevant employees
    const employees = await User.find({ role: 'employee', isActive: true })
      .select('name email employeeId department role joiningDate');
    
    const settings = await Settings.getSettings();
    const comprehensiveRecords = await processComprehensiveAttendance(dateRange.from, dateRange.to, employees, settings);

    await generateBulkAttendancePDF(res, comprehensiveRecords, dateRange);
    
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
    const m = parseInt(month);
    const y = parseInt(year);

    const employee = await User.findById(employeeId)
      .select('name email employeeId department role joiningDate baseSalary');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // 1. Check if persistent payroll record exists
    const storedPayroll = await Payroll.findOne({ userId: employeeId, month: m, year: y });
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[m - 1] || month;

    const settings = await Settings.getSettings();
    const workingDaysConfig = settings.workingDays || [1, 2, 3, 4, 5];

    let payrollData;
    let dateRangeEnd;

    if (storedPayroll) {
      // Use stored data (Professional way)
      payrollData = {
        month: monthName,
        year: y.toString(),
        basicSalary: storedPayroll.baseSalary,
        bonus: storedPayroll.bonus || 0,
        absentDeduction: Math.abs(storedPayroll.grossSalary - (storedPayroll.payableDays * storedPayroll.dailyRate)) || 0, // Approx
        lateDeduction: 0,
        otherDeductions: storedPayroll.deductions || 0,
        workingDays: storedPayroll.workingDays,
        presentDays: storedPayroll.presentDays,
        absentDays: storedPayroll.absentDays,
        lateDays: storedPayroll.lateDays,
        netSalary: storedPayroll.netSalary,
        onLeaveDays: 0
      };
      
      const { endStr } = getMonthRange(y, m);
      dateRangeEnd = new Date(endStr).getDate();
    } else {
      // Fallback: Dynamic calculation (for previews)
      const { startStr, endStr } = getMonthRange(y, m);
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      dateRangeEnd = endDate.getDate();

      const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
      const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

      let totalWorkingDays = 0;
      let tempDate = new Date(startDate);
      while (tempDate <= endDate) {
        const day = tempDate.getDay();
        if (workingDaysConfig.includes(day) && !holidayDates.includes(tempDate.toISOString().split('T')[0])) totalWorkingDays++;
        tempDate.setDate(tempDate.getDate() + 1);
      }

      const attendance = await Attendance.find({ userId: employeeId, date: { $gte: startStr, $lte: endStr } });
      let p = 0, h = 0, l = 0, a = 0;
      attendance.forEach(r => {
        if (r.status === 'present') p++;
        else if (r.status === 'late') { p++; l++; }
        else if (r.status === 'half-day') h++;
        else a++;
      });

      const dailyRate = totalWorkingDays > 0 ? (employee.baseSalary || 0) / totalWorkingDays : 0;
      const payableDays = p + (h * 0.5);
      
      payrollData = {
        month: monthName,
        year,
        basicSalary: employee.baseSalary || 0,
        bonus: 0,
        absentDeduction: Math.round(((totalWorkingDays - payableDays) * dailyRate)),
        lateDeduction: 0,
        workingDays: totalWorkingDays,
        presentDays: p,
        absentDays: totalWorkingDays - payableDays,
        lateDays: l,
        onLeaveDays: 0,
        netSalary: Math.round(payableDays * dailyRate)
      };
    }

    const dateRange = { 
      from: `01 ${payrollData.month} ${year}`, 
      to: `${dateRangeEnd} ${payrollData.month} ${year}` 
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
    const employees = await User.find({ role: 'employee', isActive: true })
      .select('name email employeeId department role joiningDate');
    
    const settings = await Settings.getSettings();
    const filtered = await processComprehensiveAttendance(dateRange.from, dateRange.to, employees, settings);

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
        r.checkIn ? formatISTTime(r.checkIn) : 'N/A',
        r.checkOut ? formatISTTime(r.checkOut) : 'N/A',
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
    const now = toIST(new Date());
    const from = req.query.from || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0];
    const to = req.query.to || now.toISOString().split('T')[0];

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
    const now = toIST(new Date());
    const month = parseInt(req.query.month || now.getUTCMonth() + 1);
    const year = parseInt(req.query.year || now.getUTCFullYear());
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = monthNames[month - 1];

    // 🛡️ FINANCIAL AUDIT FIX: Check for finalized records first
    const finalizedRecords = await Payroll.find({ month, year })
      .populate('userId', 'name employeeId department baseSalary');

    const headers = [
      'Employee Name', 'Employee ID', 'Department', 'Month/Year', 
      'Base Salary', 'Working Days', 'Present Days', 'Half Days', 
      'Absent Days', 'LWP Days', 'Paid Leaves (CL+SL+RL)',
      'Daily Rate', 'Total Payable Days', 'Gross Salary', 
      'Bonus', 'Deductions (Manual + LWP)', 'Net Salary', 'Status'
    ];

    let rows = [];

    if (finalizedRecords.length > 0) {
      // 🏆 USE LOCKED SNAPSHOTS
      rows = finalizedRecords.map(p => [
        p.userId?.name || 'N/A',
        p.userId?.employeeId || 'N/A',
        p.userId?.department || 'N/A',
        `${monthName} ${year}`,
        p.baseSalary,
        p.workingDays,
        p.presentDays,
        p.halfDays,
        p.absentDays,
        p.lwpDays || 0,
        (p.clDays || 0) + (p.slDays || 0) + (p.rlDays || 0),
        Math.round(p.dailyRate),
        p.payableDays,
        Math.round(p.grossAmount),
        p.bonus || 0,
        Math.round(p.deductionAmount || 0),
        Math.round(p.netSalary),
        (p.status || 'finalized').toUpperCase()
      ].map(f => `"${f}"`).join(','));
    } else {
      // 🏗️ FALLBACK: LIVE DRAFT CALCULATION
      const { startStr, endStr } = getMonthRange(year, month);
      const employees = await User.find({ role: 'employee', isActive: true })
        .select('name employeeId department baseSalary');
      
      const holidays = await Holiday.find({ date: { $gte: new Date(startStr), $lte: new Date(endStr) } });
      const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);
      
      const settings = await Settings.getSettings();
      const workingDaysConfig = settings.workingDays || [1, 2, 3, 4, 5];
      
      let totalWorkingDays = 0;
      let tempDate = new Date(startStr);
      while (tempDate <= new Date(endStr)) {
        if (workingDaysConfig.includes(tempDate.getDay()) && !holidayDates.includes(tempDate.toISOString().split('T')[0])) totalWorkingDays++;
        tempDate.setDate(tempDate.getDate() + 1);
      }

      for (const emp of employees) {
        const attendance = await Attendance.find({ userId: emp._id, date: { $gte: startStr, $lte: endStr } });
        let present = 0, halfDay = 0;
        let pLeaves = 0, lwp = 0;
        
        attendance.forEach(r => {
          if (r.status === 'present' || r.status === 'late') present++;
          else if (r.status === 'half-day') halfDay++;
          
          const meta = r.leaveMeta || {};
          pLeaves += (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0);
          lwp += (meta.lwp || 0);
        });

        const payableDays = present + (halfDay * 0.5) + pLeaves;
        const dailyRate = totalWorkingDays > 0 ? (emp.baseSalary || 0) / totalWorkingDays : 0;
        const grossSalary = Math.round(payableDays * dailyRate);

        rows.push([
          emp.name, emp.employeeId, emp.department || 'N/A', `${monthName} ${year}`,
          emp.baseSalary || 0, totalWorkingDays, present, halfDay,
          Math.max(0, totalWorkingDays - present - halfDay - pLeaves - lwp),
          lwp, pLeaves, Math.round(dailyRate), payableDays,
          grossSalary, 0, 0, grossSalary, 'DRAFT'
        ].map(f => `"${f}"`).join(','));
      }
    }

    const bom = '\uFEFF';
    const csv = bom + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${monthName}_${year}.csv"`);
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
