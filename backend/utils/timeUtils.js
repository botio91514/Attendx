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
 * @returns {Date} - Current time shifted by +5.5 hours
 */
const getCurrentISTTime = () => {
  const d = new Date();
  // Idempotency: If this server is ALREADY in IST, new Date() is local.
  // We check the offset to ensure we only shift if the environment is NOT IST.
  const isLocalIST = d.getTimezoneOffset() === -330;
  if (isLocalIST) return d;
  
  return new Date(d.getTime() + IST_OFFSET);
};

/**
 * Converts any date to an IST-shifted Date object.
 * Idempotent: Won't double-shift if the date is already in the "IST Range".
 */
const toIST = (date) => {
  if (!date) return getCurrentISTTime();
  const d = new Date(date);
  
  // Idempotency check:
  // If the hour is > 7, it's highly likely it's already shifted for this DB.
  // Morning check-ins (9am-12pm IST) are 3:30am-6:30am UTC (Raw) or 9am-12pm UTC (Shifted).
  if (d.getUTCHours() >= 7) return d;
  
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
const getISTMinutesFromMidnight = (date) => {
  const d = toIST(date);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

module.exports = {
  getCurrentISTTime,
  toIST,
  getISTDateString,
  formatISTTime,
  getCurrentYear,
  getCurrentMonth,
  getISTMinutesFromMidnight,
  IST_OFFSET
};
