// client/src/lib/socket.js
import { io } from 'socket.io-client';

export const socket = io('/', {
  transports: ['websocket'],   // skip long-polling for speed/stability on Render
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});
