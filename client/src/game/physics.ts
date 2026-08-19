import type { GameConfig, GameState, InputState } from './types';

/**
 * Creates a clean initial game state.
 */
export function createInitialState(config: GameConfig): GameState {
  const p1Y = (config.canvasHeight - config.paddleHeight) / 2;
  const p2Y = (config.canvasHeight - config.paddleHeight) / 2;

  return {
    status: 'idle',
    winner: null,
    targetScore: config.targetScore,
    serveTimer: 0,
    lastScorer: null,
    player1: {
      x: config.paddleMargin,
      y: p1Y,
      width: config.paddleWidth,
      height: config.paddleHeight,
      speed: config.paddleSpeed,
      score: 0,
    },
    player2: {
      x: config.canvasWidth - config.paddleMargin - config.paddleWidth,
      y: p2Y,
      width: config.paddleWidth,
      height: config.paddleHeight,
      speed: config.paddleSpeed,
      score: 0,
    },
    ball: {
      x: config.canvasWidth / 2,
      y: config.canvasHeight / 2,
      size: config.ballSize,
      vx: 0,
      vy: 0,
      speed: config.ballInitialSpeed,
    },
  };
}

/**
 * Launches the ball with a calculated trajectory towards a specific player.
 */
export function serveBall(
  state: GameState,
  config: GameConfig,
  directionTowards: 'player1' | 'player2'
): void {
  // Random serve angle between -35deg and +35deg (-0.61 to +0.61 radians)
  const angle = (Math.random() * 0.9 - 0.45);
  const dir = directionTowards === 'player1' ? -1 : 1;

  state.ball.x = config.canvasWidth / 2;
  state.ball.y = config.canvasHeight / 2;
  state.ball.speed = config.ballInitialSpeed;
  state.ball.vx = dir * state.ball.speed * Math.cos(angle);
  state.ball.vy = state.ball.speed * Math.sin(angle);
}

/**
 * Updates game state according to time delta (dt in seconds) and active inputs.
 */
export function updatePhysics(
  state: GameState,
  input: InputState,
  dt: number,
  config: GameConfig
): void {
  // 1. Move Player 1 Paddle (W / S)
  if (input.p1Up) {
    state.player1.y -= state.player1.speed * dt;
  }
  if (input.p1Down) {
    state.player1.y += state.player1.speed * dt;
  }
  // Clamp P1 inside canvas
  state.player1.y = Math.max(0, Math.min(config.canvasHeight - state.player1.height, state.player1.y));

  // 2. Move Player 2 Paddle (ArrowUp / ArrowDown)
  if (input.p2Up) {
    state.player2.y -= state.player2.speed * dt;
  }
  if (input.p2Down) {
    state.player2.y += state.player2.speed * dt;
  }
  // Clamp P2 inside canvas
  state.player2.y = Math.max(0, Math.min(config.canvasHeight - state.player2.height, state.player2.y));

  // 3. Handle Serving countdown
  if (state.status === 'serving') {
    state.serveTimer -= dt;
    if (state.serveTimer <= 0) {
      state.status = 'playing';
      // Serve towards the player who just conceded a point, or random on start
      const targetPlayer = state.lastScorer === 'player1' ? 'player2' : 'player1';
      serveBall(state, config, targetPlayer);
    }
    return;
  }

  // 4. Handle Active Gameplay Physics
  if (state.status === 'playing') {
    const { ball, player1, player2 } = state;

    // Move Ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const halfSize = ball.size / 2;

    // Top Wall Collision
    if (ball.y - halfSize <= 0) {
      ball.y = halfSize;
      ball.vy = Math.abs(ball.vy);
    }

    // Bottom Wall Collision
    if (ball.y + halfSize >= config.canvasHeight) {
      ball.y = config.canvasHeight - halfSize;
      ball.vy = -Math.abs(ball.vy);
    }

    // Left Paddle (Player 1) Collision
    if (
      ball.vx < 0 &&
      ball.x - halfSize <= player1.x + player1.width &&
      ball.x + halfSize >= player1.x &&
      ball.y + halfSize >= player1.y &&
      ball.y - halfSize <= player1.y + player1.height
    ) {
      // Calculate deflection angle based on hit position
      const paddleCenterY = player1.y + player1.height / 2;
      const normalizedHit = (ball.y - paddleCenterY) / (player1.height / 2);
      const clampedHit = Math.max(-1, Math.min(1, normalizedHit));
      const bounceAngle = clampedHit * (Math.PI / 3.4); // max ~53 degrees

      // Increase speed slightly per hit
      ball.speed = Math.min(config.ballMaxSpeed, ball.speed + config.ballSpeedIncrement);
      ball.vx = Math.abs(ball.speed * Math.cos(bounceAngle));
      ball.vy = ball.speed * Math.sin(bounceAngle);
      ball.x = player1.x + player1.width + halfSize;
    }

    // Right Paddle (Player 2) Collision
    if (
      ball.vx > 0 &&
      ball.x + halfSize >= player2.x &&
      ball.x - halfSize <= player2.x + player2.width &&
      ball.y + halfSize >= player2.y &&
      ball.y - halfSize <= player2.y + player2.height
    ) {
      // Calculate deflection angle based on hit position
      const paddleCenterY = player2.y + player2.height / 2;
      const normalizedHit = (ball.y - paddleCenterY) / (player2.height / 2);
      const clampedHit = Math.max(-1, Math.min(1, normalizedHit));
      const bounceAngle = clampedHit * (Math.PI / 3.4);

      // Increase speed slightly per hit
      ball.speed = Math.min(config.ballMaxSpeed, ball.speed + config.ballSpeedIncrement);
      ball.vx = -Math.abs(ball.speed * Math.cos(bounceAngle));
      ball.vy = ball.speed * Math.sin(bounceAngle);
      ball.x = player2.x - halfSize;
    }

    // Left boundary passed -> Player 2 scores
    if (ball.x + halfSize < 0) {
      player2.score += 1;
      state.lastScorer = 'player2';

      if (player2.score >= config.targetScore) {
        state.status = 'gameover';
        state.winner = 'player2';
      } else {
        state.status = 'serving';
        state.serveTimer = config.serveDelaySeconds;
        ball.x = config.canvasWidth / 2;
        ball.y = config.canvasHeight / 2;
        ball.vx = 0;
        ball.vy = 0;
      }
    }

    // Right boundary passed -> Player 1 scores
    if (ball.x - halfSize > config.canvasWidth) {
      player1.score += 1;
      state.lastScorer = 'player1';

      if (player1.score >= config.targetScore) {
        state.status = 'gameover';
        state.winner = 'player1';
      } else {
        state.status = 'serving';
        state.serveTimer = config.serveDelaySeconds;
        ball.x = config.canvasWidth / 2;
        ball.y = config.canvasHeight / 2;
        ball.vx = 0;
        ball.vy = 0;
      }
    }
  }
}
