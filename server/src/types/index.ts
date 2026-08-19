export type PlayerRole = 'player1' | 'player2';
export type PlayerSide = 'left' | 'right';
export type RoomStatus = 'waiting' | 'ready' | 'playing' | 'abandoned';
export type GameSessionStatus = 'waiting' | 'countdown' | 'playing' | 'game-over';
export type InputDirection = -1 | 0 | 1;

export interface PlayerInfo {
  id: string; // Socket ID
  role: PlayerRole;
  side: PlayerSide;
  connectedAt: number;
}

export interface RoomState {
  code: string;
  player1: PlayerInfo | null;
  player2: PlayerInfo | null;
  status: RoomStatus;
  createdAt: number;
}

export interface BallState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface PlayerPaddleState {
  y: number;
  direction: InputDirection;
  ready: boolean;
  lastProcessedSeq?: number;
}

export interface ScoreState {
  player1: number;
  player2: number;
}

export interface AuthoritativeGameState {
  tick: number;
  timestamp: number;
  ball: BallState;
  player1: PlayerPaddleState;
  player2: PlayerPaddleState;
  score: ScoreState;
  status: GameSessionStatus;
  countdown: number;
  winner: 'player1' | 'player2' | null;
  rematch: {
    player1: boolean;
    player2: boolean;
  };
}

export interface PlayerInputPayload {
  seq?: number;
  direction: InputDirection;
  dt?: number;
}

export interface ServerToClientEvents {
  'room-state': (state: RoomState) => void;
  'player-joined': (data: { player: PlayerInfo; roomState: RoomState }) => void;
  'player-left': (data: { playerId: string; roomState: RoomState }) => void;
  'room-full': (data: { roomCode: string; message: string }) => void;
  'room-not-found': (data: { roomCode: string; message: string }) => void;
  'error-message': (message: string) => void;

  // Pong Game Authoritative Events
  'game-state': (state: AuthoritativeGameState) => void;
  'game-start': (data: { countdown: number }) => void;
  'score-update': (data: { score: ScoreState; scorer: 'player1' | 'player2' }) => void;
  'game-over': (data: { winner: 'player1' | 'player2'; score: ScoreState }) => void;
  'player-disconnected': (data: { playerId: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'create-room': (callback: (response: { success: boolean; roomCode?: string; room?: RoomState; gameState?: AuthoritativeGameState; error?: string }) => void) => void;
  'join-room': (data: { roomCode: string }, callback?: (response: { success: boolean; room?: RoomState; gameState?: AuthoritativeGameState; error?: string }) => void) => void;
  'leave-room': (data: { roomCode: string }) => void;

  // Pong Game Client Actions
  'player-input': (data: PlayerInputPayload) => void;
  'player-ready': (data?: { ready?: boolean }) => void;
  'rematch': () => void;
  'ping-rtt': (timestamp: number, callback: (timestamp: number) => void) => void;
}
