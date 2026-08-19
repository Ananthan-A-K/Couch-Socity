import type { GameConfig, GameState } from './types';

export class PongRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;

  constructor(ctx: CanvasRenderingContext2D, config: GameConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  public render(state: GameState): void {
    const { ctx, config } = this;
    const { canvasWidth: w, canvasHeight: h } = config;

    // 1. Clear background
    ctx.fillStyle = '#0c0a09'; // stone-950
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Center Net (Dashed Line)
    ctx.strokeStyle = '#292524'; // stone-800
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Scores
    ctx.fillStyle = '#44403c'; // stone-700
    ctx.font = 'bold 56px "Space Mono", monospace';
    ctx.textBaseline = 'top';

    // Player 1 Score (Left)
    ctx.textAlign = 'right';
    ctx.fillText(state.player1.score.toString(), w / 2 - 40, 24);

    // Player 2 Score (Right)
    ctx.textAlign = 'left';
    ctx.fillText(state.player2.score.toString(), w / 2 + 40, 24);

    // 4. Draw Player 1 Paddle (Left)
    ctx.fillStyle = '#f5f5f4'; // stone-100
    ctx.fillRect(
      state.player1.x,
      state.player1.y,
      state.player1.width,
      state.player1.height
    );

    // 5. Draw Player 2 Paddle (Right)
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(
      state.player2.x,
      state.player2.y,
      state.player2.width,
      state.player2.height
    );

    // 6. Draw Ball
    if (state.status !== 'idle') {
      ctx.fillStyle = '#fafaf9'; // stone-50
      const halfSize = state.ball.size / 2;
      ctx.fillRect(
        state.ball.x - halfSize,
        state.ball.y - halfSize,
        state.ball.size,
        state.ball.size
      );
    }

    // 7. Status Overlays
    this.drawOverlays(state);
  }

  private drawOverlays(state: GameState): void {
    const { ctx, config } = this;
    const { canvasWidth: w, canvasHeight: h } = config;

    ctx.textAlign = 'center';

    if (state.status === 'idle') {
      // Idle / Start screen prompt
      ctx.fillStyle = '#fafaf9';
      ctx.font = 'bold 16px "Space Mono", monospace';
      ctx.fillText('PRESS SPACE TO SERVE', w / 2, h / 2 + 60);

      ctx.fillStyle = '#78716c';
      ctx.font = '12px "Space Mono", monospace';
      ctx.fillText('FIRST TO 10 WINS', w / 2, h / 2 + 90);
    } else if (state.status === 'serving') {
      // Serving countdown / alert
      ctx.fillStyle = '#a8a29e';
      ctx.font = '13px "Space Mono", monospace';
      ctx.fillText('READY...', w / 2, h / 2 + 60);
    } else if (state.status === 'gameover') {
      // Winner Banner
      ctx.fillStyle = 'rgba(12, 10, 9, 0.85)';
      ctx.fillRect(0, 0, w, h);

      const winnerText =
        state.winner === 'player1' ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS';

      ctx.fillStyle = '#fafaf9';
      ctx.font = 'bold 36px "Space Mono", monospace';
      ctx.fillText(winnerText, w / 2, h / 2 - 20);

      ctx.fillStyle = '#a8a29e';
      ctx.font = '14px "Space Mono", monospace';
      ctx.fillText('PRESS SPACE TO PLAY AGAIN', w / 2, h / 2 + 35);
    } else if (state.status === 'paused') {
      ctx.fillStyle = 'rgba(12, 10, 9, 0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#fafaf9';
      ctx.font = 'bold 28px "Space Mono", monospace';
      ctx.fillText('PAUSED', w / 2, h / 2);
    }
  }
}
