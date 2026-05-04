const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io; // singleton instance

// Initialize Socket.io with existing HTTP server
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',').map(u => u.trim().replace(/\/+$/, '')).filter(Boolean)
        : ['https://gatistwamhrms.netlify.app', 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Reconnection & stability settings
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true,
    cookie: false,
    transports: ['websocket'],
  });

  // ===  AUTHENTICATION MIDDLEWARE ===
  // Validate JWT before allowing socket connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
        (socket.handshake.headers.authorization && socket.handshake.headers.authorization.replace('Bearer ', ''));

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id || decoded._id)
        .select('name role email employeeId');

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user to socket
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // === CONNECTION HANDLER ===
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${user.name} (${user.role})`);

    // Join personal room (for targeted notifications)
    // Room name = user's MongoDB ID string
    socket.join(user._id.toString());

    // Admin joins additional admin room
    // (for broadcasts to all admins)
    if (user.role === 'admin') {
      socket.join('admins');
    }

    // All employees join 'employees' room
    if (user.role === 'employee') {
      socket.join('employees');
    }

    // Everyone joins 'all' room
    socket.join('all');

    // Send connection confirmation to client
    socket.emit('connected', {
      message: 'Real-time connection established',
      userId: user._id,
      rooms: [user._id.toString(), user.role]
    });

    // === DISCONNECT HANDLER ===
    socket.on('disconnect', (reason) => {
      console.log(
        `Socket disconnected: ${user.name} — ${reason}`
      );
    });

    // === ERROR HANDLER ===
    socket.on('error', (err) => {
      console.error(`Socket error for ${user.name}:`, err);
    });
  });

  return io;
};

const { getCurrentISTTime } = require('../utils/timeUtils');

// Get io instance (used by controllers to emit)
const getIO = () => {
  if (!io) {
    throw new Error(
      'Socket.io not initialized. Call initializeSocket first.'
    );
  }
  return io;
};

// ===  EMIT HELPER FUNCTIONS ===
// Send to ONE specific user
const emitToUser = (userId, event, data) => {
  try {
    console.log(`[SOCKET] Emitting to user ${userId}: ${event}`);
    getIO().to(userId.toString()).emit(event, {
      ...data,
      timestamp: getCurrentISTTime().toISOString()
    });
  } catch (err) {
    console.error('[SOCKET] emitToUser failed:', err.message);
  }
};

// Send to ALL admins
const emitToAdmins = (event, data) => {
  try {
    console.log(`[SOCKET] Emitting to admins: ${event}`, data);
    getIO().to('admins').emit(event, {
      ...data,
      timestamp: getCurrentISTTime().toISOString()
    });
  } catch (err) {
    console.error('[SOCKET] emitToAdmins failed:', err.message);
  }
};

// Send to ALL employees
const emitToEmployees = (event, data) => {
  try {
    getIO().to('employees').emit(event, {
      ...data,
      timestamp: getCurrentISTTime().toISOString()
    });
  } catch (err) {
    console.error('Socket emit to employees failed:', err);
  }
};

// Send to EVERYONE (all connected users)
const emitToAll = (event, data) => {
  try {
    getIO().to('all').emit(event, {
      ...data,
      timestamp: getCurrentISTTime().toISOString()
    });
  } catch (err) {
    console.error('Socket emit to all failed:', err);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToAdmins,
  emitToEmployees,
  emitToAll
};
