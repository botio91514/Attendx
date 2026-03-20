const rateLimit = require('express-rate-limit');

/**
 * General rate limiter - 1000 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development and testing
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    errors: [],
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

/**
 * Stricter rate limiter for auth routes - 100 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for development and testing
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, 
});

/**
 * API rate limiter - 1000 requests per 15 minutes per IP
 * For general API usage
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development and testing
  message: {
    success: false,
    message: 'Too many API requests from this IP, please try again after 15 minutes',
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
