const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const taskRoutes = require("./routes/taskRoutes")
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { generalLimiter, apiLimiter } = require('./middleware/rateLimiter');

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cookieParser());

// Trust proxy for Render/Cloud hosting (required for express-rate-limit)
app.set('trust proxy', 1);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directories exist on startup
const uploadDir = path.join(__dirname, process.env.UPLOAD_PATH || 'uploads/profile-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Profile photo upload directory created');
}

// Enable CORS
const allowedOrigins = [
  'https://gatistwamhrms.netlify.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      return origin.startsWith(allowedOrigin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.error(`CORS blocked for origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle preflight requests
app.options('*', cors());


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
app.use('/api/auth', require('./routes/authRefresh'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/tasks', taskRoutes)
app.use('/api/export', require('./routes/exportRoutes.js'));

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Attendance & Leave Management API is running',
    version: '1.0.0',
    env: process.env.NODE_ENV
  });
});

// Health check endpoint (used by keep-alive)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Error Handling
 */
app.use(notFound);
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;

// --- CRON JOBS (ADDED) ---
const { startCheckoutReminderJob, startAbsentAlertJob, startAutoCheckoutJob } = require('./jobs/autoCheckoutReminder');
const { startBreakMonitorJob } = require('./jobs/breakMonitor.js');
startCheckoutReminderJob();
startAbsentAlertJob();
startAutoCheckoutJob();
startBreakMonitorJob();
// --- END CRON JOBS ---

const { createServer } = require('http');
const { initializeSocket } = require('./socket/socketManager.js');

const httpServer = createServer(app);
const io = initializeSocket(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log('Socket.io initialized');

  // 🏆 Render Anti-Sleep Integration
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL ||
      process.env.CLIENT_URL?.replace('netlify.app', 'onrender.com');
    
    if (RENDER_URL) {
      setInterval(async () => {
        try {
          const https = require('https');
          https.get(`${RENDER_URL}/api/health`, (res) => {
             console.log(`Keep-alive ping sent: ${res.statusCode}`);
          });
        } catch (err) {
          console.error('Keep-alive failed:', err.message);
        }
      }, 14 * 60 * 1000); // every 14 minutes
    }
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
