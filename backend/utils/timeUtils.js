/**
 * Centralized Time Utilities for IST (India Standard Time)
 * Professional approach to handle timezones without environmental dependencies.
 */

// India is always UTC+5:30 (No Daylight Saving Time)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/**
 * Converts any date to an IST Date object (shifted for calculation)
 * Note: Use this only for getting components (hours, day, etc.) from a UTC date.
 */
const toIST = (date = new Date()) => {
  const d = new Date(date);
  return new Date(d.getTime() + IST_OFFSET);
};

/**
 * Gets the current date string in YYYY-MM-DD format (IST)
 */
const getISTDateString = (date = new Date()) => {
  const ist = toIST(date);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Gets current IST hours and minutes
 * @returns {Object} { hours, minutes }
 */
const getISTTime = (date = new Date()) => {
  const ist = toIST(date);
  return {
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
    dayOfWeek: ist.getUTCDay()
  };
};

/**
 * Formats a date to 12h time string (IST)
 * Example: "09:15 AM"
 */
const formatISTTime = (date = new Date()) => {
  if (!date) return '—';
  const { hours, minutes } = getISTTime(date);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

/**
 * Professional helper to calculate total minutes from midnight in IST
 */
const getISTMinutesFromMidnight = (date = new Date()) => {
  const { hours, minutes } = getISTTime(date);
  return hours * 60 + minutes;
};

module.exports = {
  toIST,
  getISTDateString,
  getISTTime,
  formatISTTime,
  getISTMinutesFromMidnight,
  IST_OFFSET
};
