const mongoose = require('mongoose');

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
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let monthsWorked = currentMonth;
  if (joiningDate) {
    const join = new Date(joiningDate);
    if (join.getFullYear() === currentYear) {
      monthsWorked = Math.max(1, currentMonth - join.getMonth());
    }
  }

  const clAccrued = Math.min(12, monthsWorked * 1);
  const slAccrued = 6;
  const rlQuota = 2;

  return {
    year: this.year,
    casual: {
      total: 12,
      accrued: clAccrued,
      used: this.casual.used,
      available: Math.max(0, clAccrued - this.casual.used),
      monthlyLimit: 1
    },
    sick: {
      total: 6,
      accrued: slAccrued,
      used: this.sick.used,
      available: Math.max(0, slAccrued - this.sick.used),
      monthlyLimit: 6
    },
    religious: {
      total: 2,
      accrued: rlQuota,
      used: this.religious.used,
      available: Math.max(0, rlQuota - this.religious.used),
      monthlyLimit: 2 
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
