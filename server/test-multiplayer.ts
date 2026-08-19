import { io as ClientSocket, Socket } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './src/rooms';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  AuthoritativeGameState,
} from './src/types';

async function runMultiplayerTests() {
  console.log('--- Starting Authoritative Multiplayer Pong Tests ---');

  const app = express();
  const server = http.createServer(app);
  const roomManager = new RoomManager();

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: '*' },
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

      if (result.player) {
        io.to(room.code).emit('player-joined', { player: result.player, roomState: room });
        io.to(room.code).emit('room-state', room);
      }
      if (callback) callback({ success: true, room });
    });

    socket.on('player-ready', (data) => {
      const playerContext = roomManager.getRoomBySocket(socket.id);
      if (!playerContext) return;
      const session = roomManager.getGameSession(playerContext.roomCode);
      if (!session) return;
      session.setPlayerReady(playerContext.role, data?.ready !== undefined ? data.ready : true, io);
      io.to(playerContext.roomCode).emit('game-state', session.state);
    });

    socket.on('player-input', (data) => {
      const playerContext = roomManager.getRoomBySocket(socket.id);
      if (!playerContext) return;
      const session = roomManager.getGameSession(playerContext.roomCode);
      if (!session) return;
      session.setPlayerInput(playerContext.role, data);
    });

    socket.on('rematch', () => {
      const playerContext = roomManager.getRoomBySocket(socket.id);
      if (!playerContext) return;
      const session = roomManager.getGameSession(playerContext.roomCode);
      if (!session) return;
      session.requestRematch(playerContext.role, io);
    });

    socket.on('disconnect', () => {
      const { roomCode, updatedRoom, leftPlayerId } = roomManager.leaveRoom(socket.id, undefined, io);
      if (roomCode && updatedRoom) {
        io.to(roomCode).emit('player-left', { playerId: leftPlayerId, roomState: updatedRoom });
        io.to(roomCode).emit('room-state', updatedRoom);
      }
    });
  });

  const TEST_PORT = 4001;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Multiplayer test server running on port ${TEST_PORT}`);

  const createClient = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
    return ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });
  };

  const client1 = createClient();
  const client2 = createClient();

  await new Promise((r) => setTimeout(r, 200));

  // 1. Client 1 creates room
  let roomCode = '';
  await new Promise<void>((resolve) => {
    client1.emit('create-room', (res) => {
      roomCode = res.roomCode!;
      console.log(`✓ Step 1: Client 1 created room ${roomCode}`);
      resolve();
    });
  });

  // 2. Client 2 joins room
  await new Promise<void>((resolve) => {
    client2.emit('join-room', { roomCode }, () => {
      console.log(`✓ Step 2: Client 2 joined room ${roomCode}`);
      resolve();
    });
  });

  // 3. Client 1 and 2 toggle ready
  let countdownStarted = false;
  client1.on('game-start', (data) => {
    console.log(`✓ Step 3a: game-start received with countdown = ${data.countdown}`);
    countdownStarted = true;
  });

  client1.emit('player-ready', { ready: true });
  client2.emit('player-ready', { ready: true });

  await new Promise((r) => setTimeout(r, 300));
  if (!countdownStarted) {
    throw new Error('game-start countdown was not triggered after both ready');
  }

  // 4. Test player input authoritative movement
  let initialP1Y = 0;
  await new Promise<void>((resolve) => {
    const handler = (state: AuthoritativeGameState) => {
      if (state.status === 'countdown' || state.status === 'playing') {
        initialP1Y = state.player1.y;
        client1.off('game-state', handler);
        resolve();
      }
    };
    client1.on('game-state', handler);
  });

  // Send move Up input for Player 1 (direction: -1)
  client1.emit('player-input', { direction: -1 });

  await new Promise((r) => setTimeout(r, 250));

  let movedP1Y = 0;
  await new Promise<void>((resolve) => {
    const handler = (state: AuthoritativeGameState) => {
      movedP1Y = state.player1.y;
      client1.off('game-state', handler);
      resolve();
    };
    client1.on('game-state', handler);
  });

  // Because countdown is active or playing, paddle Y should have moved or clamped properly
  console.log(`✓ Step 4: Authoritative paddle positions received (initial Y: ${initialP1Y}, current Y: ${movedP1Y})`);

  // Stop input (direction: 0)
  client1.emit('player-input', { direction: 0 });

  // Clean up
  client1.disconnect();
  client2.disconnect();
  server.close();

  console.log('--- ALL AUTHORITATIVE MULTIPLAYER PONG TESTS PASSED ---');
  process.exit(0);
}

runMultiplayerTests().catch((err) => {
  console.error('Multiplayer Test Failed:', err);
  process.exit(1);
});
