const rateLimit = require('express-rate-limit');

/**
 * General rate limiter - 10000 requests per 1 minute per IP
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // Very high for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 1 minute',
    errors: [],
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

/**
 * Stricter rate limiter for auth routes - 500 requests per 1 minute per IP
 */
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // Increased for testing
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 1 minute',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, 
});

/**
 * API rate limiter - 10000 requests per 1 minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // Very high for development
  message: {
    success: false,
    message: 'Too many API requests from this IP, please try again after 1 minute',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
};
