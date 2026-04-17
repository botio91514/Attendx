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
