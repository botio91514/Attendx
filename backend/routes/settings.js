const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { apiLimiter } = require('../middleware/rateLimiter');

// GET settings: accessible by any authenticated user
router.get('/', protect, getSettings);

// PUT settings: admin only
router.put('/', protect, isAdmin, apiLimiter, updateSettings);

module.exports = router;
