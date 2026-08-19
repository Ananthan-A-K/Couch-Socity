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

/**
 * Tests if line segment (x0, y0) -> (x1, y1) intersects Axis-Aligned Bounding Box [minX, maxX] x [minY, maxY].
 * Returns hit result with intersection fraction t in [0, 1].
 */
function intersectSegmentAABB(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): { hit: boolean; t: number } {
  // If starting or ending point is inside the box, it is an immediate hit
  if (
    (x0 >= minX && x0 <= maxX && y0 >= minY && y0 <= maxY) ||
    (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY)
  ) {
    return { hit: true, t: 0 };
  }

  const dx = x1 - x0;
  const dy = y1 - y0;

  let tmin = 0;
  let tmax = 1;

  // X slab
  if (Math.abs(dx) > 1e-7) {
    let t1 = (minX - x0) / dx;
    let t2 = (maxX - x0) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return { hit: false, t: 0 };
  } else {
    if (x0 < minX || x0 > maxX) return { hit: false, t: 0 };
  }

  // Y slab
  if (Math.abs(dy) > 1e-7) {
    let t1 = (minY - y0) / dy;
    let t2 = (maxY - y0) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return { hit: false, t: 0 };
  } else {
    if (y0 < minY || y0 > maxY) return { hit: false, t: 0 };
  }

  return { hit: tmin <= tmax && tmax >= 0 && tmin <= 1, t: Math.max(0, tmin) };
}

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
  private lastTime: number = 0;
  private accumulator: number = 0;
  private currentTick: number = 0;

  constructor(roomCode: string) {
    this.roomCode = roomCode;
    const initialPaddleY =
      (GAME_CONSTANTS.CANVAS_HEIGHT - GAME_CONSTANTS.PADDLE_HEIGHT) / 2;

    this.state = {
      tick: 0,
      timestamp: Date.now(),
      ball: {
        x: GAME_CONSTANTS.CANVAS_WIDTH / 2,
        y: GAME_CONSTANTS.CANVAS_HEIGHT / 2,
        velocityX: 0,
        velocityY: 0,
      },
      player1: {
        y: initialPaddleY,
        direction: 0,
        ready: false,
        lastProcessedSeq: 0,
      },
      player2: {
        y: initialPaddleY,
        direction: 0,
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
    const angle = Math.random() * 0.9 - 0.45; // between -26 and +26 degrees
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

    if (
      this.state.player1.ready &&
      this.state.player2.ready &&
      (this.state.status === 'waiting' || this.state.status === 'game-over')
    ) {
      this.startCountdown(io);
    } else {
      this.state.timestamp = Date.now();
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
    this.state.player1.direction = 0;
    this.state.player2.direction = 0;
    this.p1LastProcessedSeq = 0;
    this.p2LastProcessedSeq = 0;
    this.state.player1.lastProcessedSeq = 0;
    this.state.player2.lastProcessedSeq = 0;
    this.resetBall();

    this.start(io);

    this.state.timestamp = Date.now();
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
        this.state.player1.direction = dir;
        this.state.player1.lastProcessedSeq = seq;
      }
    } else if (role === 'player2') {
      if (seq >= this.p2LastProcessedSeq) {
        this.p2Direction = dir;
        this.p2LastProcessedSeq = seq;
        this.state.player2.direction = dir;
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

    if (this.state.rematch.player1 && this.state.rematch.player2) {
      this.startCountdown(io);
    } else {
      this.state.timestamp = Date.now();
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
    this.state.player1.direction = 0;
    this.state.player2.direction = 0;
    this.state.player1.lastProcessedSeq = 0;
    this.state.player2.lastProcessedSeq = 0;
    this.state.rematch = { player1: false, player2: false };
    this.p1Direction = 0;
    this.p2Direction = 0;
    this.p1LastProcessedSeq = 0;
    this.p2LastProcessedSeq = 0;
    this.resetBall();

    this.state.timestamp = Date.now();
    io.to(this.roomCode).emit('player-disconnected', {
      playerId: disconnectedPlayerId,
      message: 'Opponent disconnected. Match aborted.',
    });
    io.to(this.roomCode).emit('game-state', this.state);
  }

  /**
   * Starts authoritative fixed-timestep simulation at 60Hz.
   */
  public start(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
    if (this.intervalId) return;

    this.lastTime = performance.now();
    this.accumulator = 0;
    const FIXED_DT = 1 / GAME_CONSTANTS.TICK_RATE; // 1/60s = 0.0166667s
    const timerIntervalMs = 1000 / GAME_CONSTANTS.TICK_RATE;

    this.intervalId = setInterval(() => {
      const now = performance.now();
      let frameTime = (now - this.lastTime) / 1000;
      if (frameTime > 0.25) frameTime = 0.25; // Clamp spiral of death
      this.lastTime = now;

      this.accumulator += frameTime;

      while (this.accumulator >= FIXED_DT) {
        this.currentTick++;
        this.state.tick = this.currentTick;
        this.physicsStep(FIXED_DT, io);
        this.accumulator -= FIXED_DT;
      }

      this.state.timestamp = Date.now();
      io.to(this.roomCode).emit('game-state', this.state);
    }, timerIntervalMs);
  }

  /**
   * Stops authoritative simulation loop.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Deterministic 60Hz physics step with full 2D Swept AABB collision detection.
   */
  private physicsStep(
    dt: number,
    io: Server<ClientToServerEvents, ServerToClientEvents>
  ): void {
    const {
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      PADDLE_HEIGHT,
      PADDLE_SPEED,
      PADDLE_MARGIN,
      PADDLE_WIDTH,
      BALL_SIZE,
      BALL_MAX_SPEED,
      BALL_SPEED_INCREMENT,
    } = GAME_CONSTANTS;

    // 1. Countdown Phase
    if (this.state.status === 'countdown') {
      this.countdownTimer -= dt;
      const step = Math.floor(this.countdownTimer);
      this.state.countdown = Math.max(0, Math.min(3, step));

      if (this.countdownTimer <= 0) {
        this.state.status = 'playing';
        this.serveBall(Math.random() > 0.5 ? 'player1' : 'player2');
      }
      return;
    }

    // 2. Active Playing Phase
    if (this.state.status === 'playing') {
      const maxPaddleY = CANVAS_HEIGHT - PADDLE_HEIGHT;

      // Update Player 1 paddle position
      if (this.p1Direction !== 0) {
        this.state.player1.y += this.p1Direction * PADDLE_SPEED * dt;
        this.state.player1.y = Math.max(0, Math.min(maxPaddleY, this.state.player1.y));
      }
      this.state.player1.direction = this.p1Direction;

      // Update Player 2 paddle position
      if (this.p2Direction !== 0) {
        this.state.player2.y += this.p2Direction * PADDLE_SPEED * dt;
        this.state.player2.y = Math.max(0, Math.min(maxPaddleY, this.state.player2.y));
      }
      this.state.player2.direction = this.p2Direction;

      // Check serving pause after a goal
      if (this.serveDelay > 0) {
        this.serveDelay -= dt;
        if (this.serveDelay <= 0) {
          const nextTarget = this.lastScorer === 'player1' ? 'player2' : 'player1';
          this.serveBall(nextTarget);
        }
        return;
      }

      // =========================================================================
      // 2D Continuous / Swept Ball Collision System (Minkowski Sum AABB)
      // =========================================================================
      const ball = this.state.ball;
      const ballRadius = BALL_SIZE / 2;
      const prevX = ball.x;
      const prevY = ball.y;

      let nextX = prevX + ball.velocityX * dt;
      let nextY = prevY + ball.velocityY * dt;

      // 1. Top and Bottom Wall Collisions
      if (nextY - ballRadius <= 0) {
        nextY = ballRadius;
        ball.velocityY = Math.abs(ball.velocityY);
      } else if (nextY + ballRadius >= CANVAS_HEIGHT) {
        nextY = CANVAS_HEIGHT - ballRadius;
        ball.velocityY = -Math.abs(ball.velocityY);
      }

      // 2. Left Paddle (Player 1) Full 2D Swept AABB Intersection
      const p1MinX = PADDLE_MARGIN - ballRadius;
      const p1MaxX = PADDLE_MARGIN + PADDLE_WIDTH + ballRadius;
      const p1Y = this.state.player1.y;
      const p1MinY = p1Y - ballRadius;
      const p1MaxY = p1Y + PADDLE_HEIGHT + ballRadius;

      if (ball.velocityX < 0 || prevX <= p1MaxX) {
        const hit = intersectSegmentAABB(prevX, prevY, nextX, nextY, p1MinX, p1MaxX, p1MinY, p1MaxY);

        if (hit.hit && ball.velocityX < 0) {
          const contactY = prevY + (nextY - prevY) * hit.t;
          const paddleCenterY = p1Y + PADDLE_HEIGHT / 2;
          const normalizedHit = Math.max(-1, Math.min(1, (contactY - paddleCenterY) / (PADDLE_HEIGHT / 2)));
          const bounceAngle = normalizedHit * (Math.PI / 3.4); // max ~53 degrees

          this.ballSpeed = Math.min(BALL_MAX_SPEED, this.ballSpeed + BALL_SPEED_INCREMENT);
          ball.velocityX = Math.abs(this.ballSpeed * Math.cos(bounceAngle));
          ball.velocityY = this.ballSpeed * Math.sin(bounceAngle);

          // Place ball safely on the front side of the paddle to guarantee no tunneling
          const remainingDt = dt * (1 - hit.t);
          nextX = p1MaxX + 1 + ball.velocityX * remainingDt;
          nextY = contactY + ball.velocityY * remainingDt;
        }
      }

      // 3. Right Paddle (Player 2) Full 2D Swept AABB Intersection
      const p2MinX = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - ballRadius;
      const p2MaxX = CANVAS_WIDTH - PADDLE_MARGIN + ballRadius;
      const p2Y = this.state.player2.y;
      const p2MinY = p2Y - ballRadius;
      const p2MaxY = p2Y + PADDLE_HEIGHT + ballRadius;

      if (ball.velocityX > 0 || prevX >= p2MinX) {
        const hit = intersectSegmentAABB(prevX, prevY, nextX, nextY, p2MinX, p2MaxX, p2MinY, p2MaxY);

        if (hit.hit && ball.velocityX > 0) {
          const contactY = prevY + (nextY - prevY) * hit.t;
          const paddleCenterY = p2Y + PADDLE_HEIGHT / 2;
          const normalizedHit = Math.max(-1, Math.min(1, (contactY - paddleCenterY) / (PADDLE_HEIGHT / 2)));
          const bounceAngle = normalizedHit * (Math.PI / 3.4);

          this.ballSpeed = Math.min(BALL_MAX_SPEED, this.ballSpeed + BALL_SPEED_INCREMENT);
          ball.velocityX = -Math.abs(this.ballSpeed * Math.cos(bounceAngle));
          ball.velocityY = this.ballSpeed * Math.sin(bounceAngle);

          const remainingDt = dt * (1 - hit.t);
          nextX = p2MinX - 1 + ball.velocityX * remainingDt;
          nextY = contactY + ball.velocityY * remainingDt;
        }
      }

      ball.x = nextX;
      ball.y = nextY;

      // 4. Goal Detection (Left / Right)
      if (ball.x + ballRadius < 0) {
        // Player 2 scores
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
          this.stop();
          io.to(this.roomCode).emit('game-over', {
            winner: 'player2',
            score: { ...this.state.score },
          });
        } else {
          this.resetBall();
          this.serveDelay = 1.0;
        }
      } else if (ball.x - ballRadius > CANVAS_WIDTH) {
        // Player 1 scores
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
          this.stop();
          io.to(this.roomCode).emit('game-over', {
            winner: 'player1',
            score: { ...this.state.score },
          });
        } else {
          this.resetBall();
          this.serveDelay = 1.0;
        }
      }
    }
  }
}

