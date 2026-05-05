const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    index: true
  },
  module: {
    type: String,
    required: true,
    enum: ['attendance', 'leave', 'payroll', 'settings', 'employee', 'auth', 'holiday', 'task', 'announcement', 'system'],
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityModel',
    index: true
  },
  entityModel: {
    type: String,
    enum: ['Attendance', 'Leave', 'Payroll', 'Settings', 'User', 'Holiday', 'Task', 'Announcement']
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String
  },
  // Full snapshot before change
  before: {
    type: mongoose.Schema.Types.Mixed
  },
  // Full snapshot after change
  after: {
    type: mongoose.Schema.Types.Mixed
  },
  // Human readable summary or legacy log
  details: {
    type: String
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    path: String,
    method: String
  },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
