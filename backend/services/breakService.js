/**
 * breakService.js
 * Centralized service for all break-related operations.
 * Sole source of truth for break state and duration calculations.
 */

const { toIST } = require('../utils/timeUtils');

/**
 * Validates the current state of an attendance record for break operations.
 */
const validateBreakState = (attendance) => {
  const breaks = attendance.breaks || [];
  const activeBreaks = breaks.filter(b => !b.breakEnd);

  if (activeBreaks.length > 1) {
    attendance.isCorrupted = true;
    attendance.corruptionReason = 'Multiple active breaks detected';
    attendance.corruptedAt = new Date();
    return false;
  }
  return true;
};

/**
 * Calculates the total break minutes for a record.
 * @param {Object} attendance - Mongoose Attendance document
 * @param {number} policyLimit - Max allowed single break (from settings)
 */
const calculateTotalBreakMinutes = (attendance, policyLimit = 240) => {
  const breaks = attendance.breaks || [];
  let total = 0;

  breaks.forEach(b => {
    if (b.breakStart && b.breakEnd) {
      let duration = b.duration || 0;
      
      // Safety Validation
      const start = new Date(b.breakStart);
      const end = new Date(b.breakEnd);
      
      if (end < start) {
        attendance.isCorrupted = true;
        attendance.corruptionReason = `Negative duration: End ${end} before Start ${start}`;
        duration = 0;
      } else if (duration > policyLimit) {
        // Log potential corruption but don't force-fix yet (isolate)
        console.warn(`[Audit] Excessive break detected: ${duration}m for user ${attendance.userId}`);
      }

      total += duration;
    }
  });

  return Math.round(total);
};

/**
 * Starts a new break session.
 */
const startBreak = async (attendance, startTime = new Date()) => {
  if (!validateBreakState(attendance)) {
    throw new Error('Attendance record is in a corrupted state. Please contact admin.');
  }

  const ongoingBreak = attendance.breaks.find(b => !b.breakEnd);
  if (ongoingBreak) {
    throw new Error('A break session is already active.');
  }

  // Push to authoritative array
  attendance.breaks.push({
    breakStart: startTime,
    breakEnd: null,
    duration: 0
  });

  // Sync legacy compatibility fields (READ-ONLY VIEW)
  attendance.break.isOnBreak = true;
  attendance.break.startTime = startTime;
  attendance.break.endTime = null;

  return attendance;
};

/**
 * Ends an active break session.
 */
const endBreak = async (attendance, endTime = new Date(), policyLimit = 240) => {
  const ongoingBreakIndex = attendance.breaks.findIndex(b => !b.breakEnd);
  
  if (ongoingBreakIndex === -1) {
    // If array is empty but legacy flag is on, we have divergence
    if (attendance.break.isOnBreak) {
       attendance.isCorrupted = true;
       attendance.corruptionReason = 'Legacy flag ON but breaks array empty';
    }
    throw new Error('No active break session found.');
  }

  const br = attendance.breaks[ongoingBreakIndex];
  const start = new Date(br.breakStart);
  const end = new Date(endTime);
  
  const duration = Math.max(0, Math.round((end - start) / (1000 * 60)));

  // Update authoritative record
  attendance.breaks[ongoingBreakIndex].breakEnd = end;
  attendance.breaks[ongoingBreakIndex].duration = duration;

  // Sync legacy compatibility fields
  attendance.break.isOnBreak = false;
  attendance.break.endTime = end;
  attendance.break.durationMinutes = duration; // Snapshot of LAST break

  // Recalculate whole record total
  attendance.totalBreakTime = calculateTotalBreakMinutes(attendance, policyLimit);

  return attendance;
};

/**
 * Synchronizes derived fields from the breaks array.
 * Use this in pre-save or during batch repairs.
 */
const syncDerivedFields = (attendance, policyLimit = 240) => {
  const breaks = attendance.breaks || [];
  const activeBreak = breaks.find(b => !b.breakEnd);

  // 1. Update Legacy Status Object
  attendance.break.isOnBreak = !!activeBreak;
  attendance.break.startTime = activeBreak ? activeBreak.breakStart : (breaks.length > 0 ? breaks[breaks.length-1].breakStart : null);
  attendance.break.endTime = activeBreak ? null : (breaks.length > 0 ? breaks[breaks.length-1].breakEnd : null);
  
  // 2. Update Total (Authoritative Calc)
  attendance.totalBreakTime = calculateTotalBreakMinutes(attendance, policyLimit);
  
  return attendance;
};

module.exports = {
  startBreak,
  endBreak,
  calculateTotalBreakMinutes,
  syncDerivedFields,
  validateBreakState
};
