import { DEFAULT_CONFIG } from './config';
import { createInitialState, updatePhysics } from './physics';
import type { InputState } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Running Pong Physics Unit Tests ---');

// 1. Initial State
const state = createInitialState(DEFAULT_CONFIG);
assert(state.player1.score === 0, 'P1 initial score should be 0');
assert(state.player2.score === 0, 'P2 initial score should be 0');
assert(state.status === 'idle', 'Initial status should be idle');
console.log('✓ Initial state created properly');

const idleInput: InputState = {
  p1Up: false,
  p1Down: false,
  p2Up: false,
  p2Down: false,
  space: false,
  restart: false,
};

// 2. Paddle Boundary Clamping
state.player1.y = 10;
const p1UpInput: InputState = { ...idleInput, p1Up: true };
updatePhysics(state, p1UpInput, 0.5, DEFAULT_CONFIG);
assert(state.player1.y === 0, 'Paddle 1 should clamp at top boundary (0)');
console.log('✓ Paddle top clamping verified');

state.player1.y = DEFAULT_CONFIG.canvasHeight - state.player1.height - 10;
const p1DownInput: InputState = { ...idleInput, p1Down: true };
updatePhysics(state, p1DownInput, 0.5, DEFAULT_CONFIG);
assert(
  state.player1.y === DEFAULT_CONFIG.canvasHeight - state.player1.height,
  'Paddle 1 should clamp at bottom boundary'
);
console.log('✓ Paddle bottom clamping verified');

// 3. Wall Bounce
state.status = 'playing';
state.ball.x = 400;
state.ball.y = 5;
state.ball.vx = 100;
state.ball.vy = -200; // moving up into top wall
updatePhysics(state, idleInput, 0.1, DEFAULT_CONFIG);
assert(state.ball.vy > 0, 'Ball vy should become positive after top wall bounce');
console.log('✓ Top wall bounce verified');

// 4. Paddle Collision & Acceleration
state.player1.y = 200;
state.ball.x = state.player1.x + state.player1.width + 2;
state.ball.y = state.player1.y + state.player1.height / 2;
state.ball.vx = -300;
state.ball.vy = 0;
const prevSpeed = state.ball.speed;
updatePhysics(state, idleInput, 0.05, DEFAULT_CONFIG);
assert(state.ball.vx > 0, 'Ball should bounce right after hitting left paddle');
assert(state.ball.speed > prevSpeed, 'Ball speed should increase after paddle hit');
console.log('✓ Paddle collision and speed acceleration verified');

// 5. Scoring & Reset
state.status = 'playing';
state.ball.x = -20; // out of left bounds
state.ball.vx = -300;
updatePhysics(state, idleInput, 0.05, DEFAULT_CONFIG);
assert(state.player2.score === 1, 'Player 2 should score a point');
assert((state.status as string) === 'serving', 'Status should transition to serving after a goal');
console.log('✓ Goal detection & scoring verified');

// 6. Win Condition (First to 10)
state.player1.score = 9;
state.ball.x = DEFAULT_CONFIG.canvasWidth + 20; // Player 1 scores 10th point
state.ball.vx = 300;
state.status = 'playing';
updatePhysics(state, idleInput, 0.05, DEFAULT_CONFIG);
assert(state.player1.score === 10, 'Player 1 score should be 10');
assert((state.status as string) === 'gameover', 'Game should be gameover when reaching 10');
assert(state.winner === 'player1', 'Winner should be player1');
console.log('✓ First-to-10 win condition verified');

console.log('--- ALL PONG PHYSICS TESTS PASSED ---');
