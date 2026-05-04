const PDFDocument = require('pdfkit');
const PDFTable = require('pdfkit-table');

// Shared brand colors
const COLORS = {
  primary: '#6366f1',      // indigo
  dark: '#0f172a',         // navy
  text: '#1e293b',         // dark slate
  subtext: '#64748b',      // gray
  success: '#10b981',      // emerald
  danger: '#ef4444',       // rose
  warning: '#f59e0b',      // amber
  white: '#ffffff',
  lightGray: '#f8fafc',
  border: '#e2e8f0',
  successBg: '#f0fdf4',
  dangerBg: '#fef2f2',
  warningBg: '#fffbeb',
  primaryBg: '#eef2ff'
};

// Shared header function — used by all 3 reports
const addReportHeader = (doc, title, subtitle, dateRange) => {
  // Ultra-modern header with gradient-like solid blocks
  doc.rect(0, 0, doc.page.width, 100).fill(COLORS.dark);
  
  // Brand Logo/Name
  doc.fillColor(COLORS.white).fontSize(28).font('Helvetica-Bold').text('AttendX', 40, 25);
  doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica').text('ELITE HR MANAGEMENT', 40, 56);
  
  // Top-Right Context
  doc.fillColor(COLORS.white).fontSize(16).font('Helvetica-Bold').text(title.toUpperCase(), 0, 30, { align: 'right', width: doc.page.width - 40 });
  doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text(subtitle, 0, 52, { align: 'right', width: doc.page.width - 40 });

  doc.moveDown(3);

  // Stats bar
  doc.fillColor(COLORS.subtext).fontSize(9).text(
    `DATE RANGE: ${dateRange.from} TO ${dateRange.to}   |   GENERATED ON: ${formatISTTime(new Date(), false)}`,
    40, 115
  );
  
  doc.moveTo(40, 132).lineTo(doc.page.width - 40, 132).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.moveDown(3);
};

// Shared footer function
const addPageFooter = (doc) => {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    
    // Footer line
    doc.moveTo(40, doc.page.height - 40)
       .lineTo(doc.page.width - 40, doc.page.height - 40)
       .strokeColor(COLORS.border)
       .stroke();
    
    // Footer text
    doc.fillColor(COLORS.subtext)
       .fontSize(8)
       .text(
         'This is a system-generated report from AttendX HR System. ' +
         'Do not alter this document.',
         40, doc.page.height - 28,
         { align: 'left' }
       );
    
    // Page number
    doc.text(
      `Page ${i + 1} of ${pageCount}`,
      0, doc.page.height - 28,
      { align: 'right', width: doc.page.width - 40 }
    );
  }
};

// Shared employee info card
const addEmployeeInfoCard = (doc, employee) => {
  // Light gray card background
  doc.rect(40, doc.y, doc.page.width - 80, 60)
     .fill(COLORS.lightGray);
  
  const cardY = doc.y + 10;
  
  doc.fillColor(COLORS.text)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(employee.name, 55, cardY);
  
  doc.fillColor(COLORS.subtext)
     .fontSize(9)
     .font('Helvetica')
     .text(
       `ID: ${employee.employeeId}  |  ` +
       `Email: ${employee.email}  |  ` +
       `Department: ${employee.department || 'N/A'}`,
       55, cardY + 18
     );
  
  doc.text(
    `Role: ${employee.role}  |  ` +
    `Joining Date: ${employee.joiningDate 
      ? new Date(employee.joiningDate)
          .toLocaleDateString('en-IN') 
      : 'N/A'}`,
    55, cardY + 33
  );
  
  doc.moveDown(4);
};

const addAttendanceSection = async (doc, records, dateRange, showEmployeeColumn = false) => {
  // Summary Calculation
  const stats = {
    present: records.filter(r => r.status === 'present' || r.status === 'late').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    leave: records.filter(r => r.status === 'leave').length,
    total: records.length
  };
  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  // ─── Modern Stat Cards ───────────────────────────────────────────
  const statsY = doc.y;
  const boxW = (doc.page.width - 80) / 5;
  const metrics = [
    { label: 'TOTAL', val: stats.total, color: COLORS.text, bg: COLORS.lightGray },
    { label: 'PRESENT', val: stats.present, color: COLORS.success, bg: COLORS.successBg },
    { label: 'LATE', val: stats.late, color: COLORS.warning, bg: COLORS.warningBg },
    { label: 'ABSENT', val: stats.absent, color: COLORS.danger, bg: COLORS.dangerBg },
    { label: 'LEAVE', val: stats.leave, color: COLORS.primary, bg: COLORS.primaryBg }
  ];

  metrics.forEach((m, i) => {
    const x = 40 + (i * boxW);
    doc.rect(x, statsY, boxW - 6, 52).fill(m.bg);
    // Left accent bar
    doc.rect(x, statsY, 3, 52).fill(m.color);
    doc.fillColor(m.color).fontSize(22).font('Helvetica-Bold')
       .text(m.val.toString(), x + 5, statsY + 8, { width: boxW - 11, align: 'center' });
    doc.fillColor(COLORS.subtext).fontSize(7).font('Helvetica-Bold')
       .text(m.label, x + 5, statsY + 36, { width: boxW - 11, align: 'center' });
  });

  // Attendance rate bar below cards
  const barY = statsY + 60;
  doc.rect(40, barY, doc.page.width - 80, 18).fill('#f1f5f9');
  const fillW = Math.round((doc.page.width - 80) * (attendanceRate / 100));
  doc.rect(40, barY, fillW, 18).fill(COLORS.success);
  doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold')
     .text(`ATTENDANCE RATE: ${attendanceRate}%`, 0, barY + 4, { align: 'center', width: doc.page.width });

  doc.y = barY + 28;

  // ─── Section Label ────────────────────────────────────────────────
  doc.fillColor(COLORS.dark).fontSize(10).font('Helvetica-Bold')
     .text('ATTENDANCE LOG', 40, doc.y);
  doc.moveTo(40, doc.y + 14).lineTo(doc.page.width - 40, doc.y + 14)
     .strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.y += 20;

  // ─── Modern Table ─────────────────────────────────────────────────
  // Helper: format YYYY-MM-DD → DD/MM/YYYY
  const fmtDate = (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const fmtHrs  = (m) => m ? `${Math.floor(m/60)}h ${m%60}m` : '—';
  const STATUS_COLOR = { 'PRESENT': COLORS.success, 'LATE': COLORS.warning, 'ABSENT': COLORS.danger, 'LEAVE': COLORS.primary };

  const table = {
    headers: [
      ...(showEmployeeColumn ? [
        { label: 'Employee', width: 75 },
        { label: 'Emp ID', width: 46 }
      ] : []),
      { label: 'Date', width: showEmployeeColumn ? 60 : 72 },
      { label: 'Day', width: showEmployeeColumn ? 46 : 60 },
      { label: 'Check In', width: showEmployeeColumn ? 56 : 68 },
      { label: 'Check Out', width: showEmployeeColumn ? 56 : 68 },
      { label: 'Net Hours', width: showEmployeeColumn ? 52 : 65 },
      { label: 'Break', width: showEmployeeColumn ? 36 : 45 },
      { label: 'Status', width: showEmployeeColumn ? 58 : 65 }
    ],
    rows: records.map(r => {
      const row = [];
      if (showEmployeeColumn) {
        row.push(r.userId?.name || '—');
        row.push(r.userId?.employeeId || '—');
      }
      const dateStr = r.date ? r.date.toString() : '';
      const dayName = dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }) : '—';
      row.push(fmtDate(dateStr));
      row.push(dayName);
      row.push(r.checkIn  ? formatISTTime(r.checkIn) : '—');
      row.push(r.checkOut ? formatISTTime(r.checkOut) : '—');
      row.push(fmtHrs(r.totalWorkingHours));
      row.push(r.totalBreakTime ? `${r.totalBreakTime}m` : '—');
      row.push((r.status || '—').toUpperCase());
      return row;
    })
  };

  await doc.table(table, {
    prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.white),
    prepareRow: (row, indexColumn, indexRow, rectRow) => {
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.text);
      // Zebra-striping
      if (indexRow % 2 === 0) {
        doc.rect(rectRow.x, rectRow.y, rectRow.width, rectRow.height).fill('#f8fafc');
      }
      // Color the STATUS column
      const statusColIdx = showEmployeeColumn ? 8 : 6;
      if (indexColumn === statusColIdx) {
        const statusVal = row[statusColIdx];
        const statusColor = STATUS_COLOR[statusVal] || COLORS.subtext;
        doc.fillColor(statusColor).font('Helvetica-Bold');
      }
    },
    headerColor: '#1e293b',
    columnSpacing: 6,
    padding: 7,
    x: 40,
    width: doc.page.width - 80
  });

  doc.moveDown(0.8);
  // Footer bar
  doc.rect(40, doc.y, doc.page.width - 80, 22).fill('#f1f5f9');
  doc.fillColor(COLORS.subtext).fontSize(8).font('Helvetica')
     .text(
       `Total Records: ${stats.total}  ·  Present: ${stats.present}  ·  Late: ${stats.late}  ·  Absent: ${stats.absent}  ·  Leave: ${stats.leave}  ·  Attendance Rate: ${attendanceRate}%`,
       40, doc.y + 6, { width: doc.page.width - 80, align: 'center' }
     );
  doc.y += 30;
};

const generateAttendancePDF = async (res, employee, records, dateRange) => {
  const doc = new PDFTable({ margin: 40, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${employee.employeeId}.pdf"`);
  doc.pipe(res);

  addReportHeader(doc, 'Attendance Statement', employee.name, dateRange);
  addEmployeeInfoCard(doc, employee);
  await addAttendanceSection(doc, records, dateRange, false);
  
  addPageFooter(doc);
  doc.end();
};

const generateBulkAttendancePDF = async (res, records, dateRange) => {
  const doc = new PDFTable({ margin: 40, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="staff_attendance_report.pdf"`);
  doc.pipe(res);

  addReportHeader(doc, 'Staff Attendance Log', 'Comprehensive Departmental Report', dateRange);
  
  // Overall Summary logic here...
  await addAttendanceSection(doc, records, dateRange, true);
  
  addPageFooter(doc);
  doc.end();
};

const generatePayslipPDF = async (
  res, employee, payrollData, dateRange
) => {
  const doc = new PDFDocument({ 
    margin: 40, 
    size: 'A4',
    bufferPages: true
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="payslip_${employee.employeeId}` +
    `_${payrollData.month}_${payrollData.year}.pdf"`
  );
  doc.pipe(res);

  addReportHeader(
    doc,
    'Payslip',
    `${payrollData.month} ${payrollData.year}`,
    dateRange
  );

  addEmployeeInfoCard(doc, employee);

  // Payslip two-column layout
  const leftX = 40;
  const rightX = doc.page.width / 2 + 10;
  const colWidth = (doc.page.width - 80) / 2 - 10;
  const startY = doc.y;

  // LEFT: Earnings
  doc.rect(leftX, startY, colWidth, 20)
     .fill(COLORS.dark);
  doc.fillColor(COLORS.white)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('EARNINGS', leftX + 10, startY + 5, 
       { width: colWidth });

  const earningsItems = [
    { label: 'Basic Salary', amount: payrollData.basicSalary },
    { label: 'HRA', 
      amount: Math.round(payrollData.basicSalary * 0.4) },
    { label: 'Transport Allowance', amount: 1600 },
    { label: 'Bonus', amount: payrollData.bonus || 0 },
  ];

  let earningsY = startY + 25;
  let totalEarnings = 0;
  earningsItems.forEach((item, i) => {
    if (item.amount > 0) {
      const rowBg = i % 2 === 0 ? COLORS.lightGray : COLORS.white;
      doc.rect(leftX, earningsY, colWidth, 18).fill(rowBg);
      doc.fillColor(COLORS.text)
         .fontSize(9)
         .font('Helvetica')
         .text(item.label, leftX + 8, earningsY + 4);
      doc.text(
        `₹${item.amount.toLocaleString('en-IN')}`,
        leftX, earningsY + 4,
        { width: colWidth - 8, align: 'right' }
      );
      totalEarnings += item.amount;
      earningsY += 18;
    }
  });

  // Earnings total
  doc.rect(leftX, earningsY, colWidth, 22).fill(COLORS.primary);
  doc.fillColor(COLORS.white)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('Total Earnings', leftX + 8, earningsY + 5);
  doc.text(
    `₹${totalEarnings.toLocaleString('en-IN')}`,
    leftX, earningsY + 5,
    { width: colWidth - 8, align: 'right' }
  );

  // RIGHT: Deductions
  doc.rect(rightX, startY, colWidth, 20).fill(COLORS.danger);
  doc.fillColor(COLORS.white)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('DEDUCTIONS', rightX + 10, startY + 5,
       { width: colWidth });

  const deductionItems = [
    { label: 'PF (12%)', 
      amount: Math.round(payrollData.basicSalary * 0.12) },
    { label: 'Professional Tax', amount: 200 },
    { label: 'Absent Deduction', 
      amount: payrollData.absentDeduction || 0 },
    { label: 'Late Deduction', 
      amount: payrollData.lateDeduction || 0 },
  ];

  let deductionsY = startY + 25;
  let totalDeductions = 0;
  deductionItems.forEach((item, i) => {
    if (item.amount > 0) {
      const rowBg = i % 2 === 0 ? COLORS.lightGray : COLORS.white;
      doc.rect(rightX, deductionsY, colWidth, 18).fill(rowBg);
      doc.fillColor(COLORS.text)
         .fontSize(9)
         .font('Helvetica')
         .text(item.label, rightX + 8, deductionsY + 4);
      doc.text(
        `₹${item.amount.toLocaleString('en-IN')}`,
        rightX, deductionsY + 4,
        { width: colWidth - 8, align: 'right' }
      );
      totalDeductions += item.amount;
      deductionsY += 18;
    }
  });

  // Deductions total
  doc.rect(rightX, deductionsY, colWidth, 22).fill(COLORS.danger);
  doc.fillColor(COLORS.white)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('Total Deductions', rightX + 8, deductionsY + 5);
  doc.text(
    `₹${totalDeductions.toLocaleString('en-IN')}`,
    rightX, deductionsY + 5,
    { width: colWidth - 8, align: 'right' }
  );

  // NET SALARY box — full width, prominent
  const netY = Math.max(earningsY, deductionsY) + 30;
  const netSalary = totalEarnings - totalDeductions;

  doc.rect(40, netY, doc.page.width - 80, 50)
     .fill(COLORS.dark);
  doc.fillColor(COLORS.white)
     .fontSize(13)
     .font('Helvetica-Bold')
     .text('NET SALARY', 55, netY + 10);
  doc.fillColor(COLORS.primary)
     .fontSize(22)
     .font('Helvetica-Bold')
     .text(
       `₹${netSalary.toLocaleString('en-IN')}`,
       0, netY + 8,
       { align: 'right', width: doc.page.width - 55 }
     );

  // Attendance summary below net salary
  doc.moveDown(5);
  doc.fillColor(COLORS.text)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('Attendance Summary', 40, doc.y);
  doc.moveDown(0.5);

  const attSummary = [
    ['Working Days', payrollData.workingDays || '—'],
    ['Present Days', payrollData.presentDays || '—'],
    ['Absent Days', payrollData.absentDays || '—'],
    ['Late Days', payrollData.lateDays || '—'],
    ['Leave Days', payrollData.onLeaveDays || '—'],
  ];

  attSummary.forEach(([label, value], i) => {
    const rowY = doc.y;
    const rowBg = i % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(40, rowY, doc.page.width - 80, 18).fill(rowBg);
    doc.fillColor(COLORS.text)
       .fontSize(9)
       .font('Helvetica')
       .text(label, 55, rowY + 4);
    doc.text(value.toString(), 0, rowY + 4,
      { align: 'right', width: doc.page.width - 55 });
    doc.moveDown(1.2);
  });

  addPageFooter(doc);
  doc.end();
};

const generateLeaveReportPDF = async (
  res, employee, leaveRecords, leaveBalance, dateRange
) => {
  const doc = new PDFTable({ 
    margin: 40, 
    size: 'A4',
    bufferPages: true
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="leave_report_` +
    `${employee.employeeId}_${dateRange.from}` +
    `_${dateRange.to}.pdf"`
  );
  doc.pipe(res);

  addReportHeader(
    doc,
    'Leave Report',
    `${employee.name} — ${dateRange.from} to ${dateRange.to}`,
    dateRange
  );

  addEmployeeInfoCard(doc, employee);

  // Leave balance summary cards
  const balanceY = doc.y;
  const balanceTypes = [
    { type: 'Sick Leave', 
      total: leaveBalance.sick?.total || 0,
      used: leaveBalance.sick?.used || 0,
      color: COLORS.danger },
    { type: 'Casual Leave',
      total: leaveBalance.casual?.total || 0,
      used: leaveBalance.casual?.used || 0,
      color: COLORS.warning },
    { type: 'Earned Leave',
      total: leaveBalance.earned?.total || 0,
      used: leaveBalance.earned?.used || 0,
      color: COLORS.success },
  ];

  const cardW = (doc.page.width - 80) / 3;
  balanceTypes.forEach((bal, i) => {
    const x = 40 + (i * cardW);
    doc.rect(x, balanceY, cardW - 5, 55).fill(COLORS.lightGray);
    doc.fillColor(bal.color)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text(bal.type, x + 8, balanceY + 8,
         { width: cardW - 16 });
    doc.fillColor(COLORS.text)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(
         `${bal.total - bal.used}`,
         x, balanceY + 22,
         { width: cardW - 5, align: 'center' }
       );
    doc.fillColor(COLORS.subtext)
       .fontSize(8)
       .font('Helvetica')
       .text(
         `${bal.used} used of ${bal.total}`,
         x, balanceY + 42,
         { width: cardW - 5, align: 'center' }
       );
  });

  doc.moveDown(5);

  // Leave history table
  doc.fillColor(COLORS.text)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text('Leave History', 40, doc.y);
  doc.moveDown(0.5);

  const leaveTable = {
    headers: [
      { label: 'Applied On', width: 80 },
      { label: 'Leave Type', width: 90 },
      { label: 'From', width: 75 },
      { label: 'To', width: 75 },
      { label: 'Days', width: 40 },
      { label: 'Reason', width: 120 },
      { label: 'Status', width: 70 }
    ],
    rows: leaveRecords.map(leave => [
      new Date(leave.createdAt)
        .toLocaleDateString('en-IN'),
      leave.leaveType || '—',
      new Date(leave.startDate)
        .toLocaleDateString('en-IN'),
      new Date(leave.endDate)
        .toLocaleDateString('en-IN'),
      leave.totalDays?.toString() || '—',
      (leave.reason || '—').substring(0, 40) +
        (leave.reason?.length > 40 ? '...' : ''),
      (leave.status || '—').toUpperCase()
    ])
  };

  await doc.table(leaveTable, {
    prepareHeader: () => {
      doc.font('Helvetica-Bold')
         .fontSize(8)
         .fillColor(COLORS.white);
    },
    prepareRow: (row, indexColumn, indexRow) => {
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(COLORS.text);
      if (indexRow % 2 === 0) {
        doc.rect(
          40, doc.y, doc.page.width - 80, 20
        ).fill(COLORS.lightGray);
      }
    },
    headerColor: COLORS.dark,
    columnSpacing: 5,
    padding: 5,
    x: 40,
    width: doc.page.width - 80
  });

  addPageFooter(doc);
  doc.end();
};

module.exports = {
  addReportHeader,
  addEmployeeInfoCard,
  addPageFooter,
  addAttendanceSection,
  generateAttendancePDF,
  generateBulkAttendancePDF,
  generatePayslipPDF,
  generateLeaveReportPDF
};
