import type { GameConfig, GameState } from './types';
import { DEFAULT_CONFIG } from './config';
import { createInitialState, updatePhysics } from './physics';
import { InputManager } from './input';
import { PongRenderer } from './renderer';

export class PongEngine {
  private config: GameConfig;
  private state: GameState;
  private input: InputManager;
  private renderer: PongRenderer | null = null;

  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  private lastSpacePressed: boolean = false;
  private lastRestartPressed: boolean = false;

  public onStateChange?: (state: GameState) => void;

  constructor(config: Partial<GameConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = createInitialState(this.config);
    this.input = new InputManager();
  }

  public init(canvas: HTMLCanvasElement): void {
    canvas.width = this.config.canvasWidth;
    canvas.height = this.config.canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain 2D canvas context');
    }

    this.renderer = new PongRenderer(ctx, this.config);
    this.input.attach();
    this.renderer.render(this.state);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public serve(): void {
    if (this.state.status === 'idle' || this.state.status === 'gameover') {
      if (this.state.status === 'gameover') {
        this.reset();
      }
      this.state.status = 'serving';
      this.state.serveTimer = this.config.serveDelaySeconds;
      this.onStateChange?.(this.state);
    }
  }

  public reset(): void {
    this.state = createInitialState(this.config);
    this.lastSpacePressed = false;
    this.lastRestartPressed = false;
    this.onStateChange?.(this.state);
    if (this.renderer) {
      this.renderer.render(this.state);
    }
  }

  public getInput(): InputManager {
    return this.input;
  }

  public pause(): void {
    if (this.state.status === 'playing') {
      this.state.status = 'paused';
      this.onStateChange?.(this.state);
    }
  }

  public resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'playing';
      this.onStateChange?.(this.state);
    }
  }

  public getState(): GameState {
    return { ...this.state };
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.input.detach();
    this.renderer = null;
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Calculate delta time in seconds, clamped to max 0.1s to avoid frame jumps
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    const currentInput = this.input.getState();

    // Handle single-press actions
    if (currentInput.space && !this.lastSpacePressed) {
      if (this.state.status === 'idle') {
        this.serve();
      } else if (this.state.status === 'gameover') {
        this.reset();
        this.serve();
      } else if (this.state.status === 'playing') {
        this.pause();
      } else if (this.state.status === 'paused') {
        this.resume();
      }
    }

    if (currentInput.restart && !this.lastRestartPressed) {
      this.reset();
    }

    this.lastSpacePressed = currentInput.space;
    this.lastRestartPressed = currentInput.restart;

    // Update Physics
    updatePhysics(this.state, currentInput, dt, this.config);

    // Render Canvas
    if (this.renderer) {
      this.renderer.render(this.state);
    }

    this.onStateChange?.(this.state);

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
