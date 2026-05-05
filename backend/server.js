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
const { toIST } = require('./utils/timeUtils');

// Connect to Database
connectDB();

const app = express();

// --- 1. SMART LOGGING (Ultra-Minimal) ---
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isError = res.statusCode >= 400;

    // 🔥 LOG CRITERIA:
    // Only log if it's a Mutation (Action) OR an Error
    // This keeps logs minimal and focused on important events.
    if (isMutation || isError) {
      console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});


// --- 2. CORS CONFIGURATION ---
// Normalizing allowed origins (trimming and removing trailing slashes)
const normalizeOrigin = (url) => {
  if (!url) return null;
  return url.trim().replace(/\/+$/, '');
};

const rawOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
  'https://gatistwamhrms.netlify.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

const allowedOrigins = [...new Set(rawOrigins.map(normalizeOrigin).filter(Boolean))];

console.log('✅ [CORS] Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow mobile apps, Postman, etc. (no origin)
    if (!origin) return callback(null, true);
    
    // 2. Normalize incoming origin for comparison
    const normalizedOrigin = normalizeOrigin(origin);
    
    // 3. Check if allowed
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked Origin: ${origin} (Not in allowed list)`);
      // Use null instead of Error to avoid triggering error handler without headers
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Set-Cookie'], 
  preflightContinue: false,
  optionsSuccessStatus: 200 // Use 200 for better compatibility with some browsers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicitly handle OPTIONS for all routes
app.options('*', cors(corsOptions));

// 3. Trust proxy for Render/Cloud hosting
app.set('trust proxy', 1);



// 3. Other Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(generalLimiter);

// 4. Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directories exist on startup
const uploadDir = path.join(__dirname, process.env.UPLOAD_PATH || 'uploads/profile-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Profile photo upload directory created');
}


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
app.use('/api/audit', require('./routes/auditLog'));
app.use('/api/admin', require('./routes/adminRoutes'));

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
    timestamp: toIST(new Date()).toISOString(),
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
require('./cron/leaveJobs');
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
    // Correctly target the backend URL on Render
    const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://attendx-backend-kz6g.onrender.com';
    
    if (RENDER_EXTERNAL_URL) {
      setInterval(() => {
        try {
          const https = require('https');
          https.get(`${RENDER_EXTERNAL_URL}/api/health`, (res) => {
            // Silently ping health endpoint
          });
        } catch (err) {
          console.error('[Keep-Alive] Failed:', err.message);
        }
      }, 13 * 60 * 1000); // 13 minutes (Render sleeps after 15)
    }
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
