const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');

/**
 * @desc    Get all audit logs
 * @route   GET /api/audit
 * @access  Private/Admin
 */
router.get('/', protect, isAdmin, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      module, 
      userId, 
      action, 
      startDate, 
      endDate 
    } = req.query;
    
    const query = {};
    
    if (module) query.module = module;
    if (userId) query.performedBy = userId;
    if (action) query.action = action;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .populate('performedBy', 'name employeeId role')
      .populate('targetUser', 'name')
      .populate('entityId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Debug Log
    console.log('🔍 AUDIT_DEBUG: Sample logs retrieved:', await AuditLog.find().limit(2).populate('performedBy', 'name'));

    const total = await AuditLog.countDocuments(query);

    // 🔍 DEBUG STEP
    console.log('🔍 AUDIT_SYSTEM_DEBUG: Found logs:', await AuditLog.find().limit(2).populate('performedBy', 'name'));

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get audit stats
 * @route   GET /api/audit/stats
 * @access  Private/Admin
 */
router.get('/stats', protect, isAdmin, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = await AuditLog.countDocuments();
    const critical = await AuditLog.countDocuments({ 
      action: { $regex: /DELETE|UNLOCK|REJECT|OVERRIDE/, $options: 'i' } 
    });
    const auditorsToday = await AuditLog.distinct('performedBy', { 
      createdAt: { $gte: today } 
    });
    const latest = await AuditLog.findOne().sort({ createdAt: -1 });

    console.log(`📊 STATS_DEBUG: Total=${total}, Critical=${critical}, Auditors=${auditorsToday.length}`);

    res.status(200).json({
      success: true,
      data: {
        total,
        critical,
        activeAdmins: auditorsToday.length,
        lastActivity: latest?.createdAt || null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
