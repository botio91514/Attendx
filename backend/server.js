const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { generalLimiter, apiLimiter } = require('./middleware/rateLimiter');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

/**
 * Middleware
 */
// Enable CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate Limiting
app.use(generalLimiter);

/**
 * Routes
 */
// Mount specific route files
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/payroll', require('./routes/payroll'));

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Attendance & Leave Management API is running',
    version: '1.0.0',
    env: process.env.NODE_ENV
  });
});

/**
 * Error Handling
 */
app.use(notFound);
app.use(errorHandler);

/**
 * Start Server
 */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
