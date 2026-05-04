/**
 * Calculate available balance based on pro-rata monthly accrual
 * Formula: monthsActiveInYear * quotaPerMonth
 * monthsActiveInYear = currentMonth - max(1, joiningMonth) + 1 (clipped to current year)
 */
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
 * Distribute requested leave dates strictly against monthly and yearly limits
 * CL: Max 1/month (Strict, full LWP if exceeded per day)
 * SL: Max 6/year (Strict, full LWP if exceeded per day, only 1.0 allowed)
 * RL: Max 2/year (Strict, full LWP if exceeded per day)
 */
const distributeLeave = (allDates, selectedType, yearlyUsed = { cl: 0, sl: 0, rl: 0 }, isHalfDay = false, joiningDate) => {
  const { toIST } = require('./timeUtils');
  const breakdown = { cl: 0, sl: 0, rl: 0, lwp: 0, dailyBreakdown: [] };
  const dayIncrement = isHalfDay ? 0.5 : 1;
  const YEARLY_LIMITS = { sl: 6, rl: 2 };

  // Sort dates chronologically
  const sortedDates = [...allDates].sort();

  sortedDates.forEach(date => {
    let remainingToDistribute = dayIncrement;

    // CL Accrual Logic: Earn 1 per month worked in the current year
    const d = new Date(date);
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    
    let monthsWorked = month;
    if (joiningDate) {
      const join = toIST(joiningDate);
      if (join.getUTCFullYear() === year) {
        monthsWorked = Math.max(1, month - join.getUTCMonth());
      }
    }
    const clEarnedLimit = Math.min(12, monthsWorked * 1);

    if (selectedType === 'sl') {
      // SL Logic: Full day only and within yearly limit
      if (!isHalfDay && (yearlyUsed.sl || 0) + remainingToDistribute <= YEARLY_LIMITS.sl) {
        breakdown.sl += remainingToDistribute;
        yearlyUsed.sl += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'sl', days: remainingToDistribute });
      } else {
        breakdown.lwp += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
      }
    } else if (selectedType === 'cl') {
      // CL Logic: Total earned balance (carry forward within year)
      if ((yearlyUsed.cl || 0) + remainingToDistribute <= clEarnedLimit) {
        breakdown.cl += remainingToDistribute;
        yearlyUsed.cl += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'cl', days: remainingToDistribute });
      } else {
        breakdown.lwp += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
      }
    } else if (selectedType === 'rl') {
      // RL Logic: Total yearly balance, No half-day allowed
      if (!isHalfDay && (yearlyUsed.rl || 0) + remainingToDistribute <= YEARLY_LIMITS.rl) {
        breakdown.rl += remainingToDistribute;
        yearlyUsed.rl += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'rl', days: remainingToDistribute });
      } else {
        breakdown.lwp += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
      }
    } else {
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
  distributeLeave,
  getDatesBetween
};
