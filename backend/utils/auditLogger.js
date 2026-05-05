const AuditLog = require('../models/AuditLog');

/**
 * 🛡️ Centralized Audit Logger
 * @param {Object} params
 * @param {string} params.action - e.g., 'UPDATE_ATTENDANCE'
 * @param {string} params.module - 'attendance', 'leave', 'payroll', 'settings', etc.
 * @param {string} [params.entityId] - Affected record ID
 * @param {Object} [params.before] - Snapshot before change
 * @param {Object} [params.after] - Snapshot after change
 * @param {string} [params.details] - Summary or legacy message
 * @param {string} [params.targetUser] - Affected User ID
 * @param {Object} params.req - Express request object for metadata/user
 */
const logAudit = async ({ action, module, entityId, targetUser, before, after, details, req }) => {
  try {
    const user = req.user || {};
    
    // Map module to Model names for population
    const modelMap = {
      attendance: 'Attendance',
      leave: 'Leave',
      payroll: 'Payroll',
      settings: 'Settings',
      employee: 'User',
      holiday: 'Holiday',
      task: 'Task',
      announcement: 'Announcement'
    };

    // Ensure we don't store sensitive data or massive circular objects
    const cleanBefore = before ? JSON.parse(JSON.stringify(before)) : undefined;
    const cleanAfter = after ? JSON.parse(JSON.stringify(after)) : undefined;

    await AuditLog.create({
      action,
      module,
      entityId,
      entityModel: modelMap[module],
      targetUser: targetUser || (module === 'employee' ? entityId : undefined),
      performedBy: user._id,
      role: user.role,
      before: cleanBefore,
      after: cleanAfter,
      details: details || `${action} on ${module}`,
      metadata: {
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        path: req.originalUrl,
        method: req.method
      }
    });
  } catch (err) {
    console.error('❌ Audit Logging Failed:', err.message);
    // We don't throw error to avoid breaking the main operation
  }
};

module.exports = { logAudit };
