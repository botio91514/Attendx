const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/emailService');
const { broadcastNoticeTemplate } = require('../utils/emailTemplates');

/**
 * @desc    Get all announcements (Filtered by active)
 * @route   GET /api/announcements
 * @access  Private
 */
const getAnnouncements = async (req, res, next) => {
  try {
    const query = { isActive: true };
    
    // Filter by targetRole if employee
    if (req.user.role === 'employee') {
      query.targetRole = { $in: ['all', 'employee'] };
    }

    const announcements = await Announcement.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .populate('createdBy', 'name avatar');

    res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create an announcement (Admin only)
 * @route   POST /api/announcements
 * @access  Private/Admin
 */
const createAnnouncement = async (req, res, next) => {
  try {
    const { title, content, priority, targetRole, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      content,
      priority: priority || 'medium',
      targetRole: targetRole || 'all',
      expiresAt: expiresAt || null,
      createdBy: req.user._id,
    });

    // 🚀 Global Event Dispatcher: Notify target audience (System Notifications)
    const targetQuery = { isActive: true };
    if (announcement.targetRole && announcement.targetRole !== 'all') {
      targetQuery.role = announcement.targetRole;
    }
    
    // Fetch all applicable users
    const targetUsers = await User.find(targetQuery);
    
    // --- EMAIL NOTIFICATION (ADDED) ---
    // Broadcast via Email in batches of 10
    const istOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' };
    const postedAtIST = new Date().toLocaleString('en-IN', istOptions);

    const emailRecipients = targetUsers.filter(u => u.role === 'employee' && u.email);
    
    const sendBatch = async (users) => {
      await Promise.allSettled(users.map(user => 
        sendEmail({
          to: user.email,
          subject: `📢 Notification: ${title}`,
          html: broadcastNoticeTemplate({
            employeeName: user.name,
            noticeTitle: title,
            noticeContent: content,
            postedBy: req.user.name,
            postedAt: postedAtIST
          })
        })
      ));
    };

    // Process in batches of 10 to prevent SMTP throttling
    (async () => {
      for (let i = 0; i < emailRecipients.length; i += 10) {
        const batch = emailRecipients.slice(i, i + 10);
        await sendBatch(batch);
      }
    })().catch(err => console.error('Broadcast Broadcast Email Job failed:', err));
    // --- END EMAIL NOTIFICATION ---

    // Queue mass-notifications (System UI Notifications)
    const notificationPromises = targetUsers.map(user => {
      // Do not ping the author who created the post
      if (user._id.toString() !== req.user._id.toString()) {
        return Notification.create({
          recipient: user._id,
          sender: req.user._id,
          type: 'announcement',
          title: `New Notice: ${title}`,
          message: content.substring(0, 60) + (content.length > 60 ? '...' : ''),
          link: user.role === 'admin' ? '/admin/announcements' : '/notices',
          targetRole: user.role
        });
      }
      return null;
    });

    // Execute bulk notification transaction
    await Promise.all(notificationPromises.filter(Boolean));

    res.status(201).json({
      success: true,
      data: announcement,
      message: 'Announcement posted & notifications triggered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all announcements for management (Admin only)
 * @route   GET /api/announcements/admin/all
 * @access  Private/Admin
 */
const getAllAnnouncementsAdmin = async (req, res, next) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name');

    res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an announcement (Admin only)
 * @route   DELETE /api/announcements/:id
 * @access  Private/Admin
 */
const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
        errors: [],
      });
    }

    await announcement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Announcement removed permanently',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  getAllAnnouncementsAdmin,
  deleteAnnouncement,
};
