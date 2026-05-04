const mongoose = require('mongoose');
const { toIST } = require('../utils/timeUtils');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String, // e.g., 'PAYROLL_UNLOCK', 'SALARY_EDIT'
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
