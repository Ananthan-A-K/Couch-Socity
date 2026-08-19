import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  PlayerInfo,
  RoomState,
  ServerToClientEvents,
} from './types';
import { GameSession } from './gameSession';

const ROOM_CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 5;
const EMPTY_ROOM_EXPIRY_MS = 30 * 1000; // 30 seconds grace period before closing empty room

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private gameSessions: Map<string, GameSession> = new Map();
  private roomExpiryTimers: Map<string, NodeJS.Timeout> = new Map();

  public generateUniqueRoomCode(): string {
    let attempts = 0;
    while (attempts < 1000) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARSET.length);
        code += ROOM_CODE_CHARSET.charAt(randomIndex);
      }
      if (!this.rooms.has(code)) {
        return code;
      }
      attempts++;
    }
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  private cancelExpiry(code: string): void {
    const timer = this.roomExpiryTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.roomExpiryTimers.delete(code);
    }
  }

  private scheduleExpiry(code: string): void {
    this.cancelExpiry(code);
    const timer = setTimeout(() => {
      const room = this.rooms.get(code);
      if (room && !room.player1 && !room.player2) {
        console.log(`[Room Cleaned Up] Expired empty room: ${code}`);
        this.destroyRoom(code);
      }
      this.roomExpiryTimers.delete(code);
    }, EMPTY_ROOM_EXPIRY_MS);

    this.roomExpiryTimers.set(code, timer);
  }

  public getOrCreateGameSession(
    code: string,
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): GameSession {
    let session = this.gameSessions.get(code);
    if (!session) {
      session = new GameSession(code);
      session.start(io);
      this.gameSessions.set(code, session);
    }
    return session;
  }

  public getGameSession(code: string): GameSession | undefined {
    return this.gameSessions.get(code);
  }

  public destroyRoom(code: string): void {
    const session = this.gameSessions.get(code);
    if (session) {
      session.stop();
      this.gameSessions.delete(code);
    }
    this.rooms.delete(code);
    this.cancelExpiry(code);
  }

  public createRoom(socketId: string): RoomState {
    this.leaveRoom(socketId);

    const code = this.generateUniqueRoomCode();
    const player1: PlayerInfo = {
      id: socketId,
      role: 'player1',
      side: 'left',
      connectedAt: Date.now(),
    };

    const room: RoomState = {
      code,
      player1,
      player2: null,
      status: 'waiting',
      createdAt: Date.now(),
    };

    this.cancelExpiry(code);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return room;
  }

  public joinRoom(
    rawCode: string,
    socketId: string
  ): {
    success: boolean;
    errorType?: 'INVALID_CODE' | 'ROOM_NOT_FOUND' | 'ROOM_FULL';
    message?: string;
    room?: RoomState;
    player?: PlayerInfo;
  } {
    const code = (rawCode || '').trim().toUpperCase();

    if (!code || code.length !== ROOM_CODE_LENGTH) {
      return {
        success: false,
        errorType: 'INVALID_CODE',
        message: `Room code must be exactly ${ROOM_CODE_LENGTH} characters.`,
      };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return {
        success: false,
        errorType: 'ROOM_NOT_FOUND',
        message: `Room "${code}" was not found.`,
      };
    }

    this.cancelExpiry(code);

    if (room.player1?.id === socketId) {
      return { success: true, room, player: room.player1 };
    }
    if (room.player2?.id === socketId) {
      return { success: true, room, player: room.player2 };
    }

    const previousRoomCode = this.socketToRoom.get(socketId);
    if (previousRoomCode && previousRoomCode !== code) {
      this.leaveRoom(socketId);
    }

    if (room.player1 && room.player2) {
      return {
        success: false,
        errorType: 'ROOM_FULL',
        message: `Room "${code}" already has 2 players.`,
      };
    }

    let player: PlayerInfo;
    if (!room.player1) {
      player = {
        id: socketId,
        role: 'player1',
        side: 'left',
        connectedAt: Date.now(),
      };
      room.player1 = player;
    } else {
      player = {
        id: socketId,
        role: 'player2',
        side: 'right',
        connectedAt: Date.now(),
      };
      room.player2 = player;
    }

    room.status = room.player1 && room.player2 ? 'ready' : 'waiting';
    this.socketToRoom.set(socketId, code);

    return {
      success: true,
      room,
      player,
    };
  }

  public leaveRoom(
    socketId: string,
    explicitRoomCode?: string,
    io?: Server<ClientToServerEvents, ServerToClientEvents>
  ): {
    roomCode: string | null;
    updatedRoom: RoomState | null;
    leftPlayerId: string;
  } {
    const code = explicitRoomCode?.trim().toUpperCase() || this.socketToRoom.get(socketId) || null;
    if (!code) {
      return { roomCode: null, updatedRoom: null, leftPlayerId: socketId };
    }

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(code);

    if (!room) {
      return { roomCode: code, updatedRoom: null, leftPlayerId: socketId };
    }

    const session = this.gameSessions.get(code);
    if (session && io) {
      session.handlePlayerDisconnect(socketId, io);
    }

    if (room.player1?.id === socketId) {
      if (room.player2) {
        room.player1 = {
          ...room.player2,
          role: 'player1',
          side: 'left',
        };
        room.player2 = null;
        room.status = 'waiting';
      } else {
        room.player1 = null;
        room.status = 'waiting';
        this.scheduleExpiry(code);
        return { roomCode: code, updatedRoom: null, leftPlayerId: socketId };
      }
    } else if (room.player2?.id === socketId) {
      room.player2 = null;
      room.status = 'waiting';
    }

    if (!room.player1 && !room.player2) {
      this.scheduleExpiry(code);
      return { roomCode: code, updatedRoom: null, leftPlayerId: socketId };
    }

    return {
      roomCode: code,
      updatedRoom: room,
      leftPlayerId: socketId,
    };
  }

  public getRoomBySocket(socketId: string): { roomCode: string; role: 'player1' | 'player2' } | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.player1?.id === socketId) return { roomCode: code, role: 'player1' };
    if (room.player2?.id === socketId) return { roomCode: code, role: 'player2' };
    return null;
  }

  public getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public getAllRooms(): RoomState[] {
    return Array.from(this.rooms.values());
  }
}

export const roomManager = new RoomManager();
