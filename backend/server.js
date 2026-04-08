const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');

// Load environment variables
dotenv.config();

const app = express();

// 1. ULTIMATE CORS (MIRROR ORIGIN)
app.use((req, res, next) => {
  const origin = req.headers.origin || 'https://gatistwamhrms.netlify.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// 2. Parsers & Static
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Essential Routes Only
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/profile', require('./routes/profileRoutes'));

// Health Check
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/', (req, res) => res.status(200).send('AttendX API Safe Mode Active'));

// Error Handlers
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server Error' });
});

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

// NOTE: Socket.io and Cron Jobs are temporarily disabled for troubleshooting
// const { initializeSocket } = require('./socket/socketManager.js');
// initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 SAFE MODE: Server listening on port ${PORT}`);
  connectDB().catch(err => console.error('DB Migration error:', err));
});
