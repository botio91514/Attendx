const mongoose = require('mongoose');

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
  const workingMinutes = totalMinutes - this.totalBreakTime;

  return workingMinutes > 0 ? workingMinutes : 0;
};

// Method to determine status based on check-in time and working hours
attendanceSchema.methods.determineStatus = function (settings = null) {
  // If no check-in, status remains absent
  if (!this.checkIn) {
    return 'absent';
  }

  // Get dynamic settings or use defaults
  const startTimeStr = settings?.officeStartTime || '09:15';
  const graceMinutes = settings?.lateGracePeriod || 0;
  const halfDayHours = settings?.halfDayThreshold || 5;

  const [startHour, startMinute] = startTimeStr.split(':').map(Number);
  
  // Check for half-day (Highest priority after Absence)
  // 🛡️ FINANCIAL SAFETY: Add 15m grace buffer to prevent "50% pay loss" cliff
  if (this.checkOut) {
    const workingHours = this.calculateWorkingHours();
    const halfDayMinutes = halfDayHours * 60;
    const graceBuffer = 15; // 15 minutes grace

    if (workingHours < (halfDayMinutes - graceBuffer)) {
      return 'half-day';
    }
  }

  // Check if late (Using centralized IST utility)
  const { getISTMinutesFromMidnight } = require('../utils/timeUtils');
  
  const currentTotalMin = getISTMinutesFromMidnight(this.checkIn);
  const thresholdTotalMin = startHour * 60 + startMinute + graceMinutes;

  if (currentTotalMin > thresholdTotalMin) {
    return 'late';
  }

  return 'present';
};

// Pre-save middleware to auto-calculate fields
attendanceSchema.pre('save', function (next) {
  // Calculate total break time from both old and new systems (Fix for consistency)
  const oldBreaksTotal = (this.breaks || []).reduce((total, b) => total + (b.duration || 0), 0);
  const newBreakTotal = this.break?.durationMinutes || 0;
  this.totalBreakTime = oldBreaksTotal + newBreakTotal;

  // Calculate working hours if both check-in and check-out exist
  if (this.checkIn && this.checkOut) {
    this.totalWorkingHours = this.calculateWorkingHours();
  }

  // Determine status - use attached settings if they exist
  this.status = this.determineStatus(this._settings);

  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
