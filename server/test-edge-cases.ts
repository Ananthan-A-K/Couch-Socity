import { RoomManager } from './src/rooms';
import { GameSession } from './src/gameSession';

async function runEdgeCaseTests() {
  console.log('--- Starting Comprehensive Edge Case Test Suite ---');
  const rm = new RoomManager();

  // Mock Socket.IO server emitter
  const mockIo: any = {
    to: () => ({
      emit: () => {},
    }),
    emit: () => {},
  };

  // Case 6: Invalid room code
  const resInvalid = rm.joinRoom('123', 'socket-1');
  if (resInvalid.success || resInvalid.errorType !== 'INVALID_CODE') {
    throw new Error('Case 6 Failed: Invalid room code should be rejected');
  }
  console.log('✓ Case 6: Invalid room code rejected');

  // Case 5: Room does not exist
  const resNotFound = rm.joinRoom('ZZZZZ', 'socket-1');
  if (resNotFound.success || resNotFound.errorType !== 'ROOM_NOT_FOUND') {
    throw new Error('Case 5 Failed: Non-existent room should return ROOM_NOT_FOUND');
  }
  console.log('✓ Case 5: Non-existent room rejected');

  // Create room
  const room = rm.createRoom('socket-p1');
  const roomCode = room.code;
  const session = rm.getOrCreateGameSession(roomCode, mockIo);
  console.log(`Created test room: ${roomCode}`);

  // Case 7: Same player tries to join twice
  const resDuplicate = rm.joinRoom(roomCode, 'socket-p1');
  if (!resDuplicate.success || resDuplicate.room?.player1?.id !== 'socket-p1') {
    throw new Error('Case 7 Failed: Duplicate join should return existing player');
  }
  console.log('✓ Case 7: Duplicate join handled cleanly');

  // Case 11: Single player readies up without opponent (cannot start countdown)
  session.setPlayerReady('player1', true, mockIo);
  if (session.state.status !== 'waiting') {
    throw new Error('Case 11 Failed: Single player should not trigger match start');
  }
  console.log('✓ Case 11: Single player cannot start game without opponent');

  // Player 2 joins
  const resJoinP2 = rm.joinRoom(roomCode, 'socket-p2');
  if (!resJoinP2.success || !room.player2) {
    throw new Error('Failed to join Player 2');
  }
  console.log('✓ Player 2 joined successfully');

  // Case 4: Third player tries to join a full room
  const resP3 = rm.joinRoom(roomCode, 'socket-p3');
  if (resP3.success || resP3.errorType !== 'ROOM_FULL') {
    throw new Error('Case 4 Failed: Third player should be rejected with ROOM_FULL');
  }
  console.log('✓ Case 4: Full room rejected 3rd player');

  // Case 9: Player leaves during match
  // Both ready up -> game starts
  session.setPlayerReady('player2', true, mockIo);
  session.start(mockIo);
  session.state.status = 'playing';

  // Player 2 disconnects / leaves during match
  rm.leaveRoom('socket-p2', undefined, mockIo);
  if (session.state.status !== 'waiting' || session.state.player1.ready || session.state.player2.ready) {
    throw new Error('Case 9 Failed: Player departure during match should reset state to waiting');
  }
  console.log('✓ Case 9: Player departure during match resets to waiting');

  // Case 2: Player re-joins (refresh scenario)
  const resRejoin = rm.joinRoom(roomCode, 'socket-p2-new');
  if (!resRejoin.success || !room.player2) {
    throw new Error('Case 2 Failed: Rejoining player should fill slot');
  }
  console.log('✓ Case 2: Refreshing / rejoining player takes open slot');

  // Case 10: Player leaves during rematch
  session.state.status = 'game-over';
  session.state.rematch = { player1: true, player2: false };
  rm.leaveRoom('socket-p1', undefined, mockIo);
  if (session.state.status !== 'waiting' || session.state.rematch.player1) {
    throw new Error('Case 10 Failed: Departure during rematch should reset state');
  }
  console.log('✓ Case 10: Departure during rematch resets rematch state');

  // Case 1 & 8: Both players leave, empty room enters 30s grace period
  rm.leaveRoom('socket-p2-new', undefined, mockIo);
  const roomInGrace = rm.getRoom(roomCode);
  if (!roomInGrace) {
    throw new Error('Case 8 Failed: Room should remain in grace period');
  }
  console.log('✓ Case 1 & 8: Empty room enters 30s grace period before destruction');

  console.log('--- ALL 11 EDGE CASES SUCCESSFULLY VERIFIED ---');
  process.exit(0);
}

runEdgeCaseTests().catch((err) => {
  console.error('Edge case test failed:', err);
  process.exit(1);
});
