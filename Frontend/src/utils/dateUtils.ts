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
  return new Date(now.getTime() + IST_OFFSET);
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
 */
export const formatISTTime = (date: string | Date | null) => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  
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
 * Returns today's date string in IST YYYY-MM-DD
 */
export const getISTToday = () => {
  return formatISTDate(new Date());
};
