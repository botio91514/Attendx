const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token in cookie
 * @access  Public (Read from cookie)
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    // Verify token signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      // Token tampered or expired
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // Find user and include sensitive fields for comparison
    const user = await User.findById(decoded.id).select('+refreshToken +refreshTokenExpiry');

    if (!user || !user.refreshToken || !user.refreshTokenExpiry) {
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    // Check if refreshTokenExpiry is past
    if (new Date() > user.refreshTokenExpiry) {
      user.refreshToken = null;
      user.refreshTokenExpiry = null;
      await user.save();
      
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      return res.status(401).json({ success: false, message: 'Refresh token expired' });
    }

    // Compare cookie token with stored hashed token
    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Token reuse detected' });
    }

    // Valid! Generate NEW accessToken (15m)
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({
      success: true,
      token: newAccessToken
    });

  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
