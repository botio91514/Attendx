/**
 * Calculate total working days between two dates, excluding non-working days and holidays
 * @param {Date|String} startDate
 * @param {Date|String} endDate
 * @param {Array<Number>} workingDays - Array of days [0-6] that are working days
 * @param {Array<String>} holidays - Array of ISO date strings (YYYY-MM-DD)
 * @returns {Number} working days count
 */
const calculateWorkingDays = (startDate, endDate, workingDays = [1, 2, 3, 4, 5], holidays = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) return 0;
  
  // Normalize holidays to YYYY-MM-DD for quick comparison
  const holidayStrings = (holidays || []).map(h => {
    const d = new Date(h);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  let count = 0;
  let current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay(); 
    const dateStr = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}-${current.getDate().toString().padStart(2, '0')}`;

    const isWorkingDay = workingDays.includes(dayOfWeek);
    const isHoliday = holidayStrings.includes(dateStr);

    if (isWorkingDay && !isHoliday) {
      count++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

/**
 * Get current year
 * @returns {Number}
 */
const getCurrentYear = () => {
  return new Date().getFullYear();
};

/**
 * Check if two date ranges overlap
 * @param {Date|String} start1
 * @param {Date|String} end1
 * @param {Date|String} start2
 * @param {Date|String} end2
 * @returns {Boolean}
 */
const dateRangesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  
  return s1 <= e2 && s2 <= e1;
};

module.exports = {
  calculateWorkingDays,
  getCurrentYear,
  dateRangesOverlap,
};
