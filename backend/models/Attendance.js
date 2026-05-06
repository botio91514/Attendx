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
attendanceSchema.methods.calculateWorkingHours = function (settings = null) {
  if (!this.checkIn || !this.checkOut) return 0;

  const checkInTime = new Date(this.checkIn).getTime();
  const checkOutTime = new Date(this.checkOut).getTime();
  const totalMinutes = Math.floor((checkOutTime - checkInTime) / (1000 * 60));

  // 1. Subtract manual break time
  const totalBreak = Number(this.totalBreakTime || 0);
  let workingMinutes = totalMinutes - totalBreak;

  // 2. Auto Break Policy
  if (settings?.breakPolicy === 'auto-after-threshold') {
    const threshold = (settings.halfDayThreshold || 4) * 60; // Default 4 hours for auto-break threshold
    if (workingMinutes >= threshold) {
      workingMinutes -= (settings.autoBreakMinutes || 0);
    }
  }

  return workingMinutes > 0 ? workingMinutes : 0;
};

// Method to determine status and work fraction based on strict rules
attendanceSchema.methods.determineStatus = function (settings = null) {
  // 1. Check Working Days / Weekend Policy (Priority 1)
  const dayOfWeek = new Date(this.date).getUTCDay();
  const isWorkingDay = settings?.workingDays?.includes(dayOfWeek);

  if (!isWorkingDay) {
    if (settings?.weekendPolicy === 'holiday') {
      return { status: 'holiday', workFraction: 0 };
    }
    // If 'working' or 'optional', continue to process
  }

  // 2. Manual Override (Priority 2)
  if (this.isManualOverride || this._isManualStatus) {
    let fraction = this.workFraction;
    // 🛡️ SYNC RULE: If status is set manually but fraction is 0/missing, derive it
    if (!fraction || fraction === 0) {
      if (this.status === 'present' || this.status === 'late') fraction = 1.0;
      else if (this.status === 'half-day') fraction = 0.5;
    }
    return { status: this.status, workFraction: fraction };
  }

  // 3. Auto-Checkout Implementation
  if (!this.checkOut && settings?.autoCheckoutTime) {
    const [autoH, autoM] = settings.autoCheckoutTime.split(':').map(Number);
    const now = new Date(); // In actual use, this would be compared with check-in date
    
    // Simple check: if current time > autoCheckoutTime on check-in day
    const checkoutLimit = new Date(this.checkIn);
    checkoutLimit.setHours(autoH, autoM, 0, 0);
    
    if (Date.now() > checkoutLimit.getTime()) {
      this.checkOut = checkoutLimit;
    }
  }

  // 4. Status Determination Logic
  let rawWorkFraction = 0;
  let isLate = false;

  if (this.checkIn) {
    const workingMinutes = this.calculateWorkingHours(settings);
    const fullDayThresholdMin = (settings?.halfDayThreshold || 5) * 60;

    // Check if late (Must be before checkout check)
    const startTimeStr = settings?.officeStartTime || '09:15';
    const graceMinutes = Number(settings?.lateGraceMinutes || settings?.lateGracePeriod || 0);
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const currentTotalMin = getISTMinutesFromMidnight(this.checkIn);
    const thresholdTotalMin = (startHour * 60) + startMinute + graceMinutes;
    isLate = currentTotalMin > thresholdTotalMin;

    if (this.checkOut) {
      const minWork = settings?.minWorkMinutes || 30;
      if (workingMinutes >= fullDayThresholdMin) {
        rawWorkFraction = 1.0;
      } else if (workingMinutes >= minWork) {
        rawWorkFraction = 0.5;
      } else {
        rawWorkFraction = 0;
      }
    } else {
      // Currently working - assume 1.0 (Present) until checkout
      rawWorkFraction = 1.0;
    }
  }

  // 4. Status Priority Engine
  const meta = this.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
  const paidLeave = (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0);
  const unpaidLeave = (meta.lwp || 0);
  
  // 5. Credit Clamping (Rule D)
  const maxCredit = settings?.maxDailyCredit || 1.0;
  const effectiveCredit = Math.min(maxCredit, rawWorkFraction + paidLeave);

  let finalStatus = 'absent';
  let finalWorkFraction = rawWorkFraction;

  // 🛡️ Rule Engine: Determine status based on "Payable" and "Physical" presence
  if (rawWorkFraction >= 1.0) {
    // 🛡️ Rule: Full Physical Work
    finalStatus = isLate ? 'late' : 'present';
  } else if (effectiveCredit >= 1.0) {
    // 🛡️ Rule: Full Payable Credit (Work + Paid Leave)
    finalStatus = (paidLeave >= 1.0 && rawWorkFraction === 0) ? 'leave' : (isLate ? 'late' : 'present');
  } else if (rawWorkFraction >= 0.5) {
    // 🛡️ Rule: Partial Physical Work
    finalStatus = 'half-day';
  } else if (effectiveCredit >= 0.5) {
    // 🛡️ Rule: Partial Payable Credit
    finalStatus = (paidLeave >= 0.5 && rawWorkFraction === 0) ? 'leave' : 'half-day';
  } else {
    // 🛡️ Default: Absent
    finalStatus = 'absent';
  }

  // 🛡️ SPECIAL RULE: If LWP exists alongside any work, it cannot be 'PRESENT' 
  // (unless physical work is full 1.0)
  if (unpaidLeave > 0 && rawWorkFraction > 0 && rawWorkFraction < 1.0) {
    finalStatus = 'half-day';
  }

  return { status: finalStatus, workFraction: finalWorkFraction };
};

// Method to get detailed breakdown string
attendanceSchema.methods.getBreakdownString = function () {
  const meta = this.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
  const work = this.workFraction || 0;

  const components = [];

  if (work > 0 && work < 1.0) {
    components.push(`${work} Work`);
  }

  if (meta.cl > 0) components.push(`${meta.cl} CL`);
  if (meta.sl > 0) components.push(`${meta.sl} SL`);
  if (meta.rl > 0) components.push(`${meta.rl} RL`);
  if (meta.lwp > 0) components.push(`${meta.lwp} LWP`);

  if (components.length === 0) {
    return '';
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
    this.totalWorkingHours = this.calculateWorkingHours(this._settings);
  }

  // Determine status and fraction automatically UNLESS it's a manual override
  const { status: autoStatus, workFraction: autoWorkFraction } = this.determineStatus(this._settings);

  // We always update workFraction to keep calculations accurate
  this.workFraction = autoWorkFraction;

  // Only update status if it's NOT a manual override
  if (!this.isManualOverride && !this._isManualStatus) {
    this.status = autoStatus;
  }
  // 🛡️ SYNC RULE: Auto-balance LWP for Half-Days/Partial Days
  // If status is not absent/holiday, we expect a full 1.0 day credit.
  if (['present', 'late', 'half-day', 'leave'].includes(this.status)) {
    const currentWork = this.workFraction || 0;
    const meta = this.leaveMeta || { cl: 0, sl: 0, rl: 0, lwp: 0 };
    const currentPaidLeave = (meta.cl || 0) + (meta.sl || 0) + (meta.rl || 0);
    const currentLWP = (meta.lwp || 0);
    
    const totalCredit = currentWork + currentPaidLeave + currentLWP;
    
    // If there is a gap (e.g., 0.5 work + 0 leave), fill it with LWP automatically
    if (totalCredit < 1.0) {
      const gap = 1.0 - (currentWork + currentPaidLeave);
      if (gap > 0) {
        this.leaveMeta.lwp = parseFloat(gap.toFixed(2));
      }
    }
  }

  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
