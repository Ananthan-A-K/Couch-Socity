import type { GameConfig, GameState } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export class PongRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;

  // Visual Animation States
  private p1HitEffect: number = 0;
  private p2HitEffect: number = 0;
  private lastBallVx: number = 0;
  private lastBallVy: number = 0;

  // Score pop animations
  private lastP1Score: number = 0;
  private lastP2Score: number = 0;
  private p1ScoreScale: number = 1;
  private p2ScoreScale: number = 1;

  // Particles
  private particles: Particle[] = [];
  private victoryParticles: Particle[] = [];

  constructor(ctx: CanvasRenderingContext2D, config: GameConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  public triggerPaddleHit(side: 'left' | 'right', y: number): void {
    const { canvasWidth: w, paddleMargin, paddleWidth } = this.config;
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
        vx: dirX !== 0 ? dirX * (Math.random() * 3 + 1) : Math.random() * 4 - 2,
        vy: Math.random() * 4 - 2,
        size: Math.random() * 2.5 + 1.5,
        alpha: 1,
        color: '#fafaf9',
      });
    }
  }

  private spawnVictoryConfetti(): void {
    const { canvasWidth: w, canvasHeight: h } = this.config;
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

  public render(state: GameState): void {
    const { ctx, config } = this;
    const { canvasWidth: w, canvasHeight: h, paddleRadius } = config;

    // 1. Detect Score Changes for Pop Animation
    if (state.player1.score !== this.lastP1Score) {
      this.p1ScoreScale = 1.35;
      this.lastP1Score = state.player1.score;
    }
    if (state.player2.score !== this.lastP2Score) {
      this.p2ScoreScale = 1.35;
      this.lastP2Score = state.player2.score;
    }
    this.p1ScoreScale += (1 - this.p1ScoreScale) * 0.12;
    this.p2ScoreScale += (1 - this.p2ScoreScale) * 0.12;

    // 2. Detect Ball Bounce / Direction changes for visual particle sparks
    if (this.lastBallVx !== 0 && state.ball.vx !== 0) {
      if (Math.sign(state.ball.vx) !== Math.sign(this.lastBallVx)) {
        if (state.ball.vx > 0) {
          this.triggerPaddleHit('left', state.ball.y);
        } else {
          this.triggerPaddleHit('right', state.ball.y);
        }
      }
    }
    if (this.lastBallVy !== 0 && state.ball.vy !== 0) {
      if (Math.sign(state.ball.vy) !== Math.sign(this.lastBallVy)) {
        this.triggerWallBounce(state.ball.x, state.ball.y);
      }
    }
    this.lastBallVx = state.ball.vx;
    this.lastBallVy = state.ball.vy;

    // Decay paddle hit effects
    this.p1HitEffect = Math.max(0, this.p1HitEffect - 0.08);
    this.p2HitEffect = Math.max(0, this.p2HitEffect - 0.08);

    // 3. Clear background
    ctx.fillStyle = '#0c0a09'; // stone-950
    ctx.fillRect(0, 0, w, h);

    // 4. Draw Center Net (Dashed Line)
    ctx.strokeStyle = '#292524'; // stone-800
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Draw Scores with scale bounce
    ctx.fillStyle = '#44403c'; // stone-700
    ctx.font = '700 64px "Space Mono", monospace';
    ctx.textBaseline = 'top';

    // Player 1 Score (Left)
    ctx.save();
    ctx.translate(w / 2 - 48, 28);
    ctx.scale(this.p1ScoreScale, this.p1ScoreScale);
    ctx.textAlign = 'right';
    ctx.fillText(state.player1.score.toString(), 0, 0);
    ctx.restore();

    // Player 2 Score (Right)
    ctx.save();
    ctx.translate(w / 2 + 48, 28);
    ctx.scale(this.p2ScoreScale, this.p2ScoreScale);
    ctx.textAlign = 'left';
    ctx.fillText(state.player2.score.toString(), 0, 0);
    ctx.restore();

    // 6. Draw Player 1 Paddle with Hit Pulse Animation
    const p1Width = state.player1.width + this.p1HitEffect * 4;
    ctx.fillStyle = this.p1HitEffect > 0 ? '#ffffff' : '#fafaf9';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(state.player1.x, state.player1.y, p1Width, state.player1.height, paddleRadius ?? 4);
    } else {
      ctx.rect(state.player1.x, state.player1.y, p1Width, state.player1.height);
    }
    ctx.fill();

    // 7. Draw Player 2 Paddle with Hit Pulse Animation
    const p2Width = state.player2.width + this.p2HitEffect * 4;
    const p2X = state.player2.x - (this.p2HitEffect * 4);
    ctx.fillStyle = this.p2HitEffect > 0 ? '#ffffff' : '#fafaf9';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(p2X, state.player2.y, p2Width, state.player2.height, paddleRadius ?? 4);
    } else {
      ctx.rect(p2X, state.player2.y, p2Width, state.player2.height);
    }
    ctx.fill();

    // 8. Draw Ball
    if (state.status !== 'idle') {
      ctx.fillStyle = '#fafaf9';
      const halfSize = state.ball.size / 2;
      ctx.fillRect(
        Math.round(state.ball.x - halfSize),
        Math.round(state.ball.y - halfSize),
        state.ball.size,
        state.ball.size
      );
    }

    // 9. Update & Draw Particles
    this.updateAndDrawParticles();

    // 10. Status Overlays
    this.drawOverlays(state);
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

  private drawOverlays(state: GameState): void {
    const { ctx, config } = this;
    const { canvasWidth: w, canvasHeight: h } = config;

    ctx.textAlign = 'center';

    if (state.status === 'idle') {
      // Idle / Start screen prompt
      ctx.fillStyle = 'rgba(12, 10, 9, 0.45)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#fafaf9';
      ctx.font = '700 16px "Space Mono", monospace';
      ctx.fillText('PRESS SPACE TO SERVE', w / 2, h / 2 + 35);

      ctx.fillStyle = '#78716c';
      ctx.font = '500 12px "Space Mono", monospace';
      ctx.fillText('FIRST TO 10 WINS', w / 2, h / 2 + 65);
    } else if (state.status === 'gameover') {
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

      const winnerName =
        state.winner === 'player1' ? 'PLAYER 1 (LEFT)' : 'PLAYER 2 (RIGHT)';

      ctx.fillStyle = '#34d399';
      ctx.font = '800 40px "Space Mono", monospace';
      ctx.fillText(`${winnerName} WINS!`, w / 2, h / 2 - 25);

      ctx.fillStyle = '#e7e5e4';
      ctx.font = '700 18px "Space Mono", monospace';
      ctx.fillText(
        `${state.player1.score}  —  ${state.player2.score}`,
        w / 2,
        h / 2 + 25
      );

      ctx.fillStyle = '#a8a29e';
      ctx.font = '500 12px "Space Mono", monospace';
      ctx.fillText('PRESS SPACE TO PLAY AGAIN', w / 2, h / 2 + 58);
    } else if (state.status === 'paused') {
      ctx.fillStyle = 'rgba(12, 10, 9, 0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#fafaf9';
      ctx.font = '800 28px "Space Mono", monospace';
      ctx.fillText('PAUSED', w / 2, h / 2);
    }
  }
}
