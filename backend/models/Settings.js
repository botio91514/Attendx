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
    default: 4, // hours for half day
  },
  maxBreakLimit: {
    type: Number,
    default: 60, // minutes allowed for break
  },
  workingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6], // Mon-Sat (0=Sun, 1=Mon, ..., 6=Sat)
  },
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
