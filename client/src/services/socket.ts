import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL;
const BACKEND_URL = rawBackendUrl
  ? rawBackendUrl.replace(/\/$/, '')
  : (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log(`[Socket Connected] ID: ${socket.id}`);
});

socket.on('disconnect', (reason) => {
  console.log(`[Socket Disconnected] Reason: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.warn(`[Socket Connection Warning]`, error.message);
});
