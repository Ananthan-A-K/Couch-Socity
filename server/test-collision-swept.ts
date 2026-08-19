import { GameSession, GAME_CONSTANTS } from './src/gameSession';

function runSweptCollisionTests() {
  console.log('--- Starting Comprehensive 2D Swept / Anti-Tunneling Collision Tests ---');

  const session = new GameSession('TEST1');
  session.state.status = 'playing';

  const halfSize = GAME_CONSTANTS.BALL_SIZE / 2; // 6
  const p1MaxX = GAME_CONSTANTS.PADDLE_MARGIN + GAME_CONSTANTS.PADDLE_WIDTH + halfSize; // 46
  const p2MinX = GAME_CONSTANTS.CANVAS_WIDTH - GAME_CONSTANTS.PADDLE_MARGIN - GAME_CONSTANTS.PADDLE_WIDTH - halfSize; // 754

  // Test 1: Fast ball moving towards Left Paddle (Player 1) that jumps past plane in 1 tick
  session.state.player1.y = 200;
  session.state.ball.x = 60;
  session.state.ball.y = 230;
  session.state.ball.velocityX = -1200;
  session.state.ball.velocityY = 0;

  (session as any).physicsStep(1 / 60, { to: () => ({ emit: () => {} }) } as any);

  if (session.state.ball.velocityX > 0 && session.state.ball.x >= p1MaxX) {
    console.log(`✓ Test 1 Passed: Fast head-on ball bounced off P1 paddle (x=${session.state.ball.x.toFixed(2)}, vx=${session.state.ball.velocityX.toFixed(2)})`);
  } else {
    throw new Error(`Test 1 Failed: Fast head-on ball tunneled through P1 (x=${session.state.ball.x}, vx=${session.state.ball.velocityX})`);
  }

  // Test 2: Top Corner hit on Player 1 paddle
  session.state.player1.y = 200;
  session.state.ball.x = 55;
  session.state.ball.y = 196; // Within top corner radius extent [194, 290]
  session.state.ball.velocityX = -800;
  session.state.ball.velocityY = 300;

  (session as any).physicsStep(1 / 60, { to: () => ({ emit: () => {} }) } as any);

  if (session.state.ball.velocityX > 0 && session.state.ball.x >= p1MaxX) {
    console.log(`✓ Test 2 Passed: Top corner hit bounced off P1 paddle (x=${session.state.ball.x.toFixed(2)}, vx=${session.state.ball.velocityX.toFixed(2)})`);
  } else {
    throw new Error(`Test 2 Failed: Top corner hit tunneled through P1 (x=${session.state.ball.x}, vx=${session.state.ball.velocityX})`);
  }

  // Test 3: Bottom Corner hit on Player 2 paddle
  session.state.player2.y = 150; // extent [144, 240]
  session.state.ball.x = 745;
  session.state.ball.y = 238; // Bottom corner
  session.state.ball.velocityX = 900;
  session.state.ball.velocityY = -200;

  (session as any).physicsStep(1 / 60, { to: () => ({ emit: () => {} }) } as any);

  if (session.state.ball.velocityX < 0 && session.state.ball.x <= p2MinX) {
    console.log(`✓ Test 3 Passed: Bottom corner hit bounced off P2 paddle (x=${session.state.ball.x.toFixed(2)}, vx=${session.state.ball.velocityX.toFixed(2)})`);
  } else {
    throw new Error(`Test 3 Failed: Bottom corner hit tunneled through P2 (x=${session.state.ball.x}, vx=${session.state.ball.velocityX})`);
  }

  // Test 4: Ball clearly misses paddle vertically
  session.state.player1.y = 100;
  session.state.ball.x = 60;
  session.state.ball.y = 350; // Far below
  session.state.ball.velocityX = -1200;
  session.state.ball.velocityY = 0;

  (session as any).physicsStep(1 / 60, { to: () => ({ emit: () => {} }) } as any);

  if (session.state.ball.velocityX < 0) {
    console.log(`✓ Test 4 Passed: Ball correctly missed paddle without false collision`);
  } else {
    throw new Error(`Test 4 Failed: False positive collision when ball missed paddle vertically`);
  }

  console.log('--- ALL 2D SWEPT COLLISION TESTS PASSED ---');
}

runSweptCollisionTests();
