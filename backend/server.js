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
const { createServer } = require('http');
const { initializeSocket } = require('./socket/socketManager.js');

// Connect to Database
// (moved to inside listen to prevent startup hang)

const app = express();

// 1. MANUAL CORS HEADERS (ULTRA AGGRESSIVE)
app.use((req, res, next) => {
  const origin = req.headers.origin || 'https://gatistwamhrms.netlify.app';
  
  // Always set these headers for every request
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  // Immediately respond to preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});


// 2. Proxies & Parsers
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 3. Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 4. Rate Limiting (DISABLED FOR TROUBLESHOOTING)
// app.use(generalLimiter);

// Ensure upload directories
const uploadDir = path.join(__dirname, process.env.UPLOAD_PATH || 'uploads/profile-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Routes
 */
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
app.use('/api/tasks', taskRoutes);
app.use('/api/export', require('./routes/exportRoutes.js'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'AttendX API Live' });
});

// 404 & Error Handler
app.use(notFound);
app.use(errorHandler);

/**
 * Start Server
 */
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
initializeSocket(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  connectDB();
  
  // Start Jobs
  try {
    const { startCheckoutReminderJob, startAbsentAlertJob, startAutoCheckoutJob } = require('./jobs/autoCheckoutReminder');
    const { startBreakMonitorJob } = require('./jobs/breakMonitor.js');
    startCheckoutReminderJob();
    startAbsentAlertJob();
    startAutoCheckoutJob();
    startBreakMonitorJob();
  } catch (err) {
    console.error('Job start failure:', err.message);
  }

  // Render Anti-Sleep
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.CLIENT_URL?.replace('netlify.app', 'onrender.com');
    if (RENDER_URL) {
      setInterval(() => {
        require('https').get(`${RENDER_URL}/api/health`, (res) => {
          console.log(`Keep-alive ping: ${res.statusCode}`);
        });
      }, 14 * 60 * 1000);
    }
  }
});

// Rejection Handler
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
