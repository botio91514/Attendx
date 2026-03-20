const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    leaveType: {
      type: String,
      enum: ['sick', 'casual', 'earned', 'unpaid'],
      required: [true, 'Leave type is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    totalDays: {
      type: Number,
      required: [true, 'Total days is required'],
      min: [0.5, 'Minimum leave is 0.5 day'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    adminComment: {
      type: String,
      trim: true,
      maxlength: [500, 'Admin comment cannot exceed 500 characters'],
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
leaveSchema.index({ userId: 1, status: 1 });
leaveSchema.index({ userId: 1, startDate: -1 });
leaveSchema.index({ status: 1, startDate: -1 });
leaveSchema.index({ userId: 1, leaveType: 1 });

// Compound index for overlap checking
leaveSchema.index({ userId: 1, startDate: 1, endDate: 1 });

// Pre-save middleware to validate dates
leaveSchema.pre('save', function (next) {
  // Ensure end date is not before start date
  if (this.endDate < this.startDate) {
    return next(new Error('End date cannot be before start date'));
  }

  // Set reviewedAt when status changes from pending
  if (this.isModified('status') && this.status !== 'pending' && !this.reviewedAt) {
    this.reviewedAt = new Date();
  }

  next();
});

// Method to check if leave overlaps with another date range
leaveSchema.methods.overlapsWith = function (startDate, endDate) {
  return (
    this.startDate <= endDate && this.endDate >= startDate
  );
};

module.exports = mongoose.model('Leave', leaveSchema);
