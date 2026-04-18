/**
 * Calculate available balance based on pro-rata monthly accrual
 * Formula: monthsActiveInYear * quotaPerMonth
 * monthsActiveInYear = currentMonth - max(1, joiningMonth) + 1 (clipped to current year)
 */
const calculateAccrualBalance = (balanceDoc, pendingCounts = { cl: 0, sl: 0, rl: 0 }, joiningDate) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let monthsWorked = currentMonth;
  if (joiningDate) {
    const join = new Date(joiningDate);
    if (join.getFullYear() === currentYear) {
      // If joined this year, count only from joining month to now
      monthsWorked = Math.max(1, currentMonth - join.getMonth());
    }
  }

  const clAccrued = Math.min(12, monthsWorked * 1);
  const slAccrued = Math.min(6, monthsWorked * 0.5);
  const rlQuota = 2;

  return {
    cl: Math.max(0, clAccrued - (balanceDoc.casual?.used || 0) - (pendingCounts.cl || 0)),
    sl: Math.max(0, slAccrued - (balanceDoc.sick?.used || 0) - (pendingCounts.sl || 0)),
    rl: Math.max(0, rlQuota - (balanceDoc.religious?.used || 0) - (pendingCounts.rl || 0)),
    lwp: 999 
  };
};

/**
 * Distribute requested leave dates strictly against monthly and yearly limits
 * CL: Max 1/month (Strict, full LWP if exceeded per day)
 * SL: Max 0.5/month (Partial allowed: 0.5 SL + rest LWP)
 * RL: Max 2/year (Strict, full LWP if exceeded per day)
 */
const distributeLeave = (allDates, selectedType, monthlyUsed = {}, yearlyUsed = 0, isHalfDay = false) => {
  const breakdown = { cl: 0, sl: 0, rl: 0, lwp: 0, dailyBreakdown: [] };
  const dayIncrement = isHalfDay ? 0.5 : 1;
  const MONTHLY_LIMITS = { cl: 1, sl: 0.5 };
  const YEARLY_LIMIT = 2; // for RL

  // Sort dates chronologically
  const sortedDates = [...allDates].sort();

  sortedDates.forEach(date => {
    const monthKey = date.slice(0, 7); // "YYYY-MM"
    if (!monthlyUsed[monthKey]) monthlyUsed[monthKey] = { cl: 0, sl: 0 };
    
    let remainingToDistribute = dayIncrement;

    if (selectedType === 'sl') {
      // SL Partial Logic: Use whatever is left of the 0.5 monthly quota, then rest is LWP
      const availableSL = Math.max(0, MONTHLY_LIMITS.sl - (monthlyUsed[monthKey].sl || 0));
      const slToTake = Math.min(availableSL, remainingToDistribute);
      
      if (slToTake > 0) {
        breakdown.sl += slToTake;
        monthlyUsed[monthKey].sl += slToTake;
        remainingToDistribute -= slToTake;
        breakdown.dailyBreakdown.push({ date, leaveType: 'sl', days: slToTake });
      }
      
      if (remainingToDistribute > 0) {
        breakdown.lwp += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
        remainingToDistribute = 0;
      }
    } else if (selectedType === 'cl') {
      // CL Strict Logic: If the day's increment exceeds the 1.0 limit, the WHOLE day's increment is LWP
      if ((monthlyUsed[monthKey].cl || 0) + remainingToDistribute <= MONTHLY_LIMITS.cl) {
        breakdown.cl += remainingToDistribute;
        monthlyUsed[monthKey].cl += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'cl', days: remainingToDistribute });
      } else {
        breakdown.lwp += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
      }
    } else if (selectedType === 'rl') {
      // RL Strict Logic: 2 per year
      if ((yearlyUsed || 0) + remainingToDistribute <= YEARLY_LIMIT) {
        breakdown.rl += remainingToDistribute;
        yearlyUsed += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'rl', days: remainingToDistribute });
      } else {
        breakdown.lwp += remainingToDistribute;
        breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
      }
    } else {
      // Unpaid or other
      breakdown.lwp += remainingToDistribute;
      breakdown.dailyBreakdown.push({ date, leaveType: 'lwp', days: remainingToDistribute });
    }
  });

  return breakdown;
};

const getDatesBetween = (startDate, endDate) => {
  const dates = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

const getCurrentYear = () => new Date().getFullYear();

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
