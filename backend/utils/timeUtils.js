/**
 * Centralized Time Utilities for IST (India Standard Time)
 * India is always UTC+5:30 (No Daylight Saving Time)
 * 
 * Strategy: "IST-as-UTC" 
 * We store dates in MongoDB such that the UTC time matches the Indian wall-clock time.
 * This bypasses environment-specific timezone shifting and allows easy DB querying.
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/**
 * Replace all 'new Date()' calls with this to get a consistent IST-shifted Date object.
 * This function is now "timezone-blind" to ensure it works on both UTC and IST servers.
 * @returns {Date} - A Date object where UTC components match IST Wall-Clock time.
 */
const getCurrentISTTime = () => {
  const d = new Date();
  // Get absolute UTC epoch and add 5.5 hours
  return new Date(d.getTime() + IST_OFFSET);
};

/**
 * Converts any date to an IST-shifted Date object (IST-as-UTC).
 * This ensures that d.toISOString() always represents the Indian wall-clock time.
 */
const toIST = (date) => {
  if (!date) return getCurrentISTTime();
  const d = new Date(date);
  // Get absolute UTC epoch and add 5.5 hours
  return new Date(d.getTime() + IST_OFFSET);
};

/**
 * Returns YYYY-MM-DD string in IST
 */
const getISTDateString = (date) => {
  const ist = toIST(date);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Returns HH:MM AM/PM string in IST
 */
const formatISTTime = (date, isAlreadyShifted = true) => {
  if (!date) return '—';
  const d = isAlreadyShifted ? new Date(date) : toIST(date);
  
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

/**
 * Returns current year in IST
 */
const getCurrentYear = () => {
  return toIST().getUTCFullYear();
};

/**
 * Returns current month (1-12) in IST
 */
const getCurrentMonth = () => {
  return toIST().getUTCMonth() + 1;
};

/**
 * Safe Minutes from Midnight in IST
 */
/**
 * Safe Minutes from Midnight in IST
 * Expects a Date object (either Real UTC or Virtual IST)
 */
const getISTMinutesFromMidnight = (date) => {
  if (!date) return 0;
  const d = new Date(date);
  
  // Rule: If the date is far in the future compared to real Now, 
  // it's likely already a "Virtual IST" shifted date.
  const isAlreadyShifted = (d.getTime() - new Date().getTime()) > (2 * 60 * 60 * 1000);
  
  if (isAlreadyShifted) {
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  
  // Otherwise, treat as real UTC and shift
  const ist = toIST(d);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

/**
 * Converts a raw user-input string (e.g. "09:30") or date string from the frontend
 * into an IST-shifted Date object for storage.
 * Use this for Admin Overrides or any manual input.
 */
const parseISTToShiftedDate = (input) => {
  if (!input) return getCurrentISTTime();
  const date = new Date(input);
  
  // If the input is just a time string "HH:MM", we combine it with today's IST date
  if (typeof input === 'string' && input.length <= 8) {
    const today = getISTDateString();
    return toIST(`${today}T${input}`);
  }

  // Otherwise, treat as a date/datetime and shift
  return toIST(date);
};

module.exports = {
  getCurrentISTTime,
  toIST,
  getISTDateString,
  formatISTTime,
  getCurrentYear,
  getCurrentMonth,
  getISTMinutesFromMidnight,
  parseISTToShiftedDate,
  IST_OFFSET
};
