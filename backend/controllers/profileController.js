const User = require('../models/User');
const Attendance = require('../models/Attendance');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../utils/emailService');
const { profileUpdatedByAdminTemplate } = require('../utils/emailTemplates');

/**
 * Helper: Mask Account Number
 */
const maskAccount = (num) => {
  if (!num) return null;
  return '••••••••' + num.slice(-4);
};

/**
 * @desc    Get current user profile
 * @route   GET /api/profile/me
 * @access  Private
 */
const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+bankDetails.accountNumber +bankDetails.ifscCode +bankDetails.bankName +bankDetails.accountHolderName');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Mask bank details in response
    const profile = user.toObject();
    if (profile.bankDetails) {
      profile.bankDetails.accountNumber = maskAccount(profile.bankDetails.accountNumber);
    }

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update personal profile information
 * @route   PUT /api/profile/me
 * @access  Private
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const { phone, address, emergencyContact } = req.body;

    // Block non-editable fields
    const restricted = ['name', 'email', 'role', 'department', 'salary', 'joiningDate', 'isActive', 'employeeId', 'baseSalary'];
    for (const key of Object.keys(req.body)) {
      if (restricted.includes(key)) {
        return res.status(403).json({ success: false, message: `Access denied: Field '${key}' cannot be updated by employee.` });
      }
    }

    // Validate phone (10 digits)
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { phone, address, emergencyContact },
      { new: true, runValidators: true }
    ).select('+bankDetails.accountNumber +bankDetails.ifscCode +bankDetails.bankName +bankDetails.accountHolderName');

    res.status(200).json({ success: true, data: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload profile photo
 * @route   POST /api/profile/me/photo
 * @access  Private
 */
const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image' });
    }

    const user = await User.findById(req.user.id);
    
    // Delete old photo if it exists
    if (user.profilePhoto) {
      const oldPath = path.join(__dirname, '..', user.profilePhoto);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save relative path: uploads/profile-photos/filename
    const relativePath = `uploads/profile-photos/${req.file.filename}`;
    user.profilePhoto = relativePath;
    await user.save();

    res.status(200).json({ 
      success: true, 
      photoUrl: relativePath,
      message: 'Profile photo uploaded successfully' 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update bank details
 * @route   PUT /api/profile/me/bank
 * @access  Private (Employee role recommended)
 */
const updateBankDetails = async (req, res, next) => {
  try {
    const { accountNumber, ifscCode, bankName, accountHolderName } = req.body;

    // Validate IFSC
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC code format' });
    }

    // Validate Account Number (9-18 digits)
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({ success: false, message: 'Account number must be 9-18 digits' });
    }

    const user = await User.findById(req.user.id).select('+bankDetails.accountNumber +bankDetails.ifscCode +bankDetails.bankName +bankDetails.accountHolderName');
    user.bankDetails = {
      accountNumber,
      ifscCode,
      bankName,
      accountHolderName
    };
    await user.save();

    // Mask for response
    const maskedResponse = {
      bankName,
      accountHolderName,
      ifscCode,
      accountNumber: maskAccount(accountNumber)
    };

    res.status(200).json({ success: true, data: maskedResponse, message: 'Bank details updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change account password
 * @route   PUT /api/profile/me/password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // Complexity check: 8+ chars, 1 uppercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,})/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be 8+ characters, include 1 uppercase, 1 number, and 1 special char (!@#$%^&*)' 
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update and Invalidate sessions
    user.password = newPassword;
    user.refreshToken = null;
    user.refreshTokenExpiry = null;
    await user.save();

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get any employee profile (Admin only)
 * @route   GET /api/profile/employee/:id
 * @access  Private/Admin
 */
const getEmployeeProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('+bankDetails.accountNumber +bankDetails.ifscCode +bankDetails.bankName +bankDetails.accountHolderName');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Attendance Summary (Current Month)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // String comparison since Attendance.date is YYYY-MM-DD String
    const startOfMonth = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const attendances = await Attendance.find({
      userId: id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const summary = {
      present: attendances.filter(a => a.status === 'present' || a.status === 'half-day').length,
      late: attendances.filter(a => a.status === 'late').length,
      absent: attendances.filter(a => a.status === 'absent').length
    };

    const profile = user.toObject();
    if (profile.bankDetails) {
      profile.bankDetails.accountNumber = maskAccount(profile.bankDetails.accountNumber);
    }

    res.status(200).json({ success: true, data: { ...profile, attendanceSummary: summary } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update employee profile (Admin restricted)
 * @route   PUT /api/profile/employee/:id
 * @access  Private/Admin
 */
const updateEmployeeProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, department, role, baseSalary, joiningDate, isActive, phone, address } = req.body;

    const user = await User.findById(id).select('+bankDetails.accountNumber +bankDetails.ifscCode +bankDetails.bankName +bankDetails.accountHolderName');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use by another account' });
      }
    }

    const updatedFields = [];
    if (name && name !== user.name) { updatedFields.push('Name'); user.name = name; }
    if (email && email !== user.email) { updatedFields.push('Email'); user.email = email; }
    if (department && department !== user.department) { updatedFields.push('Department'); user.department = department; }
    if (role && role !== user.role) { updatedFields.push('Role'); user.role = role; }
    if (baseSalary !== undefined && baseSalary !== user.baseSalary) { updatedFields.push('Salary'); user.baseSalary = baseSalary; }
    if (joiningDate) { updatedFields.push('Joining Date'); user.joiningDate = new Date(joiningDate); }
    if (isActive !== undefined && isActive !== user.isActive) { 
      updatedFields.push('Account Status'); 
      user.isActive = isActive; 
      if (!isActive) {
        user.refreshToken = null;
        user.refreshTokenExpiry = null;
      }
    }
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    // Notify employee via email
    if (updatedFields.length > 0 && user.email) {
      const updatedAtIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      sendEmail({
        to: user.email,
        subject: '📝 Your Profile Has Been Updated',
        html: profileUpdatedByAdminTemplate({
          employeeName: user.name,
          updatedFields: updatedFields,
          updatedBy: req.user.name,
          updatedAt: updatedAtIST
        })
      }).catch(err => console.error('Admin Profile Update Email failed:', err));
    }

    res.status(200).json({ success: true, message: 'Employee profile updated successfully', data: user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  updateBankDetails,
  changePassword,
  getEmployeeProfile,
  updateEmployeeProfile
};
