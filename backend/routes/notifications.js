const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// All notification routes are protected
router.use(protect);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 */
router.get('/', getNotifications);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all as read
 */
router.put('/read-all', markAllAsRead);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 */
router.put('/:id/read', markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 */
router.delete('/:id', deleteNotification);

module.exports = router;
