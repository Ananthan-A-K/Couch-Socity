import { io as ClientSocket, Socket } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './src/rooms';
import { ServerToClientEvents, ClientToServerEvents, RoomState } from './src/types';

async function runTests() {
  console.log('--- Starting Couch Socity Socket.IO Room System Tests ---');

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
      socket.emit('room-state', room);
      callback({ success: true, roomCode: room.code, room });
    });

    socket.on('join-room', (data, callback) => {
      const { roomCode } = data;
      const result = roomManager.joinRoom(roomCode, socket.id);
      if (!result.success) {
        if (result.errorType === 'ROOM_NOT_FOUND') {
          socket.emit('room-not-found', { roomCode, message: result.message || '' });
        } else if (result.errorType === 'ROOM_FULL') {
          socket.emit('room-full', { roomCode, message: result.message || '' });
        }
        if (callback) callback({ success: false, error: result.message });
        return;
      }

      const room = result.room!;
      socket.join(room.code);
      socket.emit('room-state', room);

      if (result.player) {
        io.to(room.code).emit('player-joined', { player: result.player, roomState: room });
        io.to(room.code).emit('room-state', room);
      }
      if (callback) callback({ success: true, room });
    });

    socket.on('leave-room', (data) => {
      const { roomCode } = data;
      const { roomCode: leftCode, updatedRoom, leftPlayerId } = roomManager.leaveRoom(socket.id, roomCode);
      if (leftCode) {
        socket.leave(leftCode);
        if (updatedRoom) {
          io.to(leftCode).emit('player-left', { playerId: leftPlayerId, roomState: updatedRoom });
          io.to(leftCode).emit('room-state', updatedRoom);
        }
      }
    });

    socket.on('disconnect', () => {
      const { roomCode, updatedRoom, leftPlayerId } = roomManager.leaveRoom(socket.id);
      if (roomCode && updatedRoom) {
        io.to(roomCode).emit('player-left', { playerId: leftPlayerId, roomState: updatedRoom });
        io.to(roomCode).emit('room-state', updatedRoom);
      }
    });
  });

  const TEST_PORT = 3999;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test server running on port ${TEST_PORT}`);

  const createClient = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
    return ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });
  };

  const client1 = createClient();
  const client2 = createClient();
  const client3 = createClient();

  await new Promise((r) => setTimeout(r, 200));

  // Test 1: Client 1 creates a room
  let createdRoomCode = '';
  await new Promise<void>((resolve, reject) => {
    client1.emit('create-room', (res) => {
      if (res.success && res.roomCode && res.roomCode.length === 5) {
        console.log(`✓ Test 1: Room created successfully with code ${res.roomCode}`);
        createdRoomCode = res.roomCode;
        if (res.room?.status === 'waiting' && res.room?.player1?.side === 'left') {
          console.log(`✓ Test 1b: Player 1 assigned Left side in 'waiting' status`);
          resolve();
        } else {
          reject(new Error(`Invalid room structure: ${JSON.stringify(res.room)}`));
        }
      } else {
        reject(new Error(`Failed to create room: ${JSON.stringify(res)}`));
      }
    });
  });

  // Test 2: Client 2 joins the room
  let client1NotifiedOfPlayer2 = false;
  client1.on('player-joined', (data) => {
    if (data.player.role === 'player2' && data.player.side === 'right') {
      console.log(`✓ Test 2a: Client 1 received player-joined event for Player 2`);
      client1NotifiedOfPlayer2 = true;
    }
  });

  await new Promise<void>((resolve, reject) => {
    client2.emit('join-room', { roomCode: createdRoomCode }, (res) => {
      if (res.success && res.room?.status === 'ready') {
        console.log(`✓ Test 2b: Client 2 joined room. Status is now 'ready'`);
        resolve();
      } else {
        reject(new Error(`Client 2 failed to join: ${JSON.stringify(res)}`));
      }
    });
  });

  await new Promise((r) => setTimeout(r, 100));
  if (!client1NotifiedOfPlayer2) {
    throw new Error('Client 1 was not notified of Player 2 joining');
  }

  // Test 3: Client 3 tries to join the full room
  await new Promise<void>((resolve, reject) => {
    let receivedRoomFull = false;
    client3.on('room-full', (data) => {
      console.log(`✓ Test 3a: Client 3 received room-full event: ${data.message}`);
      receivedRoomFull = true;
    });

    client3.emit('join-room', { roomCode: createdRoomCode }, (res) => {
      if (!res.success && (res.error?.includes('2 players') || res.error?.includes('full'))) {
        console.log(`✓ Test 3b: Client 3 join-room callback returned error: ${res.error}`);
        if (receivedRoomFull) resolve();
        else setTimeout(resolve, 50);
      } else {
        reject(new Error(`Room allowed 3rd player: ${JSON.stringify(res)}`));
      }
    });
  });

  // Test 4: Non-existent room code
  await new Promise<void>((resolve, reject) => {
    let receivedNotFound = false;
    client3.on('room-not-found', (data) => {
      console.log(`✓ Test 4a: Client 3 received room-not-found event for code ${data.roomCode}`);
      receivedNotFound = true;
    });

    client3.emit('join-room', { roomCode: 'ZZZZZ' }, (res) => {
      if (!res.success) {
        console.log(`✓ Test 4b: Non-existent room rejected properly`);
        if (receivedNotFound) resolve();
        else setTimeout(resolve, 50);
      } else {
        reject(new Error(`Non-existent room succeeded unexpectedly`));
      }
    });
  });

  // Test 5: Client 2 disconnects -> Client 1 notified
  await new Promise<void>((resolve) => {
    client1.on('player-left', (data) => {
      if (data.roomState.status === 'waiting' && data.roomState.player2 === null) {
        console.log(`✓ Test 5: Client 1 received player-left. Room reverted to 'waiting'`);
        resolve();
      }
    });

    client2.disconnect();
  });

  // Clean up
  client1.disconnect();
  client3.disconnect();
  server.close();
  console.log('--- ALL BACKEND SOCKET.IO ROOM TESTS PASSED ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
