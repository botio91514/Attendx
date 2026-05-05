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
const { calculateDynamicLeaveBalance } = require('../utils/leaveHelpers');
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

// Helper: Ensure user can only export their own data unless admin
const checkOwnership = (req, employeeId) => {
  if (req.user.role === 'admin') return true;
  return req.user._id.toString() === employeeId.toString();
};

// 1. Export single employee attendance PDF
const exportAttendancePDF = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const dateRange = getDateRange(req.query);

    // Access Control
    if (!checkOwnership(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

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

    // Access Control
    if (!checkOwnership(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

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
      // Use stored data (Production Standard)
      payrollData = {
        month: monthName,
        year: y.toString(),
        basicSalary: storedPayroll.baseSalary,
        bonus: storedPayroll.bonus || 0,
        // Deduction is the difference between potential full salary and what was actually earned
        absentDeduction: (storedPayroll.workingDays * storedPayroll.dailyRate) - (storedPayroll.payableDays * storedPayroll.dailyRate),
        lateDeduction: 0,
        otherDeductions: storedPayroll.deductionAmount || 0,
        workingDays: storedPayroll.workingDays,
        presentDays: storedPayroll.presentDays,
        absentDays: storedPayroll.absentDays,
        lateDays: storedPayroll.lateDays,
        netSalary: storedPayroll.netSalary,
        onLeaveDays: (storedPayroll.clDays || 0) + (storedPayroll.slDays || 0) + (storedPayroll.rlDays || 0)
      };
      
      const { endStr } = getMonthRange(y, m);
      dateRangeEnd = new Date(endStr).getDate();
    } else {
      // Fallback: Dynamic calculation (for previews)
      const { startStr, endStr } = getMonthRange(y, m);
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      dateRangeEnd = endDate.getDate();

      // 🛡️ SYNC WITH PAYROLL ENGINE logic
      const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
      const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

      // Calculate total working days in month
      let totalWorkingDays = 0;
      let tempDate = new Date(startDate);
      while (tempDate <= endDate) {
        const day = tempDate.getDay();
        if (workingDaysConfig.includes(day) && !holidayDates.includes(tempDate.toISOString().split('T')[0])) totalWorkingDays++;
        tempDate.setDate(tempDate.getDate() + 1);
      }

      // Handle mid-month joining
      let empWorkingDays = totalWorkingDays;
      if (employee.joiningDate) {
        const joiningDate = new Date(employee.joiningDate);
        if (joiningDate > startDate && joiningDate <= endDate) {
          empWorkingDays = 0;
          let joinTemp = new Date(joiningDate);
          while (joinTemp <= endDate) {
            const d = joinTemp.getDay();
            if (workingDaysConfig.includes(d) && !holidayDates.includes(joinTemp.toISOString().split('T')[0])) empWorkingDays++;
            joinTemp.setDate(joinTemp.getDate() + 1);
          }
        }
      }

      const attendance = await Attendance.find({ userId: employeeId, date: { $gte: startStr, $lte: endStr } });
      let p = 0, h = 0, l = 0, a = 0, cl = 0, sl = 0, rl = 0, lwp = 0;

      attendance.forEach(r => {
        if (r.status === 'present') p++;
        else if (r.status === 'late') { p++; l++; }
        else if (r.status === 'half-day') h++;
        else a++;

        const meta = r.leaveMeta || {};
        cl += (meta.cl || 0);
        sl += (meta.sl || 0);
        rl += (meta.rl || 0);
        lwp += (meta.lwp || 0);
      });

      const dailyRate = totalWorkingDays > 0 ? (employee.baseSalary || 0) / totalWorkingDays : 0;
      const payableDays = Math.min(empWorkingDays, p + (h * 0.5) + cl + sl + rl);
      
      payrollData = {
        month: monthName,
        year,
        basicSalary: employee.baseSalary || 0,
        bonus: 0,
        absentDeduction: Math.round(((empWorkingDays - payableDays) * dailyRate)),
        lateDeduction: 0,
        workingDays: totalWorkingDays,
        presentDays: p,
        absentDays: totalWorkingDays - payableDays,
        lateDays: l,
        onLeaveDays: cl + sl + rl,
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

    // Access Control
    if (!checkOwnership(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

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

const ExcelJS = require('exceljs');

// 8. Professional Matrix Attendance Excel (Admin only)
// 8. Professional Matrix Attendance Excel (Admin only)
const exportAttendanceMatrixExcel = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const { from, to } = dateRange;
    const { department, employeeId } = req.query;
    
    // 1. Fetch Data
    const userQuery = { role: 'employee', isActive: true };
    if (department) userQuery.department = department;
    if (employeeId) userQuery._id = employeeId;
    
    const employees = await User.find(userQuery).select('name employeeId department');
    const attendance = await Attendance.find({ date: { $gte: from, $lte: to } });
    const holidays = await Holiday.find({ date: { $gte: new Date(from), $lte: new Date(to) } });
    const holidayDates = holidays.map(h => {
      const d = new Date(h.date);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    });
    
    const settings = await Settings.getSettings();
    const workingDays = settings.workingDays || [1, 2, 3, 4, 5];
    
    const startObj = new Date(from);
    const year = startObj.getFullYear();
    const month = startObj.getMonth();
    const monthName = startObj.toLocaleString('default', { month: 'long' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 2. Initialize Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // --- STYLING CONSTANTS ---
    const COLORS = {
      headerBg: 'FF1E293B',
      headerText: 'FFFFFFFF',
      present: 'FF10B981', // Green
      halfDay: 'FFF59E0B', // Amber
      cl: 'FF3B82F6',      // Blue (Casual)
      sl: 'FF0EA5E9',      // Sky Blue (Sick)
      rl: 'FF06B6D4',      // Cyan (Restricted)
      lwp: 'FFEF4444',     // Red (LWP)
      holiday: 'FFA855F7', // Purple
      weekend: 'FF94A3B8', // Slate/Gray
      summaryBg: 'FFF1F5F9',
      border: 'FFCBD5E1'
    };

    // 3. Define Header Rows
    // TITLE ROW (Merged)
    worksheet.mergeCells(1, 1, 1, 2 + daysInMonth + 5);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `STAFF ATTENDANCE REPORT - ${monthName.toUpperCase()} ${year}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // LEGEND ROW
    worksheet.mergeCells(2, 1, 2, 2 + daysInMonth + 8);
    const legendCell = worksheet.getCell(2, 1);
    legendCell.value = "LEGEND:  [P] Present  [HD] Half-Day  [CL] Casual Leave  [SL] Sick Leave  [RL] Religious Leave  [LWP] LWP  [A] Absent  [H] Holiday  [W] Weekend";
    legendCell.font = { italic: true, size: 9, color: { argb: 'FF475569' } };
    legendCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 20;

    // HEADER ROW 1: Date Numbers
    const headerRow1 = ['Employee Details', ''];
    for (let i = 1; i <= daysInMonth; i++) headerRow1.push(i);
    headerRow1.push('SUMMARY (MONTHLY TOTALS)', '', '', '', '', '', '', '');
    const row3 = worksheet.addRow(headerRow1);

    // HEADER ROW 2: Day Names
    const headerRow2 = ['Employee Name', 'Emp ID'];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      headerRow2.push(d.toLocaleString('default', { weekday: 'short' }));
    }
    headerRow2.push('Present', 'Half-Day', 'CL', 'SL', 'RL', 'LWP', 'Balance CL', 'Net Payable');
    const row4 = worksheet.addRow(headerRow2);

    // --- MERGE HEADERS ---
    worksheet.mergeCells(3, 1, 3, 2); 
    worksheet.mergeCells(3, 2 + daysInMonth + 1, 3, 2 + daysInMonth + 8);

    // --- STYLE HEADERS ---
    [3, 4].forEach(rowNum => {
      const row = worksheet.getRow(rowNum);
      row.height = 25;
      row.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } }
        };
      });
    });

    // 5. Fill Data Rows
    for (const [empIdx, emp] of employees.entries()) {
      const empRecords = attendance.filter(a => a.userId.toString() === emp._id.toString());
      const empAttendanceMap = {};
      empRecords.forEach(r => {
        empAttendanceMap[r.date] = r;
      });

      const rowData = [emp.name, emp.employeeId];
      const cellStyles = []; 

      let counts = { present: 0, halfDay: 0, cl: 0, sl: 0, rl: 0, lwp: 0 };
      let netPayable = 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const record = empAttendanceMap[dateStr];
        const targetDate = new Date(year, month, i);
        const isSunday = targetDate.getDay() === 0;
        
        if (record) {
          const meta = record.leaveMeta || {};
          
          if (meta.cl > 0) {
            rowData.push('CL');
            cellStyles.push({ bg: COLORS.cl, text: 'FFFFFFFF' });
          } else if (meta.sl > 0) {
            rowData.push('SL');
            cellStyles.push({ bg: COLORS.sl, text: 'FFFFFFFF' });
          } else if (meta.rl > 0) {
            rowData.push('RL');
            cellStyles.push({ bg: COLORS.rl, text: 'FFFFFFFF' });
          } else if (meta.lwp > 0) {
            rowData.push('LWP');
            cellStyles.push({ bg: COLORS.lwp, text: 'FFFFFFFF' });
          } else if (record.status === 'present' || record.status === 'late') {
            rowData.push('P');
            cellStyles.push({ bg: COLORS.present, text: 'FFFFFFFF' });
          } else if (record.status === 'half-day') {
            rowData.push('HD');
            cellStyles.push({ bg: COLORS.halfDay, text: 'FFFFFFFF' });
          } else if (record.status === 'absent') {
            rowData.push('A'); 
            cellStyles.push({ bg: COLORS.lwp, text: 'FFFFFFFF' });
          } else {
            rowData.push('0');
            cellStyles.push({ bg: null, text: 'FF000000' });
          }
        } else {
          if (holidayDates.includes(dateStr)) {
            rowData.push('H');
            cellStyles.push({ bg: COLORS.holiday, text: 'FFFFFFFF' });
          } else if (!workingDays.includes(targetDate.getDay()) || isSunday) {
            rowData.push('W');
            cellStyles.push({ bg: COLORS.weekend, text: 'FFFFFFFF' });
          } else {
            rowData.push('');
            cellStyles.push({ bg: null, text: 'FF000000' });
          }
        }
      }

      // Summary Logic
      empRecords.forEach(r => {
        const meta = r.leaveMeta || {};
        counts.cl += (meta.cl || 0);
        counts.sl += (meta.sl || 0);
        counts.rl += (meta.rl || 0);
        counts.lwp += (meta.lwp || 0);
        
        if (!meta.cl && !meta.sl && !meta.rl && !meta.lwp) {
           if (r.status === 'present' || r.status === 'late') counts.present++;
           else if (r.status === 'half-day') counts.halfDay++;
        }
        netPayable += (r.workFraction || 0) + (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0);
      });

      // Calculate Dynamic CL Balance
      const balanceResult = await calculateDynamicLeaveBalance(emp, Attendance, year);
      const balanceCL = balanceResult.cl.available;

      rowData.push(
        counts.present, 
        counts.halfDay, 
        counts.cl, 
        counts.sl, 
        counts.rl, 
        counts.lwp, 
        balanceCL,
        parseFloat(netPayable.toFixed(2))
      );

      const row = worksheet.addRow(rowData);
      row.height = 20;

      // Apply Cell Styling
      row.eachCell((cell, colNum) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } }
        };

        if (empIdx % 2 === 1 && !cell.fill) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }

        if (colNum > 2 && colNum <= 2 + daysInMonth) {
          const style = cellStyles[colNum - 3];
          if (style && style.bg) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.bg } };
            cell.font = { bold: true, color: { argb: style.text }, size: 8 };
          }
        }

        if (colNum > 2 + daysInMonth) {
          cell.font = { bold: true, color: { argb: 'FF1E293B' }, size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.summaryBg } };
          // Highlight Net Payable
          if (colNum === 2 + daysInMonth + 8) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
             cell.font = { bold: true, color: { argb: 'FF166534' } };
          }
          // Highlight Balance CL
          if (colNum === 2 + daysInMonth + 7) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
             cell.font = { bold: true, color: { argb: 'FF1E40AF' } };
          }
        }

        if (colNum <= 2) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          cell.font = { bold: true, size: 10 };
        }
      });
    }

    // 6. Final Polish
    worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
    
    // Column widths
    worksheet.getColumn(1).width = 25; // Name
    worksheet.getColumn(2).width = 10; // ID
    for (let i = 3; i <= 2 + daysInMonth; i++) {
      worksheet.getColumn(i).width = 4.2; // Days
    }
    // Summary widths
    for (let i = 2 + daysInMonth + 1; i <= 2 + daysInMonth + 8; i++) {
      worksheet.getColumn(i).width = 9;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${monthName}_${year}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (err) {
    console.error('Matrix Excel Export Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate Excel report' });
    }
  }
};

module.exports = {
  exportAttendancePDF,
  exportAllAttendancePDF,
  exportAttendanceCSV,
  exportBulkLeaveCSV,
  exportBulkPayrollCSV,
  exportPayslipPDF,
  exportLeavePDF,
  exportAttendanceMatrixExcel
};
