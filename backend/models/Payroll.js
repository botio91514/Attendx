const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: Number, // 1-12
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  baseSalary: {
    type: Number,
    required: true
  },
  workingDays: {
    type: Number,
    required: true
  },
  presentDays: {
    type: Number,
    required: true
  },
  halfDays: {
    type: Number,
    required: true
  },
  lateDays: {
    type: Number,
    required: true,
    default: 0
  },
  absentDays: {
    type: Number,
    required: true
  },
  payableDays: {
    type: Number,
    required: true
  },
  dailyRate: {
    type: Number,
    required: true
  },
  grossSalary: {
    type: Number,
    required: true
  },
  bonus: {
    type: Number,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'finalized', 'paid'],
    default: 'draft'
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Other'],
    default: 'Bank Transfer'
  },
  paidAt: {
    type: Date
  },
  transactionId: {
    type: String
  },
  notes: {
    type: String
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Ensure unique payroll per user per month
PayrollSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', PayrollSchema);
