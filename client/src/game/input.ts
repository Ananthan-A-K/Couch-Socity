import type { InputState } from './types';

export class InputManager {
  private state: InputState = {
    p1Up: false,
    p1Down: false,
    p2Up: false,
    p2Down: false,
    space: false,
    restart: false,
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
  }

  public attach(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.reset();
  }

  public getState(): InputState {
    return { ...this.state };
  }

  public setInputState(partial: Partial<InputState>): void {
    this.state = { ...this.state, ...partial };
  }

  public reset(): void {
    this.state = {
      p1Up: false,
      p1Down: false,
      p2Up: false,
      p2Down: false,
      space: false,
      restart: false,
    };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent window scrolling when using game controls
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    switch (e.code) {
      // Player 1 (W / S)
      case 'KeyW':
        this.state.p1Up = true;
        break;
      case 'KeyS':
        this.state.p1Down = true;
        break;

      // Player 2 (ArrowUp / ArrowDown)
      case 'ArrowUp':
        this.state.p2Up = true;
        break;
      case 'ArrowDown':
        this.state.p2Down = true;
        break;

      // Game Controls
      case 'Space':
        this.state.space = true;
        break;
      case 'KeyR':
        this.state.restart = true;
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      // Player 1
      case 'KeyW':
        this.state.p1Up = false;
        break;
      case 'KeyS':
        this.state.p1Down = false;
        break;

      // Player 2
      case 'ArrowUp':
        this.state.p2Up = false;
        break;
      case 'ArrowDown':
        this.state.p2Down = false;
        break;

      // Game Controls
      case 'Space':
        this.state.space = false;
        break;
      case 'KeyR':
        this.state.restart = false;
        break;
    }
  }
}
