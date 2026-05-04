/**
 * India Standard Time (IST) Utilities
 * India is UTC+5:30
 */

export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/**
 * Returns current date/time shifted to IST
 */
export const getISTNow = () => {
  const now = new Date();
  return now; // Frontend 'Now' is already the correct local wall-clock
};

/**
 * Converts a DB "IST-as-UTC" string into a proper Local Date object for calculations
 */
export const parseDBDate = (dateStr: string | Date | null) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  // Strip 'Z' to force browser to treat it as Local Time (Wall-clock)
  return new Date(dateStr.replace('Z', ''));
};

/**
 * Formats a date to YYYY-MM-DD in IST
 * Use this instead of .toISOString().split('T')[0]
 */
export const formatISTDate = (date: Date = new Date()) => {
  const ist = new Date(date.getTime() + (date.getTimezoneOffset() === 0 ? IST_OFFSET : 0));
  // Wait, if the date object already has local timezone, we need to be careful.
  // Actually, the most reliable way to get IST YYYY-MM-DD regardless of environment:
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date); // en-CA returns YYYY-MM-DD
};

/**
 * Formats a date to HH:mm AM/PM in IST
 * @param date - Can be a shifted Date object (from DB) or a raw Date object
 * @param isAlreadyShifted - Set to true if the date is already "IST-as-UTC" (Default: true)
 */
export const formatISTTime = (date: string | Date | null, isAlreadyShifted: boolean = true) => {
  if (!date) return '—';
  let d = typeof date === 'string' ? new Date(date) : date;
  
  if (!isAlreadyShifted) {
    // 🔥 IDEMPOTENT PROTECTION:
    // If the hour is already >= 7, it's likely already shifted for this DB.
    // We only shift if it's in the raw UTC morning range (< 7).
    const currentUTCHours = d.getUTCHours();
    if (currentUTCHours < 7) {
      d = new Date(d.getTime() + IST_OFFSET);
    }
  }

  // Explicitly extract UTC components to bypass any browser timezone shifting
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  
  return `${hours}:${strMinutes} ${ampm}`;
};

/**
 * Specifically for raw UTC dates (like from new Date() or socket timestamps that haven't been shifted)
 */
export const formatRawDateToISTTime = (date: string | Date | null) => {
  return formatISTTime(date, false);
};

/**
 * Returns today's date string in IST YYYY-MM-DD
 */
export const getISTToday = () => {
  return formatISTDate(new Date());
};
