import type { AuthoritativeGameState, PlayerRole, InputDirection } from '../types';
import { getMeasuredRttMs } from '../services/socket';

export const ONLINE_GAME_CONFIG = {
  canvasWidth: 800,
  canvasHeight: 500,
  paddleWidth: 12,
  paddleHeight: 84,
  paddleMargin: 28,
  paddleRadius: 4,
  ballSize: 12,
  paddleSpeed: 440, // px per second matching server authoritative physics
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

interface Snapshot {
  timestamp: number;
  p1Y: number;
  p2Y: number;
  p1Dir: number;
  p2Dir: number;
}

export class OnlinePongRenderer {
  private ctx: CanvasRenderingContext2D;
  private visualP1Y: number = (ONLINE_GAME_CONFIG.canvasHeight - ONLINE_GAME_CONFIG.paddleHeight) / 2;
  private visualP2Y: number = (ONLINE_GAME_CONFIG.canvasHeight - ONLINE_GAME_CONFIG.paddleHeight) / 2;
  private visualBallX: number = ONLINE_GAME_CONFIG.canvasWidth / 2;
  private visualBallY: number = ONLINE_GAME_CONFIG.canvasHeight / 2;
  private hasInitialized = false;

  // Single-Owner Local Prediction State
  private predictedLocalY: number = (ONLINE_GAME_CONFIG.canvasHeight - ONLINE_GAME_CONFIG.paddleHeight) / 2;

  // Remote Paddle Snapshot Interpolation Buffer
  private snapshotBuffer: Snapshot[] = [];
  private lastRecordedTimestamp: number = 0;

  // Visual Animation States
  private p1HitEffect: number = 0; // 0 to 1 decay
  private p2HitEffect: number = 0; // 0 to 1 decay
  private lastBallVx: number = 0;
  private lastBallVy: number = 0;

  // Score pop animations
  private lastP1Score: number = 0;
  private lastP2Score: number = 0;
  private p1ScoreScale: number = 1;
  private p2ScoreScale: number = 1;

  // Countdown scale animation
  private lastCountdown: number = -1;
  private countdownScale: number = 1;

  // Particles
  private particles: Particle[] = [];
  private victoryParticles: Particle[] = [];

  private lastRenderTime: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public triggerPaddleHit(side: 'left' | 'right', y: number): void {
    const { canvasWidth: w, paddleMargin, paddleWidth } = ONLINE_GAME_CONFIG;
    if (side === 'left') {
      this.p1HitEffect = 1;
      this.spawnSparks(paddleMargin + paddleWidth, y, 1);
    } else {
      this.p2HitEffect = 1;
      this.spawnSparks(w - paddleMargin - paddleWidth, y, -1);
    }
  }

  public triggerWallBounce(x: number, y: number): void {
    this.spawnSparks(x, y, 0, 4);
  }

  private spawnSparks(x: number, y: number, dirX: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y: y + (Math.random() * 20 - 10),
        vx: (dirX !== 0 ? dirX * (Math.random() * 3 + 1) : Math.random() * 4 - 2),
        vy: Math.random() * 4 - 2,
        size: Math.random() * 2.5 + 1.5,
        alpha: 1,
        color: '#fafaf9',
      });
    }
  }

  private spawnVictoryConfetti(): void {
    const { canvasWidth: w, canvasHeight: h } = ONLINE_GAME_CONFIG;
    if (this.victoryParticles.length < 50) {
      for (let i = 0; i < 30; i++) {
        this.victoryParticles.push({
          x: Math.random() * w,
          y: Math.random() * h - 20,
          vx: Math.random() * 2 - 1,
          vy: Math.random() * 2 + 1,
          size: Math.random() * 3 + 2,
          alpha: Math.random() * 0.7 + 0.3,
          color: Math.random() > 0.5 ? '#34d399' : '#fafaf9',
        });
      }
    }
  }

  /**
   * Interpolates the remote paddle smoothly between authoritative server snapshots.
   */
  private getInterpolatedRemoteY(role: 'player1' | 'player2', fallbackY: number, now: number): number {
    if (this.snapshotBuffer.length < 2) {
      return fallbackY;
    }

    const INTERPOLATION_DELAY_MS = 60; // 60ms delay buffer for jitter-free interpolation
    const latestTimestamp = this.snapshotBuffer[this.snapshotBuffer.length - 1]?.timestamp ?? now;
    const renderTime = latestTimestamp - INTERPOLATION_DELAY_MS;

    let s0: Snapshot | null = null;
    let s1: Snapshot | null = null;

    for (let i = this.snapshotBuffer.length - 1; i >= 0; i--) {
      if (this.snapshotBuffer[i].timestamp <= renderTime) {
        s0 = this.snapshotBuffer[i];
        s1 = this.snapshotBuffer[i + 1] || null;
        break;
      }
    }

    const isP1 = role === 'player1';

    if (s0 && s1 && s1.timestamp > s0.timestamp) {
      const t = (renderTime - s0.timestamp) / (s1.timestamp - s0.timestamp);
      const clampedT = Math.max(0, Math.min(1, t));
      const y0 = isP1 ? s0.p1Y : s0.p2Y;
      const y1 = isP1 ? s1.p1Y : s1.p2Y;
      return y0 + (y1 - y0) * clampedT;
    } else if (s0) {
      // Short dead reckoning if buffer runs slightly dry
      const y0 = isP1 ? s0.p1Y : s0.p2Y;
      const dir = isP1 ? s0.p1Dir : s0.p2Dir;
      const dtAhead = Math.max(0, Math.min(0.08, (renderTime - s0.timestamp) / 1000));
      const deadReckonY = y0 + dir * ONLINE_GAME_CONFIG.paddleSpeed * dtAhead;
      const maxPaddleY = ONLINE_GAME_CONFIG.canvasHeight - ONLINE_GAME_CONFIG.paddleHeight;
      return Math.max(0, Math.min(maxPaddleY, deadReckonY));
    }

    return fallbackY;
  }

  public render(
    state: AuthoritativeGameState,
    localRole: PlayerRole | null,
    hasOpponent: boolean,
    localDirection: InputDirection = 0,
    interpolate: boolean = true
  ): void {
    const { ctx } = this;
    const {
      canvasWidth: w,
      canvasHeight: h,
      paddleWidth,
      paddleHeight,
      paddleMargin,
      paddleRadius,
      ballSize,
      paddleSpeed,
    } = ONLINE_GAME_CONFIG;

    const now = performance.now();
    const dt = this.lastRenderTime > 0 ? Math.min(0.05, (now - this.lastRenderTime) / 1000) : 0.016;
    this.lastRenderTime = now;

    const p1Y = state.player1?.y ?? (h - paddleHeight) / 2;
    const p2Y = state.player2?.y ?? (h - paddleHeight) / 2;
    const ballX = state.ball?.x ?? w / 2;
    const ballY = state.ball?.y ?? h / 2;
    const ballVx = state.ball?.velocityX ?? 0;
    const ballVy = state.ball?.velocityY ?? 0;
    const p1Score = state.score?.player1 ?? 0;
    const p2Score = state.score?.player2 ?? 0;

    if (!this.hasInitialized) {
      this.visualP1Y = p1Y;
      this.visualP2Y = p2Y;
      this.visualBallX = ballX;
      this.visualBallY = ballY;
      this.lastP1Score = p1Score;
      this.lastP2Score = p2Score;
      this.lastCountdown = state.countdown ?? 3;
      this.hasInitialized = true;
    }

    // Detect Score Changes for Pop Animation
    if (p1Score !== this.lastP1Score) {
      this.p1ScoreScale = 1.35;
      this.lastP1Score = p1Score;
    }
    if (p2Score !== this.lastP2Score) {
      this.p2ScoreScale = 1.35;
      this.lastP2Score = p2Score;
    }
    this.p1ScoreScale += (1 - this.p1ScoreScale) * 0.12;
    this.p2ScoreScale += (1 - this.p2ScoreScale) * 0.12;

    // Detect Countdown Changes for Pulse Animation
    if (state.status === 'countdown' && state.countdown !== this.lastCountdown) {
      this.countdownScale = 1.4;
      this.lastCountdown = state.countdown;
    }
    this.countdownScale += (1 - this.countdownScale) * 0.14;

    // Detect Ball Bounce / Direction changes for visual particle sparks
    if (this.lastBallVx !== 0 && ballVx !== 0) {
      if (Math.sign(ballVx) !== Math.sign(this.lastBallVx)) {
        if (ballVx > 0) {
          this.triggerPaddleHit('left', ballY);
        } else {
          this.triggerPaddleHit('right', ballY);
        }
      }
    }
    if (this.lastBallVy !== 0 && ballVy !== 0) {
      if (Math.sign(ballVy) !== Math.sign(this.lastBallVy)) {
        this.triggerWallBounce(ballX, ballY);
      }
    }
    this.lastBallVx = ballVx;
    this.lastBallVy = ballVy;

    // Decay paddle hit effects
    this.p1HitEffect = Math.max(0, this.p1HitEffect - 0.08);
    this.p2HitEffect = Math.max(0, this.p2HitEffect - 0.08);

    if (interpolate) {
      const maxPaddleY = h - paddleHeight;

      // Update Snapshot Buffer for Remote Paddle
      const serverTimestamp = state.timestamp || Date.now();
      if (serverTimestamp !== this.lastRecordedTimestamp) {
        this.lastRecordedTimestamp = serverTimestamp;
        this.snapshotBuffer.push({
          timestamp: serverTimestamp,
          p1Y,
          p2Y,
          p1Dir: state.player1?.direction ?? 0,
          p2Dir: state.player2?.direction ?? 0,
        });
        if (this.snapshotBuffer.length > 20) {
          this.snapshotBuffer.shift();
        }
      }

      if (state.status === 'playing' && localRole) {
        const isP1 = localRole === 'player1';
        const serverLocalY = isP1 ? p1Y : p2Y;
        const serverLocalDir = isP1
          ? (state.player1?.direction ?? 0)
          : (state.player2?.direction ?? 0);
        const serverOpponentY = isP1 ? p2Y : p1Y;

        // 1. Immediate Local Visual Movement (100% Responsive)
        if (localDirection !== 0) {
          this.predictedLocalY += localDirection * paddleSpeed * dt;
          this.predictedLocalY = Math.max(0, Math.min(maxPaddleY, this.predictedLocalY));
        }

        // 2. Continuous Drift Compensation (Zero-Flicker Time Synchronization)
        const rttMs = getMeasuredRttMs();
        const oneWaySec = Math.max(0.005, Math.min(0.12, (rttMs / 2) / 1000));

        let expectedServerY = serverLocalY;
        if (serverLocalDir !== 0) {
          expectedServerY += serverLocalDir * paddleSpeed * oneWaySec;
          expectedServerY = Math.max(0, Math.min(maxPaddleY, expectedServerY));
        }

        if (localDirection === 0 && serverLocalDir === 0) {
          // Stationary -> smoothly settle directly onto authoritative server position
          const diff = serverLocalY - this.predictedLocalY;
          if (Math.abs(diff) < 0.5) {
            this.predictedLocalY = serverLocalY;
          } else {
            this.predictedLocalY += diff * 0.25;
          }
        } else {
          // Moving -> gently guide any sub-pixel latency drift without any snapping
          const drift = expectedServerY - this.predictedLocalY;
          this.predictedLocalY += drift * 0.08;
        }

        // 3. Assign Visual Positions (Single Visual Owner)
        if (isP1) {
          this.visualP1Y = this.predictedLocalY;
          this.visualP2Y = this.getInterpolatedRemoteY('player2', serverOpponentY, now);
        } else {
          this.visualP2Y = this.predictedLocalY;
          this.visualP1Y = this.getInterpolatedRemoteY('player1', serverOpponentY, now);
        }
      } else {
        // Non-playing state (waiting, countdown, game-over, round reset)
        this.snapshotBuffer = [];
        this.lastRecordedTimestamp = 0;
        this.predictedLocalY = localRole === 'player1' ? p1Y : p2Y;

        this.visualP1Y += (p1Y - this.visualP1Y) * 0.35;
        this.visualP2Y += (p2Y - this.visualP2Y) * 0.35;
      }

      // Smooth ball movement (100% Server Authoritative)
      this.visualBallX += (ballX - this.visualBallX) * 0.65;
      this.visualBallY += (ballY - this.visualBallY) * 0.65;
    } else {
      this.visualP1Y = p1Y;
      this.visualP2Y = p2Y;
      this.visualBallX = ballX;
      this.visualBallY = ballY;
    }

    // 1. Clear background
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Center Net
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Scores with Spring Scale Pop Animation
    ctx.fillStyle = '#44403c';
    ctx.font = '700 64px "Space Mono", monospace';
    ctx.textBaseline = 'top';

    // Player 1 Score (Left)
    ctx.save();
    ctx.translate(w / 2 - 48, 28);
    ctx.scale(this.p1ScoreScale, this.p1ScoreScale);
    ctx.textAlign = 'right';
    ctx.fillText(state.score.player1.toString(), 0, 0);
    ctx.restore();

    // Player 2 Score (Right)
    ctx.save();
    ctx.translate(w / 2 + 48, 28);
    ctx.scale(this.p2ScoreScale, this.p2ScoreScale);
    ctx.textAlign = 'left';
    ctx.fillText(state.score.player2.toString(), 0, 0);
    ctx.restore();

    // 4. Draw Player 1 Paddle with Hit Pulse Animation
    const p1Width = paddleWidth + this.p1HitEffect * 4;
    ctx.fillStyle = this.p1HitEffect > 0 ? '#ffffff' : (localRole === 'player1' ? '#fafaf9' : '#e7e5e4');
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(paddleMargin, this.visualP1Y, p1Width, paddleHeight, paddleRadius);
    } else {
      ctx.rect(paddleMargin, this.visualP1Y, p1Width, paddleHeight);
    }
    ctx.fill();

    // 5. Draw Player 2 Paddle with Hit Pulse Animation
    const p2Width = paddleWidth + this.p2HitEffect * 4;
    const p2X = w - paddleMargin - p2Width;
    ctx.fillStyle = this.p2HitEffect > 0 ? '#ffffff' : (localRole === 'player2' ? '#fafaf9' : '#e7e5e4');
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(p2X, this.visualP2Y, p2Width, paddleHeight, paddleRadius);
    } else {
      ctx.rect(p2X, this.visualP2Y, p2Width, paddleHeight);
    }
    ctx.fill();

    // 6. Draw Ball with Hit Feedback
    if (state.status === 'playing' || state.status === 'countdown') {
      ctx.fillStyle = '#fafaf9';
      const halfSize = ballSize / 2;
      ctx.fillRect(
        Math.round(this.visualBallX - halfSize),
        Math.round(this.visualBallY - halfSize),
        ballSize,
        ballSize
      );
    }

    // 7. Update & Draw Particles
    this.updateAndDrawParticles();

    // 8. Render Overlays
    this.drawOverlays(state, localRole, hasOpponent);
  }

  private updateAndDrawParticles(): void {
    const { ctx } = this;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.05;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
  }

  private drawOverlays(
    state: AuthoritativeGameState,
    localRole: PlayerRole | null,
    hasOpponent: boolean
  ): void {
    const { ctx } = this;
    const { canvasWidth: w, canvasHeight: h } = ONLINE_GAME_CONFIG;

    ctx.textAlign = 'center';

    if (state.status === 'waiting') {
      ctx.fillStyle = 'rgba(12, 10, 9, 0.45)';
      ctx.fillRect(0, 0, w, h);

      if (!hasOpponent) {
        ctx.fillStyle = '#a8a29e';
        ctx.font = '500 13px "Space Mono", monospace';
        ctx.fillText('WAITING FOR OPPONENT TO JOIN...', w / 2, h / 2 + 40);
      } else {
        const myReady =
          localRole === 'player1'
            ? state.player1.ready
            : localRole === 'player2'
            ? state.player2.ready
            : false;

        const opponentReady =
          localRole === 'player1'
            ? state.player2.ready
            : state.player1.ready;

        ctx.font = '700 14px "Space Mono", monospace';
        if (!myReady) {
          ctx.fillStyle = '#fafaf9';
          ctx.fillText('CLICK "READY UP" TO BEGIN MATCH', w / 2, h / 2 + 35);
        } else if (!opponentReady) {
          ctx.fillStyle = '#facc15';
          ctx.fillText('YOU ARE READY • WAITING FOR OPPONENT...', w / 2, h / 2 + 35);
        } else {
          ctx.fillStyle = '#34d399';
          ctx.fillText('BOTH PLAYERS READY!', w / 2, h / 2 + 35);
        }
      }
    } else if (state.status === 'countdown') {
      // Big Countdown Graphic with Spring Scale Animation
      ctx.fillStyle = 'rgba(12, 10, 9, 0.55)';
      ctx.fillRect(0, 0, w, h);

      const isGo = state.countdown === 0;
      const countdownText = isGo ? 'GO!' : state.countdown.toString();

      ctx.save();
      ctx.translate(w / 2, h / 2 - 15);
      ctx.scale(this.countdownScale, this.countdownScale);
      ctx.fillStyle = isGo ? '#34d399' : '#fafaf9';
      ctx.font = '800 84px "Space Mono", monospace';
      ctx.fillText(countdownText, 0, 0);
      ctx.restore();

      ctx.font = '500 12px "Space Mono", monospace';
      ctx.fillStyle = '#a8a29e';
      ctx.fillText(isGo ? 'SERVE INCOMING!' : 'GET READY...', w / 2, h / 2 + 55);
    } else if (state.status === 'game-over') {
      // Game Over Screen with Celebratory Confetti
      this.spawnVictoryConfetti();
      ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
      ctx.fillRect(0, 0, w, h);

      // Render victory particles
      for (let i = this.victoryParticles.length - 1; i >= 0; i--) {
        const vp = this.victoryParticles[i];
        vp.y += vp.vy;
        vp.x += vp.vx;
        if (vp.y > h) vp.y = -10;

        ctx.save();
        ctx.globalAlpha = vp.alpha;
        ctx.fillStyle = vp.color;
        ctx.fillRect(vp.x, vp.y, vp.size, vp.size);
        ctx.restore();
      }

      const isWinner = localRole === state.winner;
      const winnerName =
        state.winner === 'player1' ? 'PLAYER 1 (LEFT)' : 'PLAYER 2 (RIGHT)';

      ctx.fillStyle = isWinner ? '#34d399' : localRole ? '#f43f5e' : '#fafaf9';
      ctx.font = '800 40px "Space Mono", monospace';
      ctx.fillText(
        localRole ? (isWinner ? 'VICTORY!' : 'DEFEAT') : `${winnerName} WINS!`,
        w / 2,
        h / 2 - 25
      );

      ctx.fillStyle = '#e7e5e4';
      ctx.font = '700 18px "Space Mono", monospace';
      ctx.fillText(
        `${state.score.player1}  —  ${state.score.player2}`,
        w / 2,
        h / 2 + 25
      );

      ctx.fillStyle = '#78716c';
      ctx.font = '500 12px "Space Mono", monospace';
      ctx.fillText(
        'FIRST TO 10 • MATCH FINISHED',
        w / 2,
        h / 2 + 58
      );
    }
  }
}
