const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  officeStartTime: {
    type: String,
    default: '09:15', // HH:MM format (24h)
  },
  officeEndTime: {
    type: String,
    default: '18:15',
  },
  lateGracePeriod: {
    type: Number,
    default: 0, // minutes allowed after start time
  },
  halfDayThreshold: {
    type: Number,
    default: 7, // Minimum hours to be considered a Full Day (Present)
  },
  maxBreakLimit: {
    type: Number,
    default: 60, // minutes allowed for break
  },
  minWorkMinutes: {
    type: Number,
    default: 30, // Minimum minutes to be considered Half-Day
  },
  // Break Policy (Added)
  breakDurationMinutes: { type: Number, default: 60 },
  workingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6], // Mon-Sat (0=Sun, 1=Mon, ..., 6=Sat)
  },
  backdatedLeaveLimit: {
    type: Number,
    default: 3, 
    min: 0
  },
  autoCheckoutTime: {
    type: String,
    default: '19:00', // HH:mm format
  },
  maxDailyCredit: {
    type: Number,
    default: 1.0,
  },
  weekendPolicy: {
    type: String,
    enum: ['holiday', 'working', 'optional'],
    default: 'holiday',
  },
  autoBreakMinutes: {
    type: Number,
    default: 0,
  },
  breakPolicy: {
    type: String,
    enum: ['manual', 'auto-after-threshold'],
    default: 'manual',
  },
  // Leave Policy Settings
  clPerMonth: { type: Number, default: 1 },
  maxClPerYear: { type: Number, default: 12 },
  slPerYear: { type: Number, default: 6 },
  rlPerYear: { type: Number, default: 2 },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, { timestamps: true });

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
