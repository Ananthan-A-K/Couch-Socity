import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';
import { isValidRoomCode } from '../utils/roomCode';
import { socket, subscribeDiagnostics, type DiagnosticInfo } from '../services/socket';
import { sounds } from '../services/sound';
import { OnlinePongRenderer, ONLINE_GAME_CONFIG } from '../game/onlineRenderer';
import type {
  RoomState,
  PlayerInfo,
  AuthoritativeGameState,
  PlayerRole,
  InputDirection,
} from '../types';

const createDefaultGameState = (): AuthoritativeGameState => ({
  ball: {
    x: ONLINE_GAME_CONFIG.canvasWidth / 2,
    y: ONLINE_GAME_CONFIG.canvasHeight / 2,
    velocityX: 0,
    velocityY: 0,
  },
  player1: {
    y: (ONLINE_GAME_CONFIG.canvasHeight - ONLINE_GAME_CONFIG.paddleHeight) / 2,
    ready: false,
  },
  player2: {
    y: (ONLINE_GAME_CONFIG.canvasHeight - ONLINE_GAME_CONFIG.paddleHeight) / 2,
    ready: false,
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
});

export const RoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const cleanCode = (roomCode || '').toUpperCase().trim();
  const isValidFormat = isValidRoomCode(cleanCode);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<OnlinePongRenderer | null>(null);

  const [roomState, setRoomState] = useState<RoomState | null>(
    location.state?.initialRoomState || null
  );
  const [gameState, setGameState] = useState<AuthoritativeGameState>(
    () => location.state?.initialGameState || createDefaultGameState()
  );
  const gameStateRef = useRef<AuthoritativeGameState>(gameState);

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'NOT_FOUND' | 'FULL' | 'INVALID' | 'GENERIC' | null>(null);
  const [notification, setNotification] = useState<{
    text: string;
    type: 'warning' | 'info' | 'success';
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTouchDir, setActiveTouchDir] = useState<InputDirection>(0);

  // Sound tracking refs
  const prevP1ScoreRef = useRef(0);
  const prevP2ScoreRef = useRef(0);
  const prevCountdownRef = useRef(-1);
  const prevStatusRef = useRef<string | null>(null);
  const prevBallVxRef = useRef(0);
  const prevBallVyRef = useRef(0);

  // Determine local role
  const isPlayer1 = roomState?.player1?.id === socket.id;
  const isPlayer2 = roomState?.player2?.id === socket.id;
  const localRole: PlayerRole | null = isPlayer1
    ? 'player1'
    : isPlayer2
    ? 'player2'
    : null;

  const hasOpponent = Boolean(roomState?.player1 && roomState?.player2);

  // [TEMPORARY DIAGNOSTICS - LATENCY TELEMETRY]
  const [diag, setDiag] = useState<DiagnosticInfo | null>(null);
  const [showDiagLogs, setShowDiagLogs] = useState(false);

  useEffect(() => {
    return subscribeDiagnostics(setDiag);
  }, []);

  const handleToggleSound = () => {
    sounds.unlock();
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  // Copy Invite Link
  const handleCopyInvite = async () => {
    sounds.unlock();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Leave room and return to lobby
  const handleLeaveRoom = useCallback(() => {
    sounds.unlock();
    if (cleanCode && socket.connected) {
      socket.emit('leave-room', { roomCode: cleanCode });
    }
    navigate('/');
  }, [cleanCode, navigate]);

  // Create fresh room if failed
  const handleCreateNewRoom = () => {
    sounds.unlock();
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('create-room', (response) => {
      if (response && response.success && response.roomCode) {
        navigate(`/room/${response.roomCode}`, {
          state: {
            initialRoomState: response.room,
            initialGameState: response.gameState,
          },
        });
      } else {
        navigate('/');
      }
    });
  };

  // Toggle ready status
  const handleToggleReady = () => {
    sounds.unlock();
    if (!localRole || !gameState) return;
    const currentReady =
      localRole === 'player1' ? gameState.player1.ready : gameState.player2.ready;
    socket.emit('player-ready', { ready: !currentReady });
  };

  // Request rematch
  const handleRematch = () => {
    sounds.unlock();
    socket.emit('rematch');
  };

  // 1. Canvas Callback Ref to guarantee canvas initialization & immediate initial draw
  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (canvas) {
      canvas.width = ONLINE_GAME_CONFIG.canvasWidth;
      canvas.height = ONLINE_GAME_CONFIG.canvasHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        rendererRef.current = new OnlinePongRenderer(ctx);
        if (gameStateRef.current) {
          rendererRef.current.render(gameStateRef.current, localRole, hasOpponent, 0, false);
        }
      }
    }
  }, [localRole, hasOpponent]);

  // 2. Directional Intent Input System (Keyboard + Mobile Touch Integration)
  const currentDirectionRef = useRef<InputDirection>(0);
  const lastSentDirectionRef = useRef<InputDirection>(0);

  const emitDirection = useCallback((nextDirection: InputDirection) => {
    currentDirectionRef.current = nextDirection;
    if (nextDirection !== lastSentDirectionRef.current) {
      lastSentDirectionRef.current = nextDirection;
      socket.emit('player-input', { direction: nextDirection });
    }
  }, []);

  // 3. Smooth Animation Frame Loop for 60-144fps rendering with local paddle prediction
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (rendererRef.current && gameStateRef.current) {
        rendererRef.current.render(
          gameStateRef.current,
          localRole,
          hasOpponent,
          currentDirectionRef.current,
          true
        );
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [localRole, hasOpponent]);

  // Keyboard listener
  useEffect(() => {
    if (!localRole || gameState?.status !== 'playing') return;

    const keys = { up: false, down: false };

    const updateAndEmitKeyboardDirection = () => {
      let nextDirection: InputDirection = 0;
      if (keys.up && !keys.down) {
        nextDirection = -1;
      } else if (keys.down && !keys.up) {
        nextDirection = 1;
      }
      emitDirection(nextDirection);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      sounds.unlock();
      let handled = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        keys.up = true;
        handled = true;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        keys.down = true;
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        updateAndEmitKeyboardDirection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let handled = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        keys.up = false;
        handled = true;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        keys.down = false;
        handled = true;
      }

      if (handled) {
        updateAndEmitKeyboardDirection();
      }
    };

    const handleBlur = () => {
      keys.up = false;
      keys.down = false;
      updateAndEmitKeyboardDirection();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      emitDirection(0);
    };
  }, [localRole, gameState?.status, emitDirection]);

  // Touch control helper for on-screen touch D-pad
  const handleTouchPadPress = (direction: InputDirection, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    sounds.unlock();
    if (!localRole || gameState?.status !== 'playing') return;
    setActiveTouchDir(direction);
    emitDirection(direction);
  };

  const handleTouchPadRelease = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setActiveTouchDir(0);
    emitDirection(0);
  };

  // Direct canvas touch interaction
  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    sounds.unlock();
    if (!localRole || gameState?.status !== 'playing' || !canvasRef.current) return;
    e.preventDefault();

    if (e.touches.length === 0) {
      emitDirection(0);
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleY = canvas.height / rect.height;
    const touchY = (touch.clientY - rect.top) * scaleY;

    const currentGameState = gameStateRef.current;
    const playerY =
      localRole === 'player1'
        ? currentGameState?.player1.y ?? 208
        : currentGameState?.player2.y ?? 208;
    const paddleCenter = playerY + ONLINE_GAME_CONFIG.paddleHeight / 2;

    if (touchY < paddleCenter - 18) {
      emitDirection(-1);
    } else if (touchY > paddleCenter + 18) {
      emitDirection(1);
    } else {
      emitDirection(0);
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    emitDirection(0);
  };

  // 4. Socket Room & Authoritative Game Events Lifecycle
  useEffect(() => {
    if (!isValidFormat) return;

    const syncJoin = () => {
      socket.emit('join-room', { roomCode: cleanCode }, (response) => {
        if (response && response.success && response.room) {
          setRoomState(response.room);
          if (response.gameState) {
            setGameState(response.gameState);
          }
          setErrorMessage(null);
          setErrorType(null);
        } else if (response && response.error) {
          setErrorMessage(response.error);
        }
      });
    };

    if (!socket.connected) {
      socket.connect();
    } else {
      syncJoin();
    }

    const onConnect = () => {
      setIsConnected(true);
      syncJoin();
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onRoomState = (state: RoomState) => {
      setRoomState(state);
      setErrorMessage(null);
      setErrorType(null);
    };

    const onGameState = (state: AuthoritativeGameState) => {
      gameStateRef.current = state;

      // 1. Audio feedback triggers
      if (state.status === 'countdown') {
        if (state.countdown !== prevCountdownRef.current) {
          if (state.countdown > 0) {
            sounds.playCountdownTick();
          } else if (state.countdown === 0) {
            sounds.playGameStart();
          }
          prevCountdownRef.current = state.countdown;
        }
      } else {
        prevCountdownRef.current = -1;
      }

      if (
        state.score.player1 > prevP1ScoreRef.current ||
        state.score.player2 > prevP2ScoreRef.current
      ) {
        sounds.playScore();
      }
      prevP1ScoreRef.current = state.score.player1;
      prevP2ScoreRef.current = state.score.player2;

      if (state.status === 'game-over' && prevStatusRef.current !== 'game-over') {
        sounds.playVictory();
      }
      prevStatusRef.current = state.status;

      if (state.status === 'playing') {
        if (prevBallVxRef.current !== 0 && state.ball.velocityX !== 0) {
          if (Math.sign(state.ball.velocityX) !== Math.sign(prevBallVxRef.current)) {
            sounds.playPaddleHit();
          }
        }
        if (prevBallVyRef.current !== 0 && state.ball.velocityY !== 0) {
          if (Math.sign(state.ball.velocityY) !== Math.sign(prevBallVyRef.current)) {
            sounds.playWallBounce();
          }
        }
      }
      prevBallVxRef.current = state.ball.velocityX;
      prevBallVyRef.current = state.ball.velocityY;

      // 2. Optimized selective React state update (avoids re-rendering 60 times/sec during rallies)
      setGameState((prev) => {
        if (
          prev.status !== state.status ||
          prev.countdown !== state.countdown ||
          prev.score.player1 !== state.score.player1 ||
          prev.score.player2 !== state.score.player2 ||
          prev.player1.ready !== state.player1.ready ||
          prev.player2.ready !== state.player2.ready ||
          prev.winner !== state.winner ||
          prev.rematch.player1 !== state.rematch.player1 ||
          prev.rematch.player2 !== state.rematch.player2
        ) {
          return state;
        }
        return prev;
      });
    };

    const onPlayerJoined = ({ player, roomState: updatedState }: { player: PlayerInfo; roomState: RoomState }) => {
      setRoomState(updatedState);
      if (player && player.id !== socket.id && player.role === 'player2') {
        setNotification({
          text: 'Opponent joined the room! Click READY UP to begin.',
          type: 'success',
        });
        setTimeout(() => {
          setNotification((prev) => (prev?.type === 'success' ? null : prev));
        }, 5000);
      }
    };

    const onPlayerLeft = ({ roomState: updatedState }: { playerId: string; roomState: RoomState }) => {
      setRoomState(updatedState);
      const isHostNow = updatedState.player1?.id === socket.id;
      setNotification({
        text: isHostNow
          ? 'Host left the room. You are now the host! Waiting for an opponent to join...'
          : 'Opponent left the room. Waiting for a player to join...',
        type: 'warning',
      });
      setGameState((prev) => ({
        ...prev,
        status: 'waiting',
        countdown: 3,
        winner: null,
        player1: { ...prev.player1, ready: false },
        player2: { ...prev.player2, ready: false },
        rematch: { player1: false, player2: false },
      }));
    };

    const onRoomFull = ({ message }: { message: string }) => {
      setErrorType('FULL');
      setErrorMessage(message || 'Room is already full (maximum 2 players).');
    };

    const onRoomNotFound = ({ message }: { message: string }) => {
      setErrorType('NOT_FOUND');
      setErrorMessage(message || `Room "${cleanCode}" does not exist or has expired.`);
    };

    const onPlayerDisconnected = ({ message }: { message: string }) => {
      setNotification({
        text: message || 'Opponent disconnected. Match reset to lobby.',
        type: 'warning',
      });
      setGameState((prev) => ({
        ...prev,
        status: 'waiting',
        countdown: 3,
        winner: null,
        player1: { ...prev.player1, ready: false },
        player2: { ...prev.player2, ready: false },
        rematch: { player1: false, player2: false },
      }));
    };

    // Proactively notify server when user closes tab or navigates away
    const handleUnload = () => {
      if (cleanCode && socket.connected) {
        socket.emit('leave-room', { roomCode: cleanCode });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', onRoomState);
    socket.on('game-state', onGameState);
    socket.on('player-joined', onPlayerJoined);
    socket.on('player-left', onPlayerLeft);
    socket.on('room-full', onRoomFull);
    socket.on('room-not-found', onRoomNotFound);
    socket.on('player-disconnected', onPlayerDisconnected);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-state', onRoomState);
      socket.off('game-state', onGameState);
      socket.off('player-joined', onPlayerJoined);
      socket.off('player-left', onPlayerLeft);
      socket.off('room-full', onRoomFull);
      socket.off('room-not-found', onRoomNotFound);
      socket.off('player-disconnected', onPlayerDisconnected);
    };
  }, [cleanCode, isValidFormat]);

  // Invalid Room Code Format State
  if (!isValidFormat) {
    return (
      <div className="relative min-h-[calc(100vh-8.5rem)] flex flex-col justify-center items-center px-4 sm:px-6 selection:bg-stone-100 selection:text-stone-950">
        <AmbientPongCanvas />
        <main className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center my-auto py-12">
          <div className="space-y-4 mb-8">
            <span className="font-mono text-xs text-rose-400 uppercase tracking-widest px-3 py-1 bg-rose-950/40 border border-rose-900/60 rounded-full inline-block">
              INVALID ROOM CODE
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-100 font-mono">
              "{roomCode}"
            </h1>
            <p className="text-stone-400 font-mono text-xs max-w-xs mx-auto leading-relaxed">
              Room codes must be exactly 5 alphanumeric characters.
            </p>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/')}
            className="tracking-wider text-xs"
          >
            ← BACK TO LOBBY
          </Button>
        </main>
      </div>
    );
  }

  // Server error state
  if (errorMessage) {
    return (
      <div className="relative min-h-[calc(100vh-8.5rem)] flex flex-col justify-center items-center px-4 sm:px-6 selection:bg-stone-100 selection:text-stone-950">
        <AmbientPongCanvas />
        <main className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center my-auto py-12">
          <div className="space-y-4 mb-8">
            <span className="font-mono text-xs text-stone-400 uppercase tracking-widest px-3 py-1 bg-stone-900 border border-stone-800 rounded-full inline-block">
              {errorType === 'FULL'
                ? 'ROOM FULL'
                : errorType === 'NOT_FOUND'
                ? 'ROOM NOT FOUND'
                : 'ROOM UNAVAILABLE'}
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-100 font-mono">
              {cleanCode}
            </h1>
            <p className="text-stone-400 font-mono text-xs max-w-xs mx-auto leading-relaxed">
              {errorMessage}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/')}
              className="tracking-wider text-xs"
            >
              ← BACK TO LOBBY
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateNewRoom}
              className="tracking-wider text-xs"
            >
              CREATE NEW ROOM
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const isLocalReady =
    localRole === 'player1'
      ? Boolean(gameState.player1.ready)
      : localRole === 'player2'
      ? Boolean(gameState.player2.ready)
      : false;

  const isLocalRematchRequested =
    localRole === 'player1'
      ? Boolean(gameState.rematch.player1)
      : localRole === 'player2'
      ? Boolean(gameState.rematch.player2)
      : false;

  const rematchCount =
    (gameState.rematch.player1 ? 1 : 0) + (gameState.rematch.player2 ? 1 : 0);

  const isPlaying = gameState.status === 'playing' || gameState.status === 'countdown';
  const isGameOver = gameState.status === 'game-over';

  return (
    <div className="min-h-[calc(100vh-8.5rem)] flex flex-col justify-center items-center px-3 sm:px-6 py-4 sm:py-6 selection:bg-stone-100 selection:text-stone-950">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Connection Lost Alert */}
        {!isConnected && (
          <div className="w-full mb-3 px-4 py-2.5 rounded-xl border border-amber-800/60 bg-amber-950/40 text-amber-300 font-mono text-xs flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Connecting to server...</span>
            </div>
            <span className="text-amber-400/80 text-[10px] uppercase font-bold tracking-wider">
              RECONNECTING
            </span>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between mb-3 sm:mb-4 font-mono text-xs text-stone-400">
          <button
            onClick={handleLeaveRoom}
            className="hover:text-stone-200 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 rounded-lg px-2.5 py-1.5 -mx-1 bg-stone-900/60 hover:bg-stone-900 border border-stone-800/60 cursor-pointer text-xs"
          >
            <span>←</span>
            <span>LOBBY</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Sound Toggle Button in Room */}
            <button
              onClick={handleToggleSound}
              aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-stone-900/90 hover:bg-stone-800 border border-stone-800 rounded-xl text-stone-300 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            >
              <span>{isMuted ? '🔇' : '🔊'}</span>
              <span className="text-[10px] uppercase hidden sm:inline">{isMuted ? 'MUTED' : 'SFX'}</span>
            </button>

            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-stone-900/90 border border-stone-800 rounded-xl text-[11px] sm:text-xs">
              <span className="text-stone-500 uppercase text-[10px]">ROOM:</span>
              <span className="font-bold text-stone-100 tracking-wider select-all">{cleanCode}</span>
            </div>

            <button
              onClick={handleCopyInvite}
              className={`px-2.5 sm:px-3 py-1.5 font-mono text-xs rounded-xl transition-all duration-150 cursor-pointer font-medium select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 ${
                copied
                  ? 'bg-emerald-500 text-stone-950 font-bold'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/60'
              }`}
            >
              {copied ? 'COPIED ✓' : 'COPY'}
            </button>
          </div>
        </div>

        {/* Realtime Notification Toast / Banner */}
        {notification && (
          <div
            className={`w-full mb-3 px-4 py-2.5 rounded-xl border flex items-center justify-between font-mono text-xs transition-all ${
              notification.type === 'warning'
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                : notification.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  notification.type === 'warning'
                    ? 'bg-amber-400 animate-pulse'
                    : notification.type === 'success'
                    ? 'bg-emerald-400'
                    : 'bg-stone-400'
                }`}
              />
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-stone-500 hover:text-stone-300 ml-4 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Player Slot Indicators */}
        <div className="w-full grid grid-cols-2 gap-2.5 sm:gap-3 mb-3 sm:mb-4 font-mono text-xs">
          {/* Player 1 (Left) */}
          <div
            className={`p-3 sm:p-3.5 rounded-2xl border transition-colors flex items-center justify-between ${
              localRole === 'player1'
                ? 'bg-stone-900/90 border-stone-700 text-stone-100 shadow-sm'
                : 'bg-stone-950/60 border-stone-800/80 text-stone-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  roomState?.player1 ? 'bg-stone-100' : 'bg-stone-600'
                }`}
              />
              <span className="font-bold truncate text-[11px] sm:text-xs">
                {localRole === 'player1' ? 'You (P1 • Left)' : 'Host (P1 • Left)'}
              </span>
            </div>
            <span
              className={`text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                isGameOver
                  ? gameState.rematch.player1
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-stone-800/80 text-stone-500'
                  : gameState.player1.ready
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-500'
              }`}
            >
              {isGameOver
                ? gameState.rematch.player1
                  ? 'REMATCH ✓'
                  : 'WAITING'
                : gameState.player1.ready
                ? 'READY ✓'
                : 'WAITING'}
            </span>
          </div>

          {/* Player 2 (Right) */}
          <div
            className={`p-3 sm:p-3.5 rounded-2xl border transition-colors flex items-center justify-between ${
              localRole === 'player2'
                ? 'bg-stone-900/90 border-stone-700 text-stone-100 shadow-sm'
                : 'bg-stone-950/60 border-stone-800/80 text-stone-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  roomState?.player2 ? 'bg-stone-100' : 'bg-stone-600'
                }`}
              />
              <span className="font-bold truncate text-[11px] sm:text-xs">
                {localRole === 'player2'
                  ? 'You (P2 • Right)'
                  : hasOpponent
                  ? 'Opponent (P2)'
                  : 'Waiting...'}
              </span>
            </div>
            {hasOpponent ? (
              <span
                className={`text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                  isGameOver
                    ? gameState.rematch.player2
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-stone-800/80 text-stone-500'
                    : gameState.player2.ready
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-stone-800/80 text-stone-500'
                }`}
              >
                {isGameOver
                  ? gameState.rematch.player2
                    ? 'REMATCH ✓'
                    : 'WAITING'
                  : gameState.player2.ready
                  ? 'READY ✓'
                  : 'WAITING'}
              </span>
            ) : (
              <span className="text-stone-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider">
                INVITE
              </span>
            )}
          </div>
        </div>

        {/* Authoritative Canvas Game Viewport (with Touch & Animation Support) */}
        <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-stone-800 bg-stone-950 court-container touch-none">
          <canvas
            ref={setCanvasRef}
            width={ONLINE_GAME_CONFIG.canvasWidth}
            height={ONLINE_GAME_CONFIG.canvasHeight}
            onTouchStart={handleCanvasTouch}
            onTouchMove={handleCanvasTouch}
            onTouchEnd={handleCanvasTouchEnd}
            onTouchCancel={handleCanvasTouchEnd}
            className="block w-full h-auto aspect-[800/500] bg-stone-950 select-none touch-none"
          />
        </div>

        {/* Dedicated Mobile Touch Control D-Pad */}
        {gameState.status === 'playing' && localRole && (
          <div className="w-full mt-4 grid grid-cols-2 gap-3 sm:hidden">
            <button
              onPointerDown={(e) => handleTouchPadPress(-1, e)}
              onPointerUp={handleTouchPadRelease}
              onPointerLeave={handleTouchPadRelease}
              onPointerCancel={handleTouchPadRelease}
              onTouchStart={(e) => handleTouchPadPress(-1, e)}
              onTouchEnd={handleTouchPadRelease}
              className={`py-4 rounded-2xl font-mono text-sm font-bold border transition-all duration-75 flex items-center justify-center gap-2 select-none touch-none cursor-pointer ${
                activeTouchDir === -1
                  ? 'bg-stone-100 text-stone-950 border-stone-100 scale-[0.98]'
                  : 'bg-stone-900/90 text-stone-200 border-stone-800 active:bg-stone-800'
              }`}
            >
              <span>▲</span>
              <span>UP</span>
            </button>

            <button
              onPointerDown={(e) => handleTouchPadPress(1, e)}
              onPointerUp={handleTouchPadRelease}
              onPointerLeave={handleTouchPadRelease}
              onPointerCancel={handleTouchPadRelease}
              onTouchStart={(e) => handleTouchPadPress(1, e)}
              onTouchEnd={handleTouchPadRelease}
              className={`py-4 rounded-2xl font-mono text-sm font-bold border transition-all duration-75 flex items-center justify-center gap-2 select-none touch-none cursor-pointer ${
                activeTouchDir === 1
                  ? 'bg-stone-100 text-stone-950 border-stone-100 scale-[0.98]'
                  : 'bg-stone-900/90 text-stone-200 border-stone-800 active:bg-stone-800'
              }`}
            >
              <span>▼</span>
              <span>DOWN</span>
            </button>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="w-full mt-4 sm:mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
          {/* Controls keycaps hint */}
          <div className="flex items-center gap-2 text-stone-400 text-xs">
            <span className="text-stone-500 hidden sm:inline">Controls:</span>
            <span className="keycap hidden sm:inline-flex">W</span>
            <span className="keycap hidden sm:inline-flex">S</span>
            <span className="text-stone-600 hidden sm:inline">or</span>
            <span className="keycap hidden sm:inline-flex">↑</span>
            <span className="keycap hidden sm:inline-flex">↓</span>
            <span className="sm:hidden text-stone-500 text-[11px]">
              Touch court or use buttons to move
            </span>
          </div>

          {/* Action Button */}
          <div className="w-full sm:w-auto">
            {isGameOver ? (
              <Button
                variant={isLocalRematchRequested ? 'secondary' : 'primary'}
                size="md"
                fullWidth
                onClick={handleRematch}
                className="font-bold tracking-wider shadow-lg py-3.5 sm:py-2.5 text-xs"
              >
                {isLocalRematchRequested
                  ? `REMATCH REQUESTED (${rematchCount}/2) ✓`
                  : 'REQUEST REMATCH'}
              </Button>
            ) : !isPlaying && localRole ? (
              <Button
                variant={isLocalReady ? 'secondary' : 'primary'}
                size="md"
                fullWidth
                onClick={handleToggleReady}
                className="font-bold tracking-wider px-8 py-3.5 sm:py-3 shadow-lg text-xs"
              >
                {isLocalReady ? 'READY ✓ (CLICK TO CANCEL)' : 'READY UP'}
              </Button>
            ) : null}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* [TEMPORARY DIAGNOSTICS - LATENCY & TRANSPORT TELEMETRY]                    */}
        {/* ========================================================================= */}
        {diag && (
          <div className="w-full mt-4 p-3 bg-stone-900/60 border border-stone-800/80 rounded-xl font-mono text-[11px] text-stone-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${diag.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="text-stone-300 font-bold">
                    {diag.connected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </span>
                <span>
                  Transport: <span className="text-amber-400 font-bold uppercase">{diag.transportName}</span>
                </span>
                <span>
                  RTT Latency:{' '}
                  <span className="text-cyan-400 font-bold">
                    {diag.rttLatencyMs !== null ? `${diag.rttLatencyMs}ms` : 'Measuring...'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 text-[10px] truncate max-w-[200px] sm:max-w-none">
                  Target: {diag.backendUrl}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDiagLogs(!showDiagLogs)}
                  className="text-[10px] text-stone-500 hover:text-stone-300 underline cursor-pointer"
                >
                  {showDiagLogs ? 'Hide Logs' : 'Show Logs'}
                </button>
              </div>
            </div>
            {showDiagLogs && (
              <div className="mt-2.5 pt-2 border-t border-stone-800/80 text-[10px] space-y-1 text-stone-500">
                {diag.history.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ========================================================================= */}
      </div>
    </div>
  );
};
