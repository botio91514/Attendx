const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

/**
 * Middleware to protect routes - verifies JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
        errors: [],
      });
    }

    try {
      // Verify token
      const decoded = verifyToken(token);

      // Get user from token (exclude password)
      const user = await User.findById(decoded.id || decoded._id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user not found',
          errors: [],
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact admin.',
          errors: [],
        });
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid token',
        errors: [],
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Optional middleware to attach user if token exists (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id || decoded._id).select('-password');
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Silently fail - optional auth
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  optionalAuth,
};
