const { validationResult, body } = require('express-validator');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');
const { generateToken } = require('../config/jwt');
const { getCurrentYear } = require('../utils/leaveHelpers');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/emailService');
const { welcomeEmployeeTemplate, passwordResetTemplate } = require('../utils/emailTemplates');

/**
 * @desc    Register new employee (Admin only)
 * @route   POST /api/auth/register
 * @access  Private/Admin
 */
const register = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((err) => err.msg),
      });
    }

    const { name, email, password, department, designation, role, baseSalary, employeeId } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        errors: [],
      });
    }

    // Capture plain password for welcome email BEFORE it is hashed by middleware
    const tempPassword = password;

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      department,
      designation,
      role: role || 'employee',
      ...(baseSalary != null && { baseSalary }),
      ...(employeeId && { employeeId }),
    });

    // --- EMAIL NOTIFICATION (ADDED) ---
    const loginUrl = (process.env.CLIENT_URL || 'http://localhost:5173') + '/login';
    sendEmail({
      to: email,
      subject: '👋 Welcome to AttendX - Your HR Dashboard is Ready!',
      html: welcomeEmployeeTemplate({
        employeeName: user.name,
        email: user.email,
        password: password,
      })
    }).catch(err => console.error('Welcome Email failed:', err));
    // --- END EMAIL NOTIFICATION ---

    // Create leave balance for the new employee
    await LeaveBalance.create({
      userId: user._id,
      year: getCurrentYear(),
    });

    // Generate token (consistent with login payload)
    const token = generateToken({ id: user._id, role: user.role });

    res.status(201).json({
      success: true,
      data: {
        user: user.profile,
        token,
      },
      message: 'Employee registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found with this email' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash and store
    const salt = await bcrypt.genSalt(10);
    user.resetToken = await bcrypt.hash(resetToken, salt);
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    // Send Email
    const resetUrl = (process.env.CLIENT_URL || 'http://localhost:5173') + '/reset-password?token=' + resetToken;
    
    sendEmail({
      to: user.email,
      subject: '🔑 AttendX Password Reset Request',
      html: passwordResetTemplate({
        employeeName: user.name,
        resetUrl: resetUrl,
      })
    }).catch(err => console.error('Reset Email failed:', err));

    res.status(200).json({ success: true, message: 'Password reset link sent to your email' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Apply new password using token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    // Find all users with active tokens (minimal set)
    const users = await User.find({ resetTokenExpiry: { $gt: Date.now() } }).select('+resetToken');
    
    let targetUser = null;
    for (const u of users) {
      const isMatch = await bcrypt.compare(token, u.resetToken);
      if (isMatch) {
        targetUser = u;
        break;
      }
    }

    if (!targetUser) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Update password
    targetUser.password = newPassword;
    targetUser.resetToken = undefined;
    targetUser.resetTokenExpiry = undefined;
    await targetUser.save();

    res.status(200).json({ success: true, message: 'Password updated successfully. You can now login.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((err) => err.msg),
      });
    }

    const { email, password, rememberMe } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errors: [],
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact admin.',
        errors: [],
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errors: [],
      });
    }

    // --- REFRESH TOKEN SYSTEM (ADDED) ---
    // Generate Access Token (15m)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Refresh Token logic
    const refreshExpiry = rememberMe ? '30d' : '1d';
    const refreshExpiryMs = rememberMe 
      ? 30 * 24 * 60 * 60 * 1000 
      : 24 * 60 * 60 * 1000;

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: refreshExpiry }
    );

    // Save refreshToken (hashed) to DB
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshTokenExpiry = new Date(Date.now() + refreshExpiryMs);
    await user.save();

    // Send refreshToken as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: refreshExpiryMs
    });
    // --- END REFRESH TOKEN SYSTEM ---

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          designation: user.designation,
          employeeId: user.employeeId,
          avatar: user.avatar,
          isActive: user.isActive,
        },
        token: accessToken, // Using new 15m token
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user and clear tokens
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    // Clear refreshToken cookie (ADDED)
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    // Nullify refreshToken in DB (ADDED)
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        refreshToken: null,
        refreshTokenExpiry: null
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errors: [],
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.profile,
      },
      message: 'User profile retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((err) => err.msg),
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Find user with password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errors: [],
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        errors: [],
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters'),
  body('designation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Designation cannot exceed 100 characters'),
  body('role')
    .optional()
    .isIn(['employee', 'admin'])
    .withMessage('Role must be either employee or admin'),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be 6+ characters'),
];

module.exports = {
  register,
  login,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
};
