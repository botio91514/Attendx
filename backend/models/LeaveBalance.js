const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema(
  {
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    used: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    remaining: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      index: true,
    },
    sick: {
      type: leaveTypeSchema,
      default: () => ({ total: 10, used: 0, remaining: 10 }),
    },
    casual: {
      type: leaveTypeSchema,
      default: () => ({ total: 12, used: 0, remaining: 12 }),
    },
    earned: {
      type: leaveTypeSchema,
      default: () => ({ total: 15, used: 0, remaining: 15 }),
    },
    unpaid: {
      type: leaveTypeSchema,
      default: () => ({ total: Infinity, used: 0, remaining: Infinity }),
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one balance record per user per year
leaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });

// Pre-save middleware to calculate remaining
leaveBalanceSchema.pre('save', function (next) {
  // Calculate remaining for each leave type
  ['sick', 'casual', 'earned'].forEach((type) => {
    if (this[type]) {
      this[type].remaining = this[type].total - this[type].used;
      if (this[type].remaining < 0) {
        this[type].remaining = 0;
      }
    }
  });

  // Unpaid leave doesn't have a limit
  if (this.unpaid) {
    this.unpaid.remaining = Infinity;
  }

  next();
});

// Method to use leave
leaveBalanceSchema.methods.useLeave = function (leaveType, days) {
  if (!this[leaveType]) {
    throw new Error(`Invalid leave type: ${leaveType}`);
  }

  if (leaveType !== 'unpaid') {
    if (this[leaveType].remaining < days) {
      throw new Error(
        `Insufficient ${leaveType} leave balance. Available: ${this[leaveType].remaining}, Requested: ${days}`
      );
    }
    this[leaveType].used += days;
    this[leaveType].remaining = this[leaveType].total - this[leaveType].used;
  } else {
    this.unpaid.used += days;
  }

  return this;
};

// Method to restore leave (on cancellation)
leaveBalanceSchema.methods.restoreLeave = function (leaveType, days) {
  if (!this[leaveType]) {
    throw new Error(`Invalid leave type: ${leaveType}`);
  }

  if (leaveType !== 'unpaid') {
    this[leaveType].used = Math.max(0, this[leaveType].used - days);
    this[leaveType].remaining = this[leaveType].total - this[leaveType].used;
  } else {
    this.unpaid.used = Math.max(0, this.unpaid.used - days);
  }

  return this;
};

// Method to get balance summary
leaveBalanceSchema.methods.getSummary = function () {
  return {
    year: this.year,
    sick: {
      total: this.sick.total,
      used: this.sick.used,
      remaining: this.sick.remaining,
    },
    casual: {
      total: this.casual.total,
      used: this.casual.used,
      remaining: this.casual.remaining,
    },
    earned: {
      total: this.earned.total,
      used: this.earned.used,
      remaining: this.earned.remaining,
    },
    unpaid: {
      total: 'Unlimited',
      used: this.unpaid.used,
      remaining: 'Unlimited',
    },
  };
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
