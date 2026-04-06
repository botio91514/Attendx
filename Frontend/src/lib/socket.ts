import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) return socket;
  
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace('/api', '')
    .replace(/\/$/, '');

  socket = io(SOCKET_URL, {
    auth: { token },  // sent to server auth middleware
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    transports: ['websocket', 'polling']
  });

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

export default { connectSocket, disconnectSocket, getSocket };
