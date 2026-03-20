const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const {
  getAnnouncements,
  createAnnouncement,
  getAllAnnouncementsAdmin,
  deleteAnnouncement,
} = require('../controllers/announcementController');

// All routes protected
router.use(protect);

/**
 * @route   GET /api/announcements
 * @desc    Get all active announcements
 * @access  Private
 */
router.get('/', getAnnouncements);

/**
 * @route   POST /api/announcements
 * @desc    Create an announcement
 * @access  Private/Admin
 */
router.post('/', isAdmin, createAnnouncement);

/**
 * @route   GET /api/announcements/admin/all
 * @desc    Get all announcements for management
 * @access  Private/Admin
 */
router.get('/admin/all', isAdmin, getAllAnnouncementsAdmin);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete an announcement
 * @access  Private/Admin
 */
router.delete('/:id', isAdmin, deleteAnnouncement);

module.exports = router;
