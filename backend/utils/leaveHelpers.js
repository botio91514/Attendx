/**
 * Calculate total working days and per-year breakdown between two dates
 * @param {Date|String} startDate
 * @param {Date|String} endDate
 * @param {Array<Number>} workingDays - Days [0-6]
 * @param {Array<String>} holidays - ISO dates YYYY-MM-DD
 * @returns {Object} { total: Number, breakdown: { year: [dates] } }
 */
const getLeaveBreakdown = (startDate, endDate, workingDays = [1, 2, 3, 4, 5], holidays = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) return { total: 0, breakdown: {} };
  
  const holidayStrings = (holidays || []).map(h => {
    const d = new Date(h);
    return d.toISOString().split('T')[0];
  });

  let total = 0;
  let breakdown = {};
  let current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay(); 
    const dateStr = current.toISOString().split('T')[0];
    const year = current.getFullYear();

    const isWorkingDay = workingDays.includes(dayOfWeek);
    const isHoliday = holidayStrings.includes(dateStr);

    if (isWorkingDay && !isHoliday) {
      total++;
      if (!breakdown[year]) breakdown[year] = [];
      breakdown[year].push(dateStr);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return { total, breakdown };
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
  getLeaveBreakdown,
  getCurrentYear,
  dateRangesOverlap,
};
