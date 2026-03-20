const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a title for the holiday'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Please provide a date'],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['national', 'company', 'local', 'other'],
      default: 'company',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Statics to check if a specific date is a holiday
holidaySchema.statics.isHoliday = async function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const holiday = await this.findOne({
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });

  return !!holiday;
};

module.exports = mongoose.model('Holiday', holidaySchema);
