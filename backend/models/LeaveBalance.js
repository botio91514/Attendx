const mongoose = require('mongoose');
const { toIST } = require('../utils/timeUtils');

const leaveTypeSchema = new mongoose.Schema(
  {
    total: { type: Number, required: true, default: 0 },
    used: { type: Number, required: true, default: 0 },
    remaining: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    year: { type: Number, required: true, index: true },
    casual: { type: leaveTypeSchema, default: () => ({ total: 12, used: 0, remaining: 12 }) },
    sick: { type: leaveTypeSchema, default: () => ({ total: 6, used: 0, remaining: 6 }) },
    religious: { type: leaveTypeSchema, default: () => ({ total: 2, used: 0, remaining: 2 }) },
    unpaid: { type: leaveTypeSchema, default: () => ({ total: 999, used: 0, remaining: 999 }) },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });

leaveBalanceSchema.pre('save', function (next) {
  ['casual', 'sick', 'religious'].forEach((type) => {
    if (this[type]) {
      this[type].remaining = Math.max(0, this[type].total - this[type].used);
    }
  });
  next();
});

leaveBalanceSchema.methods.getAccrualSummary = function (joiningDate) {
  const { toIST } = require('../utils/timeUtils');
  const now = toIST();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  
  let monthsWorked = currentMonth;
  if (joiningDate) {
    const join = toIST(joiningDate);
    if (join.getUTCFullYear() === currentYear) {
      monthsWorked = Math.max(1, currentMonth - join.getUTCMonth());
    }
  }

  const clEarned = Math.min(12, monthsWorked * 1);
  const slTotal = this.sick.total || 6;
  const rlTotal = this.religious.total || 2;

  return {
    year: this.year,
    casual: {
      total: 12,
      accrued: clEarned,
      used: this.casual.used,
      available: Math.max(0, clEarned - this.casual.used),
      monthlyLimit: 0
    },
    sick: {
      total: slTotal,
      accrued: slTotal,
      used: this.sick.used,
      available: Math.max(0, slTotal - this.sick.used),
      monthlyLimit: 0
    },
    religious: {
      total: rlTotal,
      accrued: rlTotal,
      used: this.religious.used,
      available: Math.max(0, rlTotal - this.religious.used),
      monthlyLimit: 0
    },
    unpaid: {
      total: 'Unlimited',
      used: this.unpaid.used,
      available: 'Unlimited'
    }
  };
};

leaveBalanceSchema.methods.getSummary = function () {
  return {
    year: this.year,
    casual: this.casual,
    sick: this.sick,
    religious: this.religious,
    unpaid: { ...this.unpaid, total: 'Unlimited', remaining: 'Unlimited' }
  };
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
