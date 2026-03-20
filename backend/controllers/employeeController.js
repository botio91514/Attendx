const { validationResult, body, query } = require('express-validator');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const { getCurrentYear } = require('../utils/leaveHelpers');

/**
 * @desc    Get all employees (Admin only)
 * @route   GET /api/employees
 * @access  Private/Admin
 */
const getAllEmployees = async (req, res, next) => {
  try {
    const {
      department,
      role,
      isActive,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query - exclude admins by default
    const query = { role: { $ne: 'admin' } };

    if (department) {
      query.department = { $regex: department, $options: 'i' };
    }

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [employees, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password'),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        employees,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'Employees retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single employee profile (Admin only)
 * @route   GET /api/employees/:id
 * @access  Private/Admin
 */
const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const employee = await User.findById(id).select('-password');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        errors: [],
      });
    }

    // Get leave balance
    const year = getCurrentYear();
    let leaveBalance = await LeaveBalance.findOne({ userId: id, year });

    if (!leaveBalance) {
      leaveBalance = await LeaveBalance.create({ userId: id, year });
    }

    res.status(200).json({
      success: true,
      data: {
        employee: {
          ...employee.toObject(),
          leaveBalance: leaveBalance.getSummary(),
        },
      },
      message: 'Employee profile retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update employee info (Admin only)
 * @route   PUT /api/employees/:id
 * @access  Private/Admin
 */
const updateEmployee = async (req, res, next) => {
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

    const { id } = req.params;
    const { name, department, designation, role, avatar, baseSalary } = req.body;

    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        errors: [],
      });
    }

    // Prevent updating own role if admin
    if (
      id === req.user._id.toString() &&
      role &&
      role !== employee.role
    ) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role',
        errors: [],
      });
    }

    // Update fields
    if (name) employee.name = name;
    if (department) employee.department = department;
    if (designation) employee.designation = designation;
    if (role) employee.role = role;
    if (avatar) employee.avatar = avatar;
    if (baseSalary != null) employee.baseSalary = baseSalary;

    await employee.save();

    res.status(200).json({
      success: true,
      data: {
        employee: employee.profile,
      },
      message: 'Employee updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete employee (Admin only)
 * @route   DELETE /api/employees/:id
 * @access  Private/Admin
 */
const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
        errors: [],
      });
    }

    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        errors: [],
      });
    }

    // Cascade delete all related records
    await Promise.all([
      Attendance.deleteMany({ userId: id }),
      Leave.deleteMany({ userId: id }),
      LeaveBalance.deleteMany({ userId: id }),
      User.findByIdAndDelete(id),
    ]);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Employee and all associated records deleted permanently',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get employee attendance history (Admin only)
 * @route   GET /api/employees/:id/attendance
 * @access  Private/Admin
 */
const getEmployeeAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month, year, page = 1, limit = 20 } = req.query;

    // Check if employee exists
    const employee = await User.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        errors: [],
      });
    }

    // Build query
    const query = { userId: id };

    if (month && year) {
      const startOfMonth = new Date(`${year}-${month}-01`);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (year) {
      query.date = { $regex: `^${year}` };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          employeeId: employee.employeeId,
        },
        attendance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'Employee attendance history retrieved',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get employee leave history (Admin only)
 * @route   GET /api/employees/:id/leaves
 * @access  Private/Admin
 */
const getEmployeeLeaves = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, year, page = 1, limit = 20 } = req.query;

    // Check if employee exists
    const employee = await User.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        errors: [],
      });
    }

    // Build query
    const query = { userId: id };

    if (status) {
      query.status = status;
    }

    if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leaves, total] = await Promise.all([
      Leave.find(query)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Leave.countDocuments(query),
    ]);

    // Get leave balance
    const leaveYear = year || getCurrentYear();
    let leaveBalance = await LeaveBalance.findOne({ userId: id, year: leaveYear });

    if (!leaveBalance) {
      leaveBalance = await LeaveBalance.create({ userId: id, year: leaveYear });
    }

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          employeeId: employee.employeeId,
        },
        leaves,
        leaveBalance: leaveBalance.getSummary(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'Employee leave history retrieved',
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const updateEmployeeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
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
  body('avatar')
    .optional()
    .trim()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
];

module.exports = {
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeAttendance,
  getEmployeeLeaves,
  updateEmployeeValidation,
};
