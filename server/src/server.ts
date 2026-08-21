import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClientToServerEvents, ServerToClientEvents } from './types';
import { roomManager } from './rooms';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// Parse allowed client origins from environment
const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrl
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Flexible CORS Origin Checker supporting local dev, Vercel deployments, and production URLs
const corsOriginChecker = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server health checks)
  if (!origin) return callback(null, true);

  const cleanOrigin = origin.replace(/\/$/, '');

  if (
    allowedOrigins.includes('*') ||
    allowedOrigins.includes(cleanOrigin) ||
    cleanOrigin.endsWith('.vercel.app') ||
    cleanOrigin.includes('localhost') ||
    cleanOrigin.includes('127.0.0.1')
  ) {
    return callback(null, true);
  }

  return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
};

// Middleware
app.use(
  cors({
    origin: corsOriginChecker,
    methods: ['GET', 'POST'],
    credentials: true,
  })
);
app.use(express.json());

// REST Health Check & Room List
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Couch Society Server',
    timestamp: new Date().toISOString(),
    activeRooms: roomManager.getRoomCount(),
  });
});

app.get('/api/rooms', (_req: Request, res: Response) => {
  res.json({ rooms: roomManager.getAllRooms() });
});

// Global Express Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[HTTP Error]', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO Production Server Setup
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOriginChecker,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 2000,
  pingTimeout: 3000,
});

// Socket Event Handlers
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // 1. CREATE ROOM
  socket.on('create-room', (callback) => {
    try {
      const room = roomManager.createRoom(socket.id);
      socket.join(room.code);

      console.log(`[Room Created] Code: ${room.code} by Host: ${socket.id}`);

      // Initialize game session for this room
      const gameSession = roomManager.getOrCreateGameSession(room.code, io);

      socket.emit('room-state', room);
      socket.emit('game-state', gameSession.state);

      if (typeof callback === 'function') {
        callback({ success: true, roomCode: room.code, room, gameState: gameSession.state });
      }
    } catch (err: any) {
      console.error(`[Create Room Error]`, err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err?.message || 'Failed to create room' });
      }
    }
  });

  // 2. JOIN ROOM
  socket.on('join-room', (data, callback) => {
    try {
      const { roomCode } = data || {};
      const result = roomManager.joinRoom(roomCode, socket.id);

      if (!result.success) {
        console.warn(`[Join Room Failed] Socket ${socket.id} -> ${roomCode}: ${result.message}`);

        if (result.errorType === 'ROOM_NOT_FOUND') {
          socket.emit('room-not-found', {
            roomCode: roomCode || '',
            message: result.message || 'Room not found',
          });
        } else if (result.errorType === 'ROOM_FULL') {
          socket.emit('room-full', {
            roomCode: roomCode || '',
            message: result.message || 'Room is full',
          });
        } else {
          socket.emit('error-message', result.message || 'Unable to join room');
        }

        if (typeof callback === 'function') {
          callback({ success: false, error: result.message });
        }
        return;
      }

      const room = result.room!;
      socket.join(room.code);

      console.log(`[Player Joined] Socket: ${socket.id} in Room: ${room.code} as ${result.player?.role}`);

      const gameSession = roomManager.getOrCreateGameSession(room.code, io);

      // Emit full states
      socket.emit('room-state', room);
      socket.emit('game-state', gameSession.state);

      if (result.player) {
        io.to(room.code).emit('player-joined', {
          player: result.player,
          roomState: room,
        });
        io.to(room.code).emit('room-state', room);
      }

      if (typeof callback === 'function') {
        callback({ success: true, room, gameState: gameSession.state });
      }
    } catch (err: any) {
      console.error(`[Join Room Error]`, err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err?.message || 'Failed to join room' });
      }
    }
  });

  // 3. PLAYER READY
  socket.on('player-ready', (data) => {
    try {
      const playerContext = roomManager.getRoomBySocket(socket.id);
      if (!playerContext) return;

      const room = roomManager.getRoom(playerContext.roomCode);
      const session = roomManager.getGameSession(playerContext.roomCode);
      if (!session || !room) return;

      // Both players must be present to ready up
      if (!room.player1 || !room.player2) {
        return;
      }

      const { ready } = data || {};
      session.setPlayerReady(playerContext.role, Boolean(ready), io);
      io.to(playerContext.roomCode).emit('game-state', session.state);
    } catch (err) {
      console.error(`[Player Ready Error]`, err);
    }
  });

  // 4. PLAYER INPUT (Authoritative input stream)
  socket.on('player-input', (data) => {
    try {
      const playerContext = roomManager.getRoomBySocket(socket.id);
      if (!playerContext) return;

      const session = roomManager.getGameSession(playerContext.roomCode);
      if (!session) return;

      session.setPlayerInput(playerContext.role, data);
    } catch (err) {
      console.error(`[Player Input Error]`, err);
    }
  });

  // Accurate client-server RTT measurement for diagnostics
  socket.on('ping-rtt', (timestamp, callback) => {
    if (typeof callback === 'function') {
      callback(timestamp);
    }
  });

  // 5. REMATCH
  socket.on('rematch', () => {
    try {
      const playerContext = roomManager.getRoomBySocket(socket.id);
      if (!playerContext) return;

      const room = roomManager.getRoom(playerContext.roomCode);
      const session = roomManager.getGameSession(playerContext.roomCode);
      if (!session || !room) return;

      // Both players must still be in the room to rematch
      if (!room.player1 || !room.player2) {
        return;
      }

      session.requestRematch(playerContext.role, io);
    } catch (err) {
      console.error(`[Rematch Error]`, err);
    }
  });

  // 6. LEAVE ROOM (Explicit leave)
  socket.on('leave-room', (data) => {
    try {
      const { roomCode } = data || {};
      const { roomCode: leftRoomCode, updatedRoom, leftPlayerId } = roomManager.leaveRoom(
        socket.id,
        roomCode,
        io
      );

      if (leftRoomCode) {
        socket.leave(leftRoomCode);
        console.log(`[Player Left] Socket: ${leftPlayerId} left Room: ${leftRoomCode}`);

        if (updatedRoom) {
          io.to(leftRoomCode).emit('player-left', {
            playerId: leftPlayerId,
            roomState: updatedRoom,
          });
          io.to(leftRoomCode).emit('room-state', updatedRoom);
        }
      }
    } catch (err) {
      console.error(`[Leave Room Error]`, err);
    }
  });

  // 7. DISCONNECT (Immediate cleanup on drop / close)
  socket.on('disconnect', (reason) => {
    try {
      console.log(`[Socket Disconnected] ID: ${socket.id}, reason: ${reason}`);
      const { roomCode, updatedRoom, leftPlayerId } = roomManager.leaveRoom(socket.id, undefined, io);

      if (roomCode && updatedRoom) {
        io.to(roomCode).emit('player-left', {
          playerId: leftPlayerId,
          roomState: updatedRoom,
        });
        io.to(roomCode).emit('room-state', updatedRoom);
      }
    } catch (err) {
      console.error(`[Disconnect Handler Error]`, err);
    }
  });
});

// Start HTTP & WebSocket Server
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Couch Society Server is running!`);
  console.log(` Port: ${PORT}`);
  console.log(` Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);
});

// Graceful Shutdown for Container/Production Hosting (Render, Docker, Kubernetes)
const gracefulShutdown = (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  // Stop accepting new socket connections
  io.close(() => {
    console.log('[Socket.IO] Closed active websocket connections.');
    server.close(() => {
      console.log('[HTTP Server] HTTP server closed.');
      process.exit(0);
    });
  });

  // Timeout failsafe
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server, io };
