/**
 * Middleware to restrict access to admin users only
 * Must be used after protect middleware
 */
const isAdmin = (req, res, next) => {
  try {
    // Check if user exists (from protect middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, please login',
        errors: [],
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errors: [],
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { isAdmin };
