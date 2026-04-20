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
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find()
      .populate('performedBy', 'name employeeId role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments();

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

    const [total, critical, auditorsToday, latest] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ 
        action: { $regex: /DELETE|UNLOCK|REJECT/, $options: 'i' } 
      }),
      AuditLog.distinct('performedBy', { 
        timestamp: { $gte: today } 
      }),
      AuditLog.findOne().sort({ timestamp: -1 }).select('timestamp')
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        critical,
        activeAdmins: auditorsToday.length,
        lastActivity: latest?.timestamp || null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
