/**
 * Calculate dynamic leave balances
 * Source of Truth: Attendance records (leaveMeta)
 */
const calculateDynamicLeaveBalance = async (user, AttendanceModel, currentYear) => {
  const { toIST } = require('./timeUtils');
  const istNow = toIST();
  const currentMonth = istNow.getUTCMonth() + 1;

  // 1. Casual Leave (CL): 1 per month since joining
  const joinDate = user.joiningDate ? toIST(user.joiningDate) : toIST(user.createdAt);
  const joinYear = joinDate.getUTCFullYear();
  const joinMonth = joinDate.getUTCMonth() + 1;

  // Total months earned since joining
  const totalMonths = (currentYear - joinYear) * 12 + (currentMonth - joinMonth) + 1;
  const clEarned = Math.max(0, totalMonths);

  // 2. Fetch ALL-TIME attendance for CL and CURRENT-YEAR for SL/RL
  const [clRecords, yearlyRecords] = await Promise.all([
    AttendanceModel.find({ userId: user._id, 'leaveMeta.cl': { $gt: 0 } }),
    AttendanceModel.find({ 
      userId: user._id, 
      date: { $gte: `${currentYear}-01-01`, $lte: `${currentYear}-12-31` }
    })
  ]);

  const clUsed = clRecords.reduce((sum, rec) => sum + (rec.leaveMeta?.cl || 0), 0);
  const slUsed = yearlyRecords.reduce((sum, rec) => sum + (rec.leaveMeta?.sl || 0), 0);
  const rlUsed = yearlyRecords.reduce((sum, rec) => sum + (rec.leaveMeta?.rl || 0), 0);
  const lwpUsed = yearlyRecords.reduce((sum, rec) => sum + (rec.leaveMeta?.lwp || 0), 0);

  return {
    cl: { earned: clEarned, used: clUsed, available: Math.max(0, clEarned - clUsed) },
    sl: { total: 6, used: slUsed, available: Math.max(0, 6 - slUsed) },
    rl: { total: 2, used: rlUsed, available: Math.max(0, 2 - rlUsed) },
    lwp: { used: lwpUsed }
  };
};

const calculateAccrualBalance = (balanceDoc, pendingCounts = { cl: 0, sl: 0, rl: 0 }, joiningDate) => {
  const { toIST } = require('./timeUtils');
  const istNow = toIST();
  
  const currentYear = istNow.getUTCFullYear();
  const currentMonth = istNow.getUTCMonth() + 1;

  let monthsWorked = currentMonth;
  if (joiningDate) {
    const join = toIST(joiningDate);
    if (join.getUTCFullYear() === currentYear) {
      monthsWorked = Math.max(1, currentMonth - join.getUTCMonth());
    }
  }

  const clEarned = Math.min(12, monthsWorked * 1);
  const slTotal = balanceDoc.sick?.total || 6;
  const rlTotal = balanceDoc.religious?.total || 2;

  return {
    cl: Math.max(0, clEarned - (balanceDoc.casual?.used || 0) - (pendingCounts.cl || 0)),
    sl: Math.max(0, slTotal - (balanceDoc.sick?.used || 0) - (pendingCounts.sl || 0)),
    rl: Math.max(0, rlTotal - (balanceDoc.religious?.used || 0) - (pendingCounts.rl || 0)),
    lwp: 999 
  };
};

/**
 * Distribute requested leave dates strictly against a balance object
 * cl, sl, rl: Strict limits from balance
 * monthlyCLRemaining: Limit for the current month
 * If balance exceeded: Automatically converts to LWP
 */
const distributeLeave = (allDates, selectedType, balance = { cl: 12, sl: 6, rl: 2 }, isHalfDay = false, monthlyCLRemaining = 1) => {
  const breakdown = { cl: 0, sl: 0, rl: 0, lwp: 0, dailyBreakdown: [] };
  const dayIncrement = isHalfDay ? 0.5 : 1;
  const currentBalance = { ...balance };
  let currentMonthlyCLRemaining = monthlyCLRemaining;

  // Sort dates chronologically
  const sortedDates = [...allDates].sort();

  sortedDates.forEach(date => {
    let remainingToDistribute = dayIncrement;

    if (selectedType === 'sl') {
      // SL Logic: Within available balance, usually only full days
      if (currentBalance.sl >= remainingToDistribute) {
        breakdown.sl += remainingToDistribute;
        currentBalance.sl -= remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'sl', days: remainingToDistribute });
      } else {
        // Partial SL / Full LWP
        const allowed = Math.max(0, currentBalance.sl);
        if (allowed > 0) {
          breakdown.sl += allowed;
          breakdown.lwp += (remainingToDistribute - allowed);
          currentBalance.sl = 0;
          breakdown.dailyBreakdown.push({ date, leaveType: 'sl', days: allowed });
          breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute - allowed });
        } else {
          breakdown.lwp += remainingToDistribute;
          breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
        }
      }
    } else if (selectedType === 'cl') {
      // Limit to whichever is smaller: yearly balance or monthly allowed
      const effectiveCLBalance = Math.min(currentBalance.cl, currentMonthlyCLRemaining);

      if (effectiveCLBalance >= remainingToDistribute) {
        breakdown.cl += remainingToDistribute;
        currentBalance.cl -= remainingToDistribute;
        currentMonthlyCLRemaining -= remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'cl', days: remainingToDistribute });
      } else {
        const allowed = Math.max(0, effectiveCLBalance);
        if (allowed > 0) {
          breakdown.cl += allowed;
          breakdown.lwp += (remainingToDistribute - allowed);
          currentBalance.cl -= allowed;
          currentMonthlyCLRemaining = 0;
          breakdown.dailyBreakdown.push({ date, leaveType: 'cl', days: allowed });
          breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute - allowed });
        } else {
          breakdown.lwp += remainingToDistribute;
          breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
        }
      }
    } else if (selectedType === 'rl') {
      if (currentBalance.rl >= remainingToDistribute) {
        breakdown.rl += remainingToDistribute;
        currentBalance.rl -= remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'rl', days: remainingToDistribute });
      } else {
        const allowed = Math.max(0, currentBalance.rl);
        if (allowed > 0) {
          breakdown.rl += allowed;
          breakdown.lwp += (remainingToDistribute - allowed);
          currentBalance.rl = 0;
          breakdown.dailyBreakdown.push({ date, leaveType: 'rl', days: allowed });
          breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute - allowed });
        } else {
          breakdown.lwp += remainingToDistribute;
          breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
        }
      }
    } else {
      // Default to LWP (unpaid)
      breakdown.lwp += remainingToDistribute;
      breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
    }
  });

  return breakdown;
};

const getDatesBetween = (startDate, endDate) => {
  const { getISTDateString } = require('./timeUtils');
  const dates = [];
  let curr = new Date(startDate);
  // Ensure we are working with midnight UTC to avoid T+5:30 shifting issues
  curr.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (curr <= end) {
    dates.push(getISTDateString(curr));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
};

const { getCurrentYear } = require('./timeUtils');

const dateRangesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  return s1 <= e2 && s2 <= e1;
};

module.exports = {
  getCurrentYear,
  dateRangesOverlap,
  calculateAccrualBalance,
  calculateDynamicLeaveBalance,
  distributeLeave,
  getDatesBetween
};
