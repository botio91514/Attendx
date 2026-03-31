const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  updateBankDetails,
  changePassword,
  getEmployeeProfile,
  updateEmployeeProfile
} = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/isAdmin');
const { uploadProfilePhoto: photoUploader } = require('../middleware/uploadMiddleware');

/**
 * All routes are protected by default
 */
router.use(protect);

/**
 * Employee (Self-Service) Routes
 */
router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.post('/me/photo', photoUploader.single('photo'), uploadProfilePhoto);
router.put('/me/bank', updateBankDetails);
router.put('/me/password', changePassword);

/**
 * Admin Controlled Routes
 */
router.get('/employee/:id', isAdmin, getEmployeeProfile);
router.put('/employee/:id', isAdmin, updateEmployeeProfile);

module.exports = router;
