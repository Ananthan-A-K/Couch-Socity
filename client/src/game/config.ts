import type { GameConfig } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: 800,
  canvasHeight: 500,
  paddleWidth: 12,
  paddleHeight: 84,
  paddleSpeed: 440, // pixels per second
  paddleMargin: 28, // distance from canvas wall
  ballSize: 12,
  ballInitialSpeed: 380, // pixels per second
  ballSpeedIncrement: 24, // added on each paddle hit
  ballMaxSpeed: 820,
  targetScore: 10,
  serveDelaySeconds: 1.0,
};
