/**
 * Centralized Time Utilities for IST (India Standard Time)
 * Professional approach to handle timezones without environmental dependencies.
 */

// India is always UTC+5:30 (No Daylight Saving Time)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/**
 * Converts any date to an IST Date object (shifted for calculation/display in DB)
 * Use this for timestamping events (check-in, check-out, approval) to store IST in DB.
 */
const toIST = (date = new Date()) => {
  const d = new Date(date);
  
  // If the date is already significantly ahead of "now" by roughly 5.5 hours,
  // it might already be an IST-shifted date. 
  // However, a better way is to just assume new Date() or ISO strings need shifting.
  // To avoid double-shifting when retrieving from DB:
  // If we're calling toIST(toIST(now)), we'd have a problem.
  // Professional fix: Only shift if the date is not already "marked" or shifted.
  // For this project, we will rely on calling it only when creating/updating.
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
 * Gets IST components from a date
 * @param {Date} date - Can be a raw UTC date or an IST-shifted date
 */
const getISTTime = (date = new Date()) => {
  // If we store IST in the DB, 'date' is already shifted.
  // To be safe, we calculate components directly from the Date object's UTC methods
  // if we know the DB is IST.
  const d = new Date(date);
  return {
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    dayOfWeek: d.getUTCDay()
  };
};

/**
 * Formats a date to 12h time string (IST)
 * Assumes 'date' is an IST-shifted Date object from the DB
 */
const formatISTTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

/**
 * Calculate total minutes from midnight in IST
 * Assumes 'date' is an IST-shifted Date object
 */
/**
 * Gets minutes since midnight for a date in IST
 * If date is provided, we assume it's already IST-shifted (as stored in DB)
 */
const getISTMinutesFromMidnight = (date) => {
  // If date is null/undefined, use current time shifted to IST
  // If date is provided, it's coming from DB/manual-entry-already-shifted, so use it directly
  const d = date ? new Date(date) : toIST(new Date());
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/**
 * Parses an IST date/time string and returns a "Shifted" Date object (IST-as-UTC)
 * This is crucial for Admin Manual Overrides to ensure the input is always treated as IST.
 */
const parseISTToShiftedDate = (dateStr) => {
  if (!dateStr) return null;
  
  // If it's already a Date object, just return it (already shifted or processed)
  if (dateStr instanceof Date) return dateStr;

  const d = new Date(dateStr);
  
  // If it's a full ISO string from frontend (e.g. "2026-04-01T09:10:00.000Z"),
  // modern pickers usually set the UTC time to the local time the user picked.
  // Since our DB uses IST-as-UTC, we should NOT shift it again.
  if (dateStr.toString().includes('T') && (dateStr.toString().includes('Z') || dateStr.toString().includes('+'))) {
    return d;
  }

  // If it's a local-style string or missing timezone (e.g. "2026-05-01 11:00"), 
  // we shift it to IST container.
  return toIST(d);
};

/**
 * Gets the current year (IST)
 */
const getCurrentYear = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET);
  return ist.getUTCFullYear();
};

module.exports = {
  toIST,
  getISTDateString,
  getISTTime,
  formatISTTime,
  getISTMinutesFromMidnight,
  parseISTToShiftedDate,
  getCurrentYear,
  IST_OFFSET
};
