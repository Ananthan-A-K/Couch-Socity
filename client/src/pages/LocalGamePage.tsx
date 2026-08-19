import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PongEngine } from '../game/engine';
import { sounds } from '../services/sound';
import type { GameState } from '../game/types';
import { DEFAULT_CONFIG } from '../game/config';

export const LocalGamePage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PongEngine | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const [p1Touch, setP1Touch] = useState<-1 | 0 | 1>(0);
  const [p2Touch, setP2Touch] = useState<-1 | 0 | 1>(0);

  const prevP1Score = useRef(0);
  const prevP2Score = useRef(0);
  const prevStatus = useRef<string>('idle');
  const prevVx = useRef(0);
  const prevVy = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new PongEngine(DEFAULT_CONFIG);
    engineRef.current = engine;

    engine.onStateChange = (state) => {
      setGameState({ ...state });

      // 1. Audio on score
      if (state.player1.score > prevP1Score.current || state.player2.score > prevP2Score.current) {
        sounds.playScore();
      }
      prevP1Score.current = state.player1.score;
      prevP2Score.current = state.player2.score;

      // 2. Audio on game over & start
      if (state.status === 'gameover' && prevStatus.current !== 'gameover') {
        sounds.playVictory();
      } else if (state.status === 'playing' && prevStatus.current === 'serving') {
        sounds.playGameStart();
      }
      prevStatus.current = state.status;

      // 3. Audio on ball bounces
      if (state.status === 'playing') {
        if (prevVx.current !== 0 && state.ball.vx !== 0) {
          if (Math.sign(state.ball.vx) !== Math.sign(prevVx.current)) {
            sounds.playPaddleHit();
          }
        }
        if (prevVy.current !== 0 && state.ball.vy !== 0) {
          if (Math.sign(state.ball.vy) !== Math.sign(prevVy.current)) {
            sounds.playWallBounce();
          }
        }
      }
      prevVx.current = state.ball.vx;
      prevVy.current = state.ball.vy;
    };

    engine.init(canvas);
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleToggleSound = () => {
    sounds.unlock();
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const handleServe = () => {
    sounds.unlock();
    engineRef.current?.serve();
  };

  const handleReset = () => {
    sounds.unlock();
    engineRef.current?.reset();
  };

  // Direct canvas touch handling for 2-player local mobile play
  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    sounds.unlock();
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let p1Up = false;
    let p1Down = false;
    let p2Up = false;
    let p2Down = false;

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const touchX = (touch.clientX - rect.left) * scaleX;
      const touchY = (touch.clientY - rect.top) * scaleY;

      if (touchX < canvas.width / 2) {
        // Player 1 (Left Court)
        if (touchY < canvas.height / 2) {
          p1Up = true;
        } else {
          p1Down = true;
        }
      } else {
        // Player 2 (Right Court)
        if (touchY < canvas.height / 2) {
          p2Up = true;
        } else {
          p2Down = true;
        }
      }
    }

    engine.getInput().setInputState({ p1Up, p1Down, p2Up, p2Down });
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    e.preventDefault();
    if (e.touches.length === 0) {
      engine.getInput().setInputState({
        p1Up: false,
        p1Down: false,
        p2Up: false,
        p2Down: false,
      });
    }
  };

  // Touch pad controls helper for on-screen D-pads
  const setP1Dir = (dir: -1 | 0 | 1, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    sounds.unlock();
    setP1Touch(dir);
    engineRef.current?.getInput().setInputState({
      p1Up: dir === -1,
      p1Down: dir === 1,
    });
  };

  const setP2Dir = (dir: -1 | 0 | 1, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    sounds.unlock();
    setP2Touch(dir);
    engineRef.current?.getInput().setInputState({
      p2Up: dir === -1,
      p2Down: dir === 1,
    });
  };

  const isIdle = gameState?.status === 'idle';
  const isGameOver = gameState?.status === 'gameover';

  return (
    <div className="min-h-[calc(100vh-8.5rem)] flex flex-col items-center justify-center px-3 sm:px-6 py-4 sm:py-6 selection:bg-stone-100 selection:text-stone-950">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between mb-3 sm:mb-4 font-mono text-xs text-stone-400">
          <button
            onClick={() => {
              sounds.unlock();
              navigate('/');
            }}
            className="hover:text-stone-200 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 rounded-lg px-2.5 py-1.5 -mx-1 bg-stone-900/60 hover:bg-stone-900 border border-stone-800/60 cursor-pointer text-xs"
          >
            <span>←</span>
            <span>LOBBY</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
              className="p-1.5 sm:px-2.5 sm:py-1 bg-stone-900/90 hover:bg-stone-800 border border-stone-800 rounded-xl text-stone-300 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            >
              <span>{isMuted ? '🔇' : '🔊'}</span>
              <span className="text-[10px] uppercase hidden sm:inline">{isMuted ? 'MUTED' : 'SFX'}</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1 bg-stone-900/80 border border-stone-800 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-stone-300 font-bold tracking-wider uppercase text-[10px]">LOCAL 2-PLAYER</span>
            </div>
          </div>
        </div>

        {/* Canvas Frame with Touch Interaction */}
        <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-stone-800 bg-stone-950 court-container touch-none">
          <canvas
            ref={canvasRef}
            width={DEFAULT_CONFIG.canvasWidth}
            height={DEFAULT_CONFIG.canvasHeight}
            onTouchStart={handleCanvasTouch}
            onTouchMove={handleCanvasTouch}
            onTouchEnd={handleCanvasTouchEnd}
            onTouchCancel={handleCanvasTouchEnd}
            className="block w-full h-auto aspect-[800/500] bg-stone-950 cursor-crosshair select-none touch-none"
          />
        </div>

        {/* Dedicated Mobile On-Screen Controls for Local 2-Player */}
        <div className="w-full mt-4 grid grid-cols-2 gap-3 sm:hidden font-mono text-xs">
          {/* Player 1 Mobile Controls */}
          <div className="flex flex-col gap-2 p-2.5 bg-stone-900/60 border border-stone-800 rounded-2xl">
            <span className="text-stone-400 font-bold text-center text-[10px] uppercase">P1 (LEFT)</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onPointerDown={(e) => setP1Dir(-1, e)}
                onPointerUp={(e) => setP1Dir(0, e)}
                onPointerLeave={(e) => setP1Dir(0, e)}
                onPointerCancel={(e) => setP1Dir(0, e)}
                onTouchStart={(e) => setP1Dir(-1, e)}
                onTouchEnd={(e) => setP1Dir(0, e)}
                className={`py-3.5 rounded-xl border text-xs font-bold transition-all touch-none select-none ${
                  p1Touch === -1 ? 'bg-stone-100 text-stone-950 border-stone-100' : 'bg-stone-900 border-stone-800 text-stone-200'
                }`}
              >
                ▲ UP
              </button>
              <button
                onPointerDown={(e) => setP1Dir(1, e)}
                onPointerUp={(e) => setP1Dir(0, e)}
                onPointerLeave={(e) => setP1Dir(0, e)}
                onPointerCancel={(e) => setP1Dir(0, e)}
                onTouchStart={(e) => setP1Dir(1, e)}
                onTouchEnd={(e) => setP1Dir(0, e)}
                className={`py-3.5 rounded-xl border text-xs font-bold transition-all touch-none select-none ${
                  p1Touch === 1 ? 'bg-stone-100 text-stone-950 border-stone-100' : 'bg-stone-900 border-stone-800 text-stone-200'
                }`}
              >
                ▼ DOWN
              </button>
            </div>
          </div>

          {/* Player 2 Mobile Controls */}
          <div className="flex flex-col gap-2 p-2.5 bg-stone-900/60 border border-stone-800 rounded-2xl">
            <span className="text-stone-400 font-bold text-center text-[10px] uppercase">P2 (RIGHT)</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onPointerDown={(e) => setP2Dir(-1, e)}
                onPointerUp={(e) => setP2Dir(0, e)}
                onPointerLeave={(e) => setP2Dir(0, e)}
                onPointerCancel={(e) => setP2Dir(0, e)}
                onTouchStart={(e) => setP2Dir(-1, e)}
                onTouchEnd={(e) => setP2Dir(0, e)}
                className={`py-3.5 rounded-xl border text-xs font-bold transition-all touch-none select-none ${
                  p2Touch === -1 ? 'bg-stone-100 text-stone-950 border-stone-100' : 'bg-stone-900 border-stone-800 text-stone-200'
                }`}
              >
                ▲ UP
              </button>
              <button
                onPointerDown={(e) => setP2Dir(1, e)}
                onPointerUp={(e) => setP2Dir(0, e)}
                onPointerLeave={(e) => setP2Dir(0, e)}
                onPointerCancel={(e) => setP2Dir(0, e)}
                onTouchStart={(e) => setP2Dir(1, e)}
                onTouchEnd={(e) => setP2Dir(0, e)}
                className={`py-3.5 rounded-xl border text-xs font-bold transition-all touch-none select-none ${
                  p2Touch === 1 ? 'bg-stone-100 text-stone-950 border-stone-100' : 'bg-stone-900 border-stone-800 text-stone-200'
                }`}
              >
                ▼ DOWN
              </button>
            </div>
          </div>
        </div>

        {/* Control & Actions Bar */}
        <div className="w-full mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center font-mono">
          {/* Player 1 Controls (Left) */}
          <div className="p-3.5 rounded-2xl bg-stone-900/70 border border-stone-800/80 hidden sm:flex items-center justify-between text-xs">
            <div>
              <span className="text-stone-300 font-bold block uppercase tracking-wider">
                PLAYER 1 (LEFT)
              </span>
              <span className="text-[11px] text-stone-500">Score: {gameState?.player1.score ?? 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="keycap">W</span>
              <span className="keycap">S</span>
            </div>
          </div>

          {/* Center Action Button */}
          <div className="flex justify-center gap-2 w-full">
            {isIdle || isGameOver ? (
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={handleServe}
                className="font-bold tracking-widest px-8 shadow-lg py-3.5 sm:py-2.5 text-xs"
              >
                {isGameOver ? 'PLAY AGAIN' : 'SERVE (SPACE)'}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={handleReset}
                className="text-xs font-bold py-3.5 sm:py-2.5"
              >
                RESET (R)
              </Button>
            )}
          </div>

          {/* Player 2 Controls (Right) */}
          <div className="p-3.5 rounded-2xl bg-stone-900/70 border border-stone-800/80 hidden sm:flex items-center justify-between text-xs">
            <div>
              <span className="text-stone-300 font-bold block uppercase tracking-wider">
                PLAYER 2 (RIGHT)
              </span>
              <span className="text-[11px] text-stone-500">Score: {gameState?.player2.score ?? 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="keycap">↑</span>
              <span className="keycap">↓</span>
            </div>
          </div>
        </div>

        {/* Instructions Footer */}
        <div className="mt-4 sm:mt-5 flex items-center justify-center gap-4 sm:gap-6 font-mono text-[10px] sm:text-[11px] text-stone-500">
          <span>First to 10 wins</span>
          <span className="text-stone-700">•</span>
          <span>Touch court / D-Pad</span>
          <span className="text-stone-700">•</span>
          <span>Space to pause</span>
        </div>
      </div>
    </div>
  );
};
