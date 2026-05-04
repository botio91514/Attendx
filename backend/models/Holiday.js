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
  // We assume 'date' is a YYYY-MM-DD string or an IST-shifted Date object
  // To check if a day is a holiday, we just need to compare the YYYY-MM-DD string
  const { getISTDateString } = require('../utils/timeUtils');
  const dateStr = getISTDateString(date);

  const holiday = await this.findOne({
    date: new Date(dateStr) // MongoDB stores YYYY-MM-DD as T00:00:00Z
  });

  return !!holiday;
};

module.exports = mongoose.model('Holiday', holidaySchema);
