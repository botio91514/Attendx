const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  changePassword,
  registerValidation,
  loginValidation,
  changePasswordValidation,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/auth/register
 * @desc    Register new employee (Admin only)
 * @access  Private/Admin
 */
router.post('/register', protect, isAdmin, registerValidation, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, loginValidation, login);

/**
 * @route   GET /api/auth/me
 * @desc    Get logged-in user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.put('/change-password', protect, changePasswordValidation, changePassword);

module.exports = router;
