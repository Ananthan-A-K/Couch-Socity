import { io as ClientSocket } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './src/rooms';
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from './src/types';

const PORT = 4003;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runHostSwitchTest() {
  console.log('--- Starting Host Switch Countdown Test ---');

  const app = express();
  const server = http.createServer(app);
  const roomManager = new RoomManager();

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: '*' },
    pingInterval: 1000,
    pingTimeout: 2000,
  });

  io.on('connection', (socket) => {
    socket.on('create-room', (callback) => {
      const room = roomManager.createRoom(socket.id);
      socket.join(room.code);
      const session = roomManager.getOrCreateGameSession(room.code, io);
      socket.emit('room-state', room);
      socket.emit('game-state', session.state);
      callback({ success: true, roomCode: room.code, room });
    });

    socket.on('join-room', (data, callback) => {
      const { roomCode } = data;
      const result = roomManager.joinRoom(roomCode, socket.id);
      if (!result.success) {
        if (callback) callback({ success: false, error: result.message });
        return;
      }
      const room = result.room!;
      socket.join(room.code);
      const session = roomManager.getOrCreateGameSession(room.code, io);
      socket.emit('room-state', room);
      socket.emit('game-state', session.state);

      io.to(room.code).emit('player-joined', { player: result.player!, roomState: room });
      io.to(room.code).emit('room-state', room);
      if (callback) callback({ success: true, room });
    });

    socket.on('player-ready', (data) => {
      const ctx = roomManager.getRoomBySocket(socket.id);
      if (!ctx) return;
      const session = roomManager.getGameSession(ctx.roomCode);
      if (!session) return;
      session.setPlayerReady(ctx.role, Boolean(data.ready), io);
    });

    socket.on('disconnect', () => {
      const { roomCode, updatedRoom, leftPlayerId } = roomManager.leaveRoom(socket.id, undefined, io);
      if (roomCode && updatedRoom) {
        io.to(roomCode).emit('player-left', { playerId: leftPlayerId, roomState: updatedRoom });
        io.to(roomCode).emit('room-state', updatedRoom);
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  const socketUrl = `http://localhost:${PORT}`;

  const c1 = ClientSocket(socketUrl, { reconnection: false });
  const c2 = ClientSocket(socketUrl, { reconnection: false });
  const c3 = ClientSocket(socketUrl, { reconnection: false });

  try {
    await new Promise<void>((resolve) => c1.on('connect', () => resolve()));
    await new Promise<void>((resolve) => c2.on('connect', () => resolve()));
    await new Promise<void>((resolve) => c3.on('connect', () => resolve()));

    // 1. Client 1 creates room
    let roomCode = '';
    await new Promise<void>((resolve) => {
      c1.emit('create-room', (res: any) => {
        roomCode = res.roomCode;
        resolve();
      });
    });
    console.log(`✓ Step 1: Client 1 created room ${roomCode}`);

    // 2. Client 2 joins room
    await new Promise<void>((resolve) => {
      c2.emit('join-room', { roomCode }, () => resolve());
    });
    console.log(`✓ Step 2: Client 2 joined room ${roomCode}`);

    // 3. Client 1 (Host) disconnects
    c1.disconnect();
    await sleep(200);
    console.log(`✓ Step 3: Client 1 (Host) disconnected. Client 2 promoted to Host.`);

    // 4. Client 3 (New Guest) joins room
    await new Promise<void>((resolve) => {
      c3.emit('join-room', { roomCode }, () => resolve());
    });
    console.log(`✓ Step 4: Client 3 joined room ${roomCode}`);

    // 5. Both Client 2 (new Host) and Client 3 (new Guest) ready up
    let gameStatusReachedPlaying = false;
    let finalCountdown = -1;

    c2.on('game-state', (state: any) => {
      finalCountdown = state.countdown;
      if (state.status === 'playing') {
        gameStatusReachedPlaying = true;
      }
    });

    c2.emit('player-ready', { ready: true });
    c3.emit('player-ready', { ready: true });

    // Wait 4.5 seconds for countdown (3 -> 2 -> 1 -> GO -> playing)
    console.log('Waiting for countdown to complete...');
    await sleep(4500);

    if (gameStatusReachedPlaying) {
      console.log(`✓ Step 5: Countdown completed successfully! Game status is 'playing' (last countdown: ${finalCountdown})`);
      console.log('--- ALL HOST SWITCH COUNTDOWN TESTS PASSED ---');
    } else {
      throw new Error(`Test failed: Game did not reach 'playing' state. Last countdown was ${finalCountdown}`);
    }
  } finally {
    c1.close();
    c2.close();
    c3.close();
    server.close();
    process.exit(0);
  }
}

runHostSwitchTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
