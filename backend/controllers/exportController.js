const {
  generateAttendancePDF,
  generatePayslipPDF,
  generateLeaveReportPDF,
  addReportHeader,
  addEmployeeInfoCard,
  addPageFooter
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
    
    // Fetch all active employees
    const employees = await User.find({ role: 'employee', isActive: true })
      .select('name email employeeId department role joiningDate');

    const PDFTable = require('pdfkit-table');
    const doc = new PDFTable({ margin: 40, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="all_attendance_${dateRange.from}_${dateRange.to}.pdf"`
    );
    doc.pipe(res);

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const records = await Attendance.find({
        userId: emp._id,
        date: { $gte: dateRange.from, $lte: dateRange.to }
      }).sort({ date: 1 });

      // Add page break between employees
      if (i > 0) doc.addPage();

      // Reuse header and employee card
      addReportHeader(doc, 'Attendance Report', `${emp.name}`, dateRange);
      addEmployeeInfoCard(doc, emp);
      
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const onLeave = records.filter(r => r.status === 'on-leave' || r.status === 'leave').length;

      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
         .text(`Summary: ${present} Present, ${late} Late, ${absent} Absent, ${onLeave} Leave`);
      doc.moveDown(1);
    }

    addPageFooter(doc);
    doc.end();
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

module.exports = {
  exportAttendancePDF,
  exportAllAttendancePDF,
  exportPayslipPDF,
  exportLeavePDF
};
