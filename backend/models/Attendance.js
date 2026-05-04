const mongoose = require('mongoose');
const { getISTMinutesFromMidnight } = require('../utils/timeUtils');

const breakSchema = new mongoose.Schema(
  {
    breakStart: {
      type: Date,
      required: true,
    },
    breakEnd: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // Duration in minutes
      default: 0,
    },
  },
  { _id: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: [true, 'Date is required'],
      index: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    totalWorkingHours: {
      type: Number, // In minutes
      default: 0,
    },
    totalBreakTime: {
      type: Number, // In minutes
      default: 0,
    },
    breaks: [breakSchema],
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day', 'leave', 'holiday'],
      default: 'absent',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    // Break Management (Added)
    break: {
      startTime: { type: Date, default: null },
      endTime: { type: Date, default: null },
      durationMinutes: { type: Number, default: 0 },
      isOnBreak: { type: Boolean, default: false },
      exceededPolicy: { type: Boolean, default: false },
      alertSent: { type: Boolean, default: false }
    },
    workFraction: {
      type: Number,
      enum: [0, 0.5, 1],
      default: 0
    },
    leaveMeta: {
      cl: { type: Number, default: 0 },
      sl: { type: Number, default: 0 },
      rl: { type: Number, default: 0 },
      lwp: { type: Number, default: 0 }
    },
    isManualOverride: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one attendance record per user per date
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Index for date-based queries
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ userId: 1, date: -1 });

// Method to calculate working hours
attendanceSchema.methods.calculateWorkingHours = function () {
  if (!this.checkIn || !this.checkOut) return 0;

  const checkInTime = new Date(this.checkIn).getTime();
  const checkOutTime = new Date(this.checkOut).getTime();
  const totalMinutes = Math.floor((checkOutTime - checkInTime) / (1000 * 60));

  // Subtract break time
  const totalBreak = Number(this.totalBreakTime || 0);
  const workingMinutes = totalMinutes - totalBreak;

  return workingMinutes > 0 ? workingMinutes : 0;
};

// Method to determine status and work fraction based on check-in time, working hours and leaves
attendanceSchema.methods.determineStatus = function (settings = null) {
  // 1. Manual Override takes highest priority
  if (this.isManualOverride || this._isManualStatus) {
    return { status: this.status, workFraction: this.workFraction };
  }

  // 1. Calculate Work Component (Priority 1)
  let calculatedWorkFraction = 0;
  let isLate = false;

  if (this.checkIn) {
    const halfDayHours = settings?.halfDayThreshold || 7;
    const workingHours = this.calculateWorkingHours();
    const halfDayMinutes = halfDayHours * 60;
    const graceBuffer = 15;

    // Check if late
    const startTimeStr = settings?.officeStartTime || '09:15';
    const graceMinutes = Number(settings?.lateGracePeriod || 0);
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    const currentTotalMin = getISTMinutesFromMidnight(this.checkIn);
    const thresholdTotalMin = (startHour * 60) + startMinute + graceMinutes;
    isLate = currentTotalMin > thresholdTotalMin;

    if (this.checkOut) {
      if (workingHours >= (halfDayMinutes - graceBuffer)) {
        calculatedWorkFraction = 1.0;
      } else if (workingHours >= 30) { // At least 30 mins for half day
        calculatedWorkFraction = 0.5;
      }
    } else {
      // Currently working - assume 0.5 until checkout
      calculatedWorkFraction = 0.5;
    }
  }

  // 3. Calculate Leave Component (Priority 2 - Fills remaining time)
  const meta = this.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
  let totalLeave = (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0) + (meta.lwp || 0);

  // 4. Clamping Rule: Total (Work + Leave) ≤ 1.0
  const maxAllowedLeave = 1.0 - calculatedWorkFraction;
  const effectiveLeave = Math.min(totalLeave, maxAllowedLeave);

  // 5. Final Status Derivation
  let finalStatus = 'absent';
  const totalCredit = calculatedWorkFraction + effectiveLeave;

  if (totalCredit >= 1.0) {
    if (calculatedWorkFraction === 1.0) {
      finalStatus = isLate ? 'late' : 'present';
    } else if (effectiveLeave >= 1.0) {
      finalStatus = 'leave';
    } else {
      finalStatus = 'present'; // Combined full day (Work + Leave)
    }
  } else if (totalCredit >= 0.5) {
    finalStatus = 'half-day';
  } else if (this.checkIn) {
    // 🛡️ SECURITY FALLBACK: If there's a check-in, status must NEVER be absent
    finalStatus = isLate ? 'late' : 'present';
  } else {
    // 🛡️ SUNDAY FALLBACK: Only if no work and no leave
    const recordDate = new Date(this.date);
    if (recordDate.getUTCDay() === 0) {
      finalStatus = 'holiday';
    }
  }

  return { status: finalStatus, workFraction: calculatedWorkFraction };
};

// Method to get detailed breakdown string
attendanceSchema.methods.getBreakdownString = function () {
  const meta = this.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
  const work = this.workFraction || 0;

  const components = [];

  if (work > 0) {
    components.push(`${work} Work`);
  } else if (this.checkIn) {
    // If they checked in but haven't earned fraction yet
    components.push(`Work Started`);
  }

  if (meta.cl > 0) components.push(`${meta.cl} CL`);
  if (meta.sl > 0) components.push(`${meta.sl} SL`);
  if (meta.rl > 0) components.push(`${meta.rl} RL`);
  if (meta.lwp > 0) components.push(`${meta.lwp} LWP`);

  if (components.length === 0) {
    // Return status if it's special, otherwise 'Absent'
    if (['holiday', 'leave'].includes(this.status)) return '';
    return 'Absent';
  }
  return components.join(' + ');
};

// Pre-save middleware to auto-calculate fields
attendanceSchema.pre('save', function (next) {
  // Calculate total break time
  const oldBreaksTotal = (this.breaks || []).reduce((total, b) => total + (b.duration || 0), 0);
  const newBreakTotal = this.break?.durationMinutes || 0;
  this.totalBreakTime = oldBreaksTotal + newBreakTotal;

  // Calculate working hours if both check-in and check-out exist
  if (this.checkIn && this.checkOut) {
    this.totalWorkingHours = this.calculateWorkingHours();
  }

  // Determine status and fraction automatically UNLESS it's a manual override
  const { status: autoStatus, workFraction: autoWorkFraction } = this.determineStatus(this._settings);

  // We always update workFraction to keep calculations accurate
  this.workFraction = autoWorkFraction;

  // Only update status if it's NOT a manual override
  // We check both the persistent flag and the temporary lifecycle flag
  if (!this.isManualOverride && !this._isManualStatus) {
    this.status = autoStatus;
  }

  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
