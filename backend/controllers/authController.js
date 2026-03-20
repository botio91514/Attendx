const { validationResult, body } = require('express-validator');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');
const { generateToken } = require('../config/jwt');
const { getCurrentYear } = require('../utils/leaveHelpers');

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

    // Create leave balance for the new employee
    await LeaveBalance.create({
      userId: user._id,
      year: getCurrentYear(),
    });

    // Generate token
    const token = generateToken({ id: user._id });

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

    const { email, password } = req.body;

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

    // Generate token
    const token = generateToken({ id: user._id });

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
        token,
      },
      message: 'Login successful',
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

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  registerValidation,
  loginValidation,
  changePasswordValidation,
};
