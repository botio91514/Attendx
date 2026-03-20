/**
 * Get current date in YYYY-MM-DD format
 * @returns {String} date string
 */
const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format a date object to YYYY-MM-DD
 * @param {Date} date
 * @returns {String} date string
 */
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get start and end date strings for a given month and year
 * @param {Number} year
 * @param {Number} month (1-12)
 * @returns {Object} { startStr, endStr }
 */
const getMonthRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month
  
  return {
    startStr: formatDate(startDate),
    endStr: formatDate(endDate),
  };
};

/**
 * Calculate totals and averages from a list of attendance records
 * @param {Array} attendanceRecords
 * @returns {Object} stats
 */
const calculateStats = (records) => {
  const stats = {
    totalDays: records.length,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDayCount: 0,
    totalWorkingHours: 0,
    totalBreakTime: 0,
    averageWorkingHours: 0,
  };

  records.forEach((record) => {
    stats[record.status + 'Days'] = (stats[record.status + 'Days'] || 0) + 1;
    if (record.status === 'half-day') stats.halfDayCount++;
    if (record.status === 'present' || record.status === 'late' || record.status === 'half-day') {
      stats.presentDays++;
    }
    
    stats.totalWorkingHours += record.totalWorkingHours || 0;
    stats.totalBreakTime += record.totalBreakTime || 0;
  });

  if (stats.presentDays > 0) {
    stats.averageWorkingHours = (stats.totalWorkingHours / stats.presentDays / 60).toFixed(2);
  }

  return stats;
};

module.exports = {
  getTodayDate,
  formatDate,
  getMonthRange,
  calculateStats,
};
