export interface Vector2D {
  x: number;
  y: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  score: number;
}

export interface Ball {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  speed: number;
}

export type GameStatus = 'idle' | 'serving' | 'playing' | 'paused' | 'gameover';
export type Winner = 'player1' | 'player2' | null;

export interface GameState {
  status: GameStatus;
  winner: Winner;
  player1: Paddle;
  player2: Paddle;
  ball: Ball;
  serveTimer: number; // in seconds
  lastScorer: 'player1' | 'player2' | null;
  targetScore: number;
}

export interface InputState {
  p1Up: boolean;
  p1Down: boolean;
  p2Up: boolean;
  p2Down: boolean;
  space: boolean;
  restart: boolean;
}

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleSpeed: number;
  ballSize: number;
  ballInitialSpeed: number;
  ballSpeedIncrement: number;
  ballMaxSpeed: number;
  targetScore: number;
  serveDelaySeconds: number;
  paddleMargin: number;
  paddleRadius?: number;
}
