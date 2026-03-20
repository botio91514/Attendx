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
      enum: ['present', 'absent', 'late', 'half-day'],
      default: 'absent',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
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
  const halfDayHours = settings?.halfDayThreshold || 4;

  const [startHour, startMinute] = startTimeStr.split(':').map(Number);
  
  // Check if late
  const checkInTime = new Date(this.checkIn);
  const threshold = new Date(this.checkIn);
  threshold.setHours(startHour, startMinute + graceMinutes, 0, 0);

  if (checkInTime > threshold) {
    return 'late';
  }

  // Check for half-day
  if (this.checkOut) {
    const workingHours = this.calculateWorkingHours();
    if (workingHours < halfDayHours * 60) {
      return 'half-day';
    }
  }

  return 'present';
};

// Pre-save middleware to auto-calculate fields
attendanceSchema.pre('save', function (next) {
  // Calculate total break time
  if (this.breaks && this.breaks.length > 0) {
    this.totalBreakTime = this.breaks.reduce((total, breakItem) => {
      return total + (breakItem.duration || 0);
    }, 0);
  }

  // Calculate working hours if both check-in and check-out exist
  if (this.checkIn && this.checkOut) {
    this.totalWorkingHours = this.calculateWorkingHours();
  }

  // Determine status - use attached settings if they exist
  this.status = this.determineStatus(this._settings);

  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
