import { Server } from 'socket.io';
import {
  AuthoritativeGameState,
  ClientToServerEvents,
  InputDirection,
  PlayerInputPayload,
  ServerToClientEvents,
} from './types';

export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 500,
  PADDLE_WIDTH: 12,
  PADDLE_HEIGHT: 84,
  PADDLE_MARGIN: 28,
  PADDLE_SPEED: 440, // px per second
  BALL_SIZE: 12,
  BALL_INITIAL_SPEED: 380, // px per second
  BALL_SPEED_INCREMENT: 24, // px per second added per paddle hit
  BALL_MAX_SPEED: 820,
  TARGET_SCORE: 10,
  TICK_RATE: 60, // 60 updates per second
};

export class GameSession {
  public roomCode: string;
  public state: AuthoritativeGameState;

  private p1Direction: InputDirection = 0;
  private p2Direction: InputDirection = 0;
  private p1LastProcessedSeq: number = 0;
  private p2LastProcessedSeq: number = 0;

  private ballSpeed: number = GAME_CONSTANTS.BALL_INITIAL_SPEED;
  private lastScorer: 'player1' | 'player2' | null = null;
  private serveDelay: number = 0;
  private countdownTimer: number = 3;

  private intervalId: NodeJS.Timeout | null = null;
  private lastTickTime: number = 0;

  constructor(roomCode: string) {
    this.roomCode = roomCode;
    const initialPaddleY =
      (GAME_CONSTANTS.CANVAS_HEIGHT - GAME_CONSTANTS.PADDLE_HEIGHT) / 2;

    this.state = {
      ball: {
        x: GAME_CONSTANTS.CANVAS_WIDTH / 2,
        y: GAME_CONSTANTS.CANVAS_HEIGHT / 2,
        velocityX: 0,
        velocityY: 0,
      },
      player1: {
        y: initialPaddleY,
        ready: false,
        lastProcessedSeq: 0,
      },
      player2: {
        y: initialPaddleY,
        ready: false,
        lastProcessedSeq: 0,
      },
      score: {
        player1: 0,
        player2: 0,
      },
      status: 'waiting',
      countdown: 3,
      winner: null,
      rematch: {
        player1: false,
        player2: false,
      },
    };
  }

  /**
   * Resets ball to center position with zero velocity.
   */
  private resetBall(): void {
    this.state.ball.x = GAME_CONSTANTS.CANVAS_WIDTH / 2;
    this.state.ball.y = GAME_CONSTANTS.CANVAS_HEIGHT / 2;
    this.state.ball.velocityX = 0;
    this.state.ball.velocityY = 0;
    this.ballSpeed = GAME_CONSTANTS.BALL_INITIAL_SPEED;
  }

  /**
   * Serves the ball towards a designated player with a randomized initial angle.
   */
  private serveBall(towards: 'player1' | 'player2'): void {
    this.resetBall();
    const angle = (Math.random() * 0.9 - 0.45); // between -26 and +26 degrees
    const dir = towards === 'player1' ? -1 : 1;

    this.state.ball.velocityX = dir * this.ballSpeed * Math.cos(angle);
    this.state.ball.velocityY = this.ballSpeed * Math.sin(angle);
  }

  /**
   * Updates player ready status and begins countdown when both are ready.
   */
  public setPlayerReady(
    role: 'player1' | 'player2',
    ready: boolean,
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): void {
    if (role === 'player1') {
      this.state.player1.ready = ready;
    } else if (role === 'player2') {
      this.state.player2.ready = ready;
    }

    // If both players are ready and game is in 'waiting' or 'game-over'
    if (
      this.state.player1.ready &&
      this.state.player2.ready &&
      (this.state.status === 'waiting' || this.state.status === 'game-over')
    ) {
      this.startCountdown(io);
    } else {
      io.to(this.roomCode).emit('game-state', this.state);
    }
  }

  /**
   * Starts a 3-second countdown before game kickoff.
   */
  public startCountdown(
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): void {
    this.state.status = 'countdown';
    this.countdownTimer = 3.6; // 3 -> 2 -> 1 -> GO!
    this.state.countdown = 3;
    this.state.winner = null;
    this.state.score = { player1: 0, player2: 0 };
    this.state.rematch = { player1: false, player2: false };
    this.p1Direction = 0;
    this.p2Direction = 0;
    this.p1LastProcessedSeq = 0;
    this.p2LastProcessedSeq = 0;
    this.state.player1.lastProcessedSeq = 0;
    this.state.player2.lastProcessedSeq = 0;
    this.resetBall();

    // Ensure the 60Hz authoritative tick loop is running
    this.start(io);

    io.to(this.roomCode).emit('game-start', { countdown: 3 });
    io.to(this.roomCode).emit('game-state', this.state);
  }

  /**
   * Handles player directional intent inputs with sequence numbering.
   */
  public setPlayerInput(
    role: 'player1' | 'player2',
    input: PlayerInputPayload
  ): void {
    const dir = input?.direction === -1 ? -1 : input?.direction === 1 ? 1 : 0;
    const seq = typeof input?.seq === 'number' ? input.seq : 0;

    if (role === 'player1') {
      if (seq >= this.p1LastProcessedSeq) {
        this.p1Direction = dir;
        this.p1LastProcessedSeq = seq;
        this.state.player1.lastProcessedSeq = seq;
      }
    } else if (role === 'player2') {
      if (seq >= this.p2LastProcessedSeq) {
        this.p2Direction = dir;
        this.p2LastProcessedSeq = seq;
        this.state.player2.lastProcessedSeq = seq;
      }
    }
  }

  /**
   * Handles rematch requests.
   */
  public requestRematch(
    role: 'player1' | 'player2',
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): void {
    if (this.state.status !== 'game-over') return;

    if (role === 'player1') {
      this.state.rematch.player1 = true;
    } else if (role === 'player2') {
      this.state.rematch.player2 = true;
    }

    // Only start countdown if BOTH players have requested a rematch
    if (this.state.rematch.player1 && this.state.rematch.player2) {
      this.startCountdown(io);
    } else {
      io.to(this.roomCode).emit('game-state', this.state);
    }
  }

  /**
   * Resets match state when a player disconnects.
   */
  public handlePlayerDisconnect(
    disconnectedPlayerId: string,
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): void {
    this.stop();
    this.state.status = 'waiting';
    this.state.countdown = 3;
    this.state.winner = null;
    this.state.player1.ready = false;
    this.state.player2.ready = false;
    this.state.player1.lastProcessedSeq = 0;
    this.state.player2.lastProcessedSeq = 0;
    this.state.rematch = { player1: false, player2: false };
    this.p1Direction = 0;
    this.p2Direction = 0;
    this.p1LastProcessedSeq = 0;
    this.p2LastProcessedSeq = 0;
    this.resetBall();

    io.to(this.roomCode).emit('player-disconnected', {
      playerId: disconnectedPlayerId,
      message: 'Opponent disconnected. Match aborted.',
    });
    io.to(this.roomCode).emit('game-state', this.state);
  }

  /**
   * Starts authoritative tick loop at 60Hz.
   */
  public start(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
    if (this.intervalId) return;

    this.lastTickTime = performance.now();
    const intervalMs = 1000 / GAME_CONSTANTS.TICK_RATE;

    this.intervalId = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;

      this.tick(dt, io);
    }, intervalMs);
  }

  /**
   * Stops authoritative tick loop.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Core physics simulation step executed at 60Hz.
   */
  private tick(
    dt: number,
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): void {
    const { CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_MARGIN, PADDLE_WIDTH } =
      GAME_CONSTANTS;

    // 1. Handle Countdown Phase
    if (this.state.status === 'countdown') {
      this.countdownTimer -= dt;
      // When timer is between 3.6 and 2.6 -> 3; 2.6 to 1.6 -> 2; 1.6 to 0.6 -> 1; 0.6 to 0 -> 0 ("GO!")
      const step = Math.floor(this.countdownTimer);
      this.state.countdown = Math.max(0, Math.min(3, step));

      if (this.countdownTimer <= 0) {
        this.state.status = 'playing';
        this.serveBall(Math.random() > 0.5 ? 'player1' : 'player2');
      }

      io.to(this.roomCode).emit('game-state', this.state);
      return;
    }

    // 2. Handle Active Playing Phase
    if (this.state.status === 'playing') {
      const maxPaddleY = CANVAS_HEIGHT - PADDLE_HEIGHT;

      // Update Player 1 paddle position based on direction intent
      if (this.p1Direction !== 0) {
        this.state.player1.y += this.p1Direction * PADDLE_SPEED * dt;
        this.state.player1.y = Math.max(0, Math.min(maxPaddleY, this.state.player1.y));
      }

      // Update Player 2 paddle position based on direction intent
      if (this.p2Direction !== 0) {
        this.state.player2.y += this.p2Direction * PADDLE_SPEED * dt;
        this.state.player2.y = Math.max(0, Math.min(maxPaddleY, this.state.player2.y));
      }

      // Check serving pause after a goal
      if (this.serveDelay > 0) {
        this.serveDelay -= dt;
        if (this.serveDelay <= 0) {
          const nextTarget = this.lastScorer === 'player1' ? 'player2' : 'player1';
          this.serveBall(nextTarget);
        }
        io.to(this.roomCode).emit('game-state', this.state);
        return;
      }

      // Update Ball position with previous coordinate tracking for anti-tunneling
      const ball = this.state.ball;
      const prevX = ball.x;

      ball.x += ball.velocityX * dt;
      ball.y += ball.velocityY * dt;

      const halfSize = GAME_CONSTANTS.BALL_SIZE / 2;

      // Wall Bounce (Top & Bottom)
      if (ball.y - halfSize <= 0) {
        ball.y = halfSize;
        ball.velocityY = Math.abs(ball.velocityY);
      } else if (ball.y + halfSize >= CANVAS_HEIGHT) {
        ball.y = CANVAS_HEIGHT - halfSize;
        ball.velocityY = -Math.abs(ball.velocityY);
      }

      // Left Paddle (Player 1) Continuous Anti-Tunneling Collision
      const p1X = PADDLE_MARGIN;
      const p1Y = this.state.player1.y;
      if (
        ball.velocityX < 0 &&
        (ball.x - halfSize <= p1X + PADDLE_WIDTH || prevX - halfSize <= p1X + PADDLE_WIDTH) &&
        (ball.x + halfSize >= p1X || prevX + halfSize >= p1X) &&
        ball.y + halfSize >= p1Y - 4 &&
        ball.y - halfSize <= p1Y + PADDLE_HEIGHT + 4
      ) {
        const paddleCenterY = p1Y + PADDLE_HEIGHT / 2;
        const normalizedHit = (ball.y - paddleCenterY) / (PADDLE_HEIGHT / 2);
        const clampedHit = Math.max(-1, Math.min(1, normalizedHit));
        const bounceAngle = clampedHit * (Math.PI / 3.4); // max ~53 degrees

        this.ballSpeed = Math.min(
          GAME_CONSTANTS.BALL_MAX_SPEED,
          this.ballSpeed + GAME_CONSTANTS.BALL_SPEED_INCREMENT
        );
        ball.velocityX = Math.abs(this.ballSpeed * Math.cos(bounceAngle));
        ball.velocityY = this.ballSpeed * Math.sin(bounceAngle);
        ball.x = p1X + PADDLE_WIDTH + halfSize;
      }

      // Right Paddle (Player 2) Continuous Anti-Tunneling Collision
      const p2X = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH;
      const p2Y = this.state.player2.y;
      if (
        ball.velocityX > 0 &&
        (ball.x + halfSize >= p2X || prevX + halfSize >= p2X) &&
        (ball.x - halfSize <= p2X + PADDLE_WIDTH || prevX - halfSize <= p2X + PADDLE_WIDTH) &&
        ball.y + halfSize >= p2Y - 4 &&
        ball.y - halfSize <= p2Y + PADDLE_HEIGHT + 4
      ) {
        const paddleCenterY = p2Y + PADDLE_HEIGHT / 2;
        const normalizedHit = (ball.y - paddleCenterY) / (PADDLE_HEIGHT / 2);
        const clampedHit = Math.max(-1, Math.min(1, normalizedHit));
        const bounceAngle = clampedHit * (Math.PI / 3.4);

        this.ballSpeed = Math.min(
          GAME_CONSTANTS.BALL_MAX_SPEED,
          this.ballSpeed + GAME_CONSTANTS.BALL_SPEED_INCREMENT
        );
        ball.velocityX = -Math.abs(this.ballSpeed * Math.cos(bounceAngle));
        ball.velocityY = this.ballSpeed * Math.sin(bounceAngle);
        ball.x = p2X - halfSize;
      }

      // Goal Left (Player 2 scores)
      if (ball.x + halfSize < 0) {
        this.state.score.player2 += 1;
        this.lastScorer = 'player2';

        io.to(this.roomCode).emit('score-update', {
          score: { ...this.state.score },
          scorer: 'player2',
        });

        if (this.state.score.player2 >= GAME_CONSTANTS.TARGET_SCORE) {
          this.state.status = 'game-over';
          this.state.winner = 'player2';
          this.resetBall();
          this.stop(); // Stop tick loop on match completion
          io.to(this.roomCode).emit('game-over', {
            winner: 'player2',
            score: { ...this.state.score },
          });
        } else {
          this.resetBall();
          this.serveDelay = 1.0;
        }
      }

      // Goal Right (Player 1 scores)
      if (ball.x - halfSize > CANVAS_WIDTH) {
        this.state.score.player1 += 1;
        this.lastScorer = 'player1';

        io.to(this.roomCode).emit('score-update', {
          score: { ...this.state.score },
          scorer: 'player1',
        });

        if (this.state.score.player1 >= GAME_CONSTANTS.TARGET_SCORE) {
          this.state.status = 'game-over';
          this.state.winner = 'player1';
          this.resetBall();
          this.stop(); // Stop tick loop on match completion
          io.to(this.roomCode).emit('game-over', {
            winner: 'player1',
            score: { ...this.state.score },
          });
        } else {
          this.resetBall();
          this.serveDelay = 1.0;
        }
      }

      // Broadcast authoritative state to both room clients
      io.to(this.roomCode).emit('game-state', this.state);
    }
  }
}
