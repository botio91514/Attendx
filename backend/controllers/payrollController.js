const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const Payroll = require('../models/Payroll');
const Leave = require('../models/Leave');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { getMonthRange } = require('../utils/attendanceHelpers');
const { sendEmail } = require('../utils/emailService');
const { payslipTemplate } = require('../utils/emailTemplates');

/**
 * @desc    Get payroll summary/preview for a specific month
 * @route   GET /api/payroll/admin/summary
 * @access  Private/Admin
 */
const getPayrollSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Please provide month and year' });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    // Get company settings for working days
    const settings = await Settings.getSettings();
    const workingDaysConfig = settings.workingDays || [1, 2, 3, 4, 5]; // Default Mon-Fri if error

    // 1. Check if finalized records already exist in DB
    const existingPayroll = await Payroll.find({ month: m, year: y })
      .populate('userId', 'name email employeeId department designation baseSalary joiningDate');

    if (existingPayroll.length > 0) {
      return res.status(200).json({
        success: true,
        data: {
          month: m,
          year: y,
          isFinalized: true,
          totalStaff: existingPayroll.length,
          payroll: existingPayroll.map(p => ({
            ...p.toObject(),
            name: p.userId?.name,
            email: p.userId?.email,
            employeeId: p.userId?.employeeId,
            department: p.userId?.department,
            designation: p.userId?.designation,
            baseSalary: p.baseSalary, 
            stats: {
              present: p.presentDays,
              halfDay: p.halfDays,
              absent: p.absentDays,
              late: p.lateDays
            },
            calculations: {
              totalWorkingDays: p.workingDays,
              payableDays: p.payableDays,
              dailyRate: p.dailyRate,
              grossSalary: p.grossSalary,
              bonus: p.bonus,
              deductions: p.deductions,
              netSalary: p.netSalary
            }
          }))
        }
      });
    }

    // 2. If not finalized, generate a dynamic preview
    const { startStr, endStr } = getMonthRange(y, m);
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    // 🛡️ FINANCIAL AUDIT FIX: Include everyone active during the month 
    // (mid-month joiners AND resigners)
    const employees = await User.find({ 
      role: 'employee',
      $and: [
        { joiningDate: { $lte: endDate } },
        { 
          $or: [
            { isActive: true }, 
            { leavingDate: { $gte: startDate } }
          ] 
        }
      ]
    }).select('name email employeeId department designation baseSalary joiningDate leavingDate');
    
    const employeeIds = employees.map(e => e._id);

    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    // Get all approved leaves for these users in this month
    const leaves = await Leave.find({
      userId: { $in: employeeIds },
      status: 'approved',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    });

    const allAttendance = await Attendance.find({
      userId: { $in: employeeIds },
      date: { $gte: startStr, $lte: endStr }
    });

    // Helper to calculate working days based on company settings and holidays
    const countWorkingDays = (from, to) => {
      let count = 0;
      let curr = new Date(from);
      while (curr <= to) {
        const day = curr.getDay();
        // Check if the day is in the company's working days array AND not a public holiday
        if (workingDaysConfig.includes(day) && !holidayDates.includes(curr.toISOString().split('T')[0])) {
          count++;
        }
        curr.setDate(curr.getDate() + 1);
      }
      return count;
    };

    const totalWorkingDaysInMonth = countWorkingDays(startDate, endDate);

    const payrollData = employees.map((emp) => {
      // PRO LOGIC: Handle Mid-month joiners AND resigners
      const effectiveStartDate = (emp.joiningDate && new Date(emp.joiningDate) > startDate) ? new Date(emp.joiningDate) : startDate;
      const effectiveEndDate = (emp.leavingDate && new Date(emp.leavingDate) < endDate) ? new Date(emp.leavingDate) : endDate;
      
      const empWorkingDays = countWorkingDays(effectiveStartDate, effectiveEndDate);

      const attendance = allAttendance.filter(a => a.userId.toString() === emp._id.toString());
      
      let p = 0, h = 0, lateCount = 0; 
      let clDaysInMonth = 0, slDaysInMonth = 0, rlDaysInMonth = 0, lwpDaysInMonth = 0;
      let attendance_payable = 0;

      attendance.forEach(record => {
        // Stats for absolute counts (independent of pay)
        if (record.status === 'late') lateCount++;

        // 🛡️ SYNC RULE: Read leaveMeta (Source of Truth)
        const meta = record.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
        const totalLeave = (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0) + (meta.lwp || 0);
        
        clDaysInMonth += (meta.cl || 0);
        slDaysInMonth += (meta.sl || 0);
        rlDaysInMonth += (meta.rl || 0);
        lwpDaysInMonth += (meta.lwp || 0);

        // 🛡️ SYNC RULE: Add work credit ONLY if leave < 1.0
        if (totalLeave < 1.0) {
          let workCredit = 0;
          if (record.status === 'present' || record.status === 'late') workCredit = 1.0;
          else if (record.status === 'half-day') workCredit = 0.5;

          const maxAllowedWork = 1.0 - totalLeave;
          const actualWorkCredit = Math.min(workCredit, maxAllowedWork);
          
          attendance_payable += actualWorkCredit;
          
          // Stats for payroll summary display
          if (workCredit === 1.0 && actualWorkCredit > 0) p++;
          else if (workCredit === 0.5 && actualWorkCredit > 0) h++;
        }
      });

      const paidLeaveDaysInMonth = clDaysInMonth + slDaysInMonth + rlDaysInMonth;

      console.log(`[DEBUG] Final Sync Payroll for ${emp.name}:`, {
        present: p,
        halfDay: h,
        paidLeave: paidLeaveDaysInMonth,
        lwp: lwpDaysInMonth,
        attendance_payable
      });

      const leaveDaysCount = paidLeaveDaysInMonth;
      
      // 🛡️ FINANCIAL AUDIT FIX: High precision daily rate (no rounding yet)
      const dailyRate = totalWorkingDaysInMonth > 0 ? emp.baseSalary / totalWorkingDaysInMonth : 0;
      
      // Payable days = Accumulated work/leave credit (clamped to max working days later)
      const payableDays = attendance_payable + leaveDaysCount;
      
      // 🛡️ FINANCIAL AUDIT FIX: Pay ONLY for worked or approved leave days
      const grossAmount = payableDays * dailyRate;
      const bonus = 0;
      const otherDeductions = 0;
      const deductionAmount = otherDeductions;
      const netSalary = (grossAmount - deductionAmount + bonus);

      return {
        _id: emp._id,
        userId: emp._id,
        name: emp.name,
        email: emp.email,
        employeeId: emp.employeeId,
        department: emp.department,
        designation: emp.designation,
        baseSalary: emp.baseSalary,
        status: 'draft',
        stats: {
          present: p,
          halfDay: h,
          absent: Math.max(0, empWorkingDays - (p + h) - (paidLeaveDaysInMonth + lwpDaysInMonth)),
          late: lateCount,
          leave: paidLeaveDaysInMonth,
          lwp: lwpDaysInMonth,
          cl: clDaysInMonth, // Added for clarity
          sl: slDaysInMonth,
          rl: rlDaysInMonth
        },
        calculations: {
          totalWorkingDays: totalWorkingDaysInMonth,
          expectedWorkingDays: empWorkingDays, 
          payableDays: parseFloat(Math.min(empWorkingDays, payableDays).toFixed(2)),
          dailyRate: dailyRate,
          grossAmount: grossAmount,
          deductionAmount: deductionAmount,
          bonus: bonus,
          netSalary: Math.round(netSalary)
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        month: m,
        year: y,
        isFinalized: false,
        totalStaff: employees.length,
        payroll: payrollData
      }
    });
  } catch (error) {
    next(error);
  }
};

const processPayroll = async (req, res, next) => {
  try {
    const { month, year, items } = req.body; 

    // 🛡️ FINANCIAL AUDIT FIX: Prevent silent overwrite of finalized payroll
    const existing = await Payroll.findOne({ month, year });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'This month is already finalized. Please unlock it manually if you need to modify records.' 
      });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll data' });
    }

    const payrollRecords = items.map(item => ({
      userId: item.userId,
      month,
      year,
      baseSalary: item.baseSalary,
      workingDays: item.calculations.totalWorkingDays,
      presentDays: item.stats.present,
      halfDays: item.stats.halfDay,
      lateDays: item.stats.late,
      absentDays: item.stats.absent,
      clDays: item.stats.cl || 0,
      slDays: item.stats.sl || 0,
      rlDays: item.stats.rl || 0,
      lwpDays: item.stats.lwp || 0,
      payableDays: item.calculations.payableDays,
      dailyRate: item.calculations.dailyRate,
      grossAmount: item.calculations.grossAmount,
      deductionAmount: item.calculations.deductionAmount,
      bonus: item.calculations.bonus || 0,
      netSalary: item.calculations.netSalary || item.calculations.grossAmount,
      status: 'finalized',
      processedBy: req.user._id
    }));

    // Use bulkWrite for performance and atomicity
    const ops = payrollRecords.map(record => ({
      updateOne: {
        filter: { userId: record.userId, month: record.month, year: record.year },
        update: { $set: record },
        upsert: true
      }
    }));

    await Payroll.bulkWrite(ops);

    // --- AUDIT LOG (ADDED) ---
    await AuditLog.create({
      action: 'PAYROLL_FINALIZE',
      performedBy: req.user._id,
      details: `Finalized and locked payroll for ${month}/${year}. Records created for ${payrollRecords.length} staff.`
    });

    res.status(200).json({
      success: true,
      message: `Payroll for ${month}/${year} has been finalized and locked.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update individual payroll record (e.g., add bonus)
 * @route   PUT /api/payroll/admin/:id
 * @access  Private/Admin
 */
const updatePayroll = async (req, res, next) => {
  try {
    const { bonus, deductions, notes, status, transactionId, paymentMethod } = req.body;
    const payroll = await Payroll.findById(req.params.id).populate('userId');

    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    if (bonus !== undefined) payroll.bonus = bonus;
    if (deductions !== undefined) payroll.deductionAmount = deductions;
    if (notes !== undefined) payroll.notes = notes;
    if (status) payroll.status = status;
    if (transactionId) payroll.transactionId = transactionId;
    if (paymentMethod) payroll.paymentMethod = paymentMethod;

    if (status === 'paid' && !payroll.paidAt) {
      payroll.paidAt = new Date();
    }

    // Recalculate net: (Gross + Bonus) - Deductions
    payroll.netSalary = Math.round((payroll.grossAmount + (payroll.bonus || 0)) - (payroll.deductionAmount || 0));
    
    await payroll.save();

    // --- AUDIT LOG (ADDED) ---
    await AuditLog.create({
      action: 'PAYROLL_UPDATE',
      performedBy: req.user._id,
      details: `Updated payroll for ${payroll.userId.name} (${payroll.month}/${payroll.year}). Status: ${status || payroll.status}, Bonus: ${bonus || 0}, Net: ${payroll.netSalary}`
    });

    // Notify employee if marked as paid
    if (status === 'paid' && payroll.userId?.email) {
      try {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        await sendEmail({
          to: payroll.userId.email,
          subject: `💰 Salary Credited: ${monthNames[payroll.month - 1]} ${payroll.year}`,
          html: payslipTemplate({
            employeeName: payroll.userId.name,
            month: monthNames[payroll.month - 1],
            year: payroll.year,
            basicSalary: payroll.baseSalary,
            deductions: (payroll.deductions || 0) + Math.max(0, payroll.baseSalary - payroll.grossSalary),
            bonuses: payroll.bonus,
            netSalary: payroll.netSalary,
            presentDays: payroll.presentDays,
            absentDays: payroll.absentDays,
            lateDays: payroll.lateDays,
            paymentMethod: payroll.paymentMethod,
            transactionId: payroll.transactionId
          })
        });
      } catch (err) {
        console.error('Email notification failed for individual payroll:', err);
      }
    }

    res.status(200).json({
      success: true,
      data: payroll,
      message: 'Payroll updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark multiple payroll records as paid
 * @route   PUT /api/payroll/admin/bulk-pay
 * @access  Private/Admin
 */
const bulkPay = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs' });
    }

    const records = await Payroll.find({ _id: { $in: ids } }).populate('userId');

    await Payroll.updateMany(
      { _id: { $in: ids } },
      { 
        $set: { 
          status: 'paid', 
          paidAt: new Date() 
        } 
      }
    );

    // Send bulk emails
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // We do this in a background-ish way
    Promise.allSettled(records.map(async (payroll) => {
      if (payroll.userId?.email) {
        await sendEmail({
          to: payroll.userId.email,
          subject: `💰 Salary Credited: ${monthNames[payroll.month - 1]} ${payroll.year}`,
          html: payslipTemplate({
            employeeName: payroll.userId.name,
            month: monthNames[payroll.month - 1],
            year: payroll.year,
            basicSalary: payroll.baseSalary,
            deductions: (payroll.deductions || 0) + Math.max(0, payroll.baseSalary - payroll.grossSalary),
            bonuses: payroll.bonus,
            netSalary: (payroll.grossSalary + (payroll.bonus || 0)) - (payroll.deductions || 0),
            presentDays: payroll.presentDays,
            absentDays: payroll.absentDays,
            lateDays: payroll.lateDays,
            paymentMethod: payroll.paymentMethod,
            transactionId: payroll.transactionId
          })
        });
      }
    })).catch(err => console.error('Bulk email error:', err));

    // --- AUDIT LOG (ADDED) ---
    await AuditLog.create({
      action: 'PAYROLL_BULK_PAY',
      performedBy: req.user._id,
      details: `Marked ${ids.length} payroll records as PAID for ${records[0]?.month}/${records[0]?.year}.`
    });

    res.status(200).json({
      success: true,
      message: `${ids.length} payments marked as completed and notifications sent.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get personal payroll history or specific month preview
 * @route   GET /api/payroll/my
 * @access  Private
 */
const getMyPayroll = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    
    // If no month/year provided, return history of finalized/paid records
    if (!month || !year) {
      const history = await Payroll.find({ 
        userId: req.user._id, 
        status: { $in: ['finalized', 'paid'] } 
      }).sort({ year: -1, month: -1 });

      return res.status(200).json({
        success: true,
        data: history
      });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    // 1. Check if finalized record exists
    const record = await Payroll.findOne({ 
      userId: req.user._id, 
      month: m, 
      year: y 
    });

    if (record) {
      return res.status(200).json({
        success: true,
        isFinalized: true,
        data: record
      });
    }

    // 2. Generate dynamic preview (Draft)
    const settings = await Settings.getSettings();
    const workingDaysConfig = settings.workingDays || [1, 2, 3, 4, 5];
    const { startStr, endStr } = getMonthRange(y, m);
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    const leaves = await Leave.find({
      userId: req.user._id,
      status: 'approved',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    });

    const attendanceRecords = await Attendance.find({
      userId: req.user._id,
      date: { $gte: startStr, $lte: endStr }
    });

    // Reuse working day counter
    const countWorkingDays = (from, to) => {
      let count = 0;
      let curr = new Date(from);
      while (curr <= to) {
        const day = curr.getDay();
        if (workingDaysConfig.includes(day) && !holidayDates.includes(curr.toISOString().split('T')[0])) {
          count++;
        }
        curr.setDate(curr.getDate() + 1);
      }
      return count;
    };

    const totalWorkingDaysInMonth = countWorkingDays(startDate, endDate);
    const effectiveStartDate = (req.user.joiningDate && new Date(req.user.joiningDate) > startDate) ? new Date(req.user.joiningDate) : startDate;
    const effectiveEndDate = (req.user.leavingDate && new Date(req.user.leavingDate) < endDate) ? new Date(req.user.leavingDate) : endDate;
    const empWorkingDays = countWorkingDays(effectiveStartDate, effectiveEndDate);

    let p = 0, l = 0, h = 0;
    let clDaysInMonth = 0, slDaysInMonth = 0, rlDaysInMonth = 0, lwpDaysInMonth = 0;
    let attendance_payable = 0;

    attendanceRecords.forEach(record => {
      // 🛡️ SYNC RULE: Read leaveMeta (Source of Truth)
      const meta = record.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
      const totalLeave = (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0) + (meta.lwp || 0);

      clDaysInMonth += (meta.cl || 0);
      slDaysInMonth += (meta.sl || 0);
      rlDaysInMonth += (meta.rl || 0);
      lwpDaysInMonth += (meta.lwp || 0);

      // 🛡️ SYNC RULE: Add work credit ONLY if leave < 1.0 (Rule 3)
      if (totalLeave < 1.0) {
        let workCredit = 0;
        if (record.status === 'present' || record.status === 'late') workCredit = 1.0;
        else if (record.status === 'half-day') workCredit = 0.5;

        const maxAllowedWork = 1.0 - totalLeave;
        const actualWorkCredit = Math.min(workCredit, maxAllowedWork);

        attendance_payable += actualWorkCredit;

        // Stats tracking
        if (workCredit === 1.0 && actualWorkCredit > 0) p++;
        else if (workCredit === 0.5 && actualWorkCredit > 0) h++;
        if (record.status === 'late') l++;
      }
    });

    const paidLeaveDaysInMonth = clDaysInMonth + slDaysInMonth + rlDaysInMonth;

    console.log(`[DEBUG] My Sync Payroll:`, {
      present: p,
      halfDay: h,
      paidLeave: paidLeaveDaysInMonth,
      lwp: lwpDaysInMonth,
      attendance_payable
    });

    const leaveDaysCount = paidLeaveDaysInMonth;
    const dailyRate = totalWorkingDaysInMonth > 0 ? req.user.baseSalary / totalWorkingDaysInMonth : 0;
    // 🛡️ FINANCIAL AUDIT FIX: Use accumulated attendance_payable to handle partial overlaps correctly
    const payableDays = attendance_payable + leaveDaysCount;

    // 🛡️ FINANCIAL AUDIT FIX: Pay ONLY for worked or approved leave days
    const grossAmount = payableDays * dailyRate;
    const bonus = 0;
    const otherDeductions = 0;
    const deductionAmount = otherDeductions;
    const netSalary = (grossAmount - deductionAmount + bonus);

    const draftData = {
      userId: req.user._id,
      month: m,
      year: y,
      baseSalary: req.user.baseSalary,
      status: 'draft',
      presentDays: p,
      halfDays: h,
      lateDays: l,
      absentDays: Math.max(0, empWorkingDays - (p + h) - (paidLeaveDaysInMonth + lwpDaysInMonth)),
      clDays: clDaysInMonth,
      slDays: slDaysInMonth,
      rlDays: rlDaysInMonth,
      lwpDays: lwpDaysInMonth,
      leaveDays: leaveDaysCount,
      payableDays: parseFloat(Math.min(empWorkingDays, payableDays).toFixed(2)),
      dailyRate: dailyRate,
      grossAmount: grossAmount,
      deductionAmount: deductionAmount,
      bonus: 0,
      netSalary: Math.round(netSalary),
      workingDays: totalWorkingDaysInMonth
    };

    res.status(200).json({
      success: true,
      isFinalized: false,
      data: draftData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete finalized payroll records for a month to revert to draft
 * @route   DELETE /api/payroll/admin/unlock
 * @access  Private/Admin
 */
const unlockPayroll = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year required' });
    }

    // Check if any are already marked as paid
    const paidRecords = await Payroll.find({ month, year, status: 'paid' });
    if (paidRecords.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot unlock month because some employees have already been marked as PAID. Revert them to Ready first.' 
      });
    }

    await Payroll.deleteMany({ month, year });

    // 🛡️ FINANCIAL AUDIT FIX: Maintain accountability for sensitive unlock actions
    await AuditLog.create({
      action: 'PAYROLL_UNLOCK',
      performedBy: req.user._id,
      details: `Unlocked payroll records for ${month}/${year}. Draft system now active.`
    });

    res.status(200).json({
      success: true,
      message: `Month ${month}/${year} has been unlocked. Records are now dynamic calculations.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayrollSummary,
  processPayroll,
  updatePayroll,
  bulkPay,
  getMyPayroll,
  unlockPayroll
};
