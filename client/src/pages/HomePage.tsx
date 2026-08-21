import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { JoinRoomSection } from '../components/landing/JoinRoomSection';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';
import { socket } from '../services/socket';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlayLocal = () => {
    navigate('/game');
  };

  const handleCreateRoom = () => {
    setError(null);
    setIsCreating(true);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('create-room', (response) => {
      setIsCreating(false);
      if (response && response.success && response.roomCode) {
        navigate(`/room/${response.roomCode}`, {
          state: {
            initialRoomState: response.room,
            initialGameState: response.gameState,
          },
        });
      } else {
        setError(response?.error || 'Failed to create room on server');
      }
    });
  };

  const handleJoinRoom = (roomCode: string) => {
    setError(null);
    navigate(`/room/${roomCode}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-8.5rem)] flex flex-col justify-center items-center px-6 selection:bg-stone-100 selection:text-stone-950">
      {/* Calm background ambient pong animation */}
      <AmbientPongCanvas />

      {/* Main Landing Area */}
      <main className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center my-auto py-10 sm:py-12">
        {/* Title & Minimalist Tagline */}
        <div className="space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-900/80 border border-stone-800 rounded-full text-[11px] font-mono text-stone-400 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="tracking-widest">MINIMAL RETRO PONG</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-stone-100 font-mono uppercase select-none">
            Couch Society
          </h1>

          <p className="text-stone-400 font-mono text-sm sm:text-base tracking-wide font-normal max-w-sm mx-auto">
            "Play Together. Stay Together."
          </p>
        </div>

        {/* MAIN FEATURE: Local 2-Player Mode */}
        <div className="w-full flex flex-col items-center gap-4">
          <div className="w-full max-w-xs">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handlePlayLocal}
              className="py-4 shadow-xl shadow-stone-100/5 tracking-widest text-sm font-bold"
            >
              PLAY LOCAL MODE
            </Button>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-stone-500">
            <span>P1: W/S</span>
            <span className="text-stone-700">•</span>
            <span>P2: ↑/↓</span>
            <span className="text-stone-700">•</span>
            <span>Touch Supported</span>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="w-full max-w-xs flex items-center gap-4 text-stone-700 my-8">
          <div className="h-px flex-1 bg-stone-800" />
          <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">or</span>
          <div className="h-px flex-1 bg-stone-800" />
        </div>

        {/* SECONDARY FEATURE: Online Multiplayer (Beta) */}
        <div className="w-full max-w-sm flex flex-col items-center p-5 rounded-2xl bg-stone-900/40 border border-stone-800/80">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-mono text-xs font-bold text-stone-300 tracking-wider uppercase">
              ONLINE MULTIPLAYER
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-widest">
              BETA
            </span>
          </div>

          <div className="w-full flex flex-col gap-3">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="py-3 text-xs font-bold tracking-wider"
            >
              {isCreating ? 'CREATING ROOM...' : 'CREATE ONLINE ROOM (BETA)'}
            </Button>

            <div className="w-full">
              <JoinRoomSection onJoin={handleJoinRoom} disabled={isCreating} />
            </div>
          </div>

          {/* Error Notification */}
          {error && (
            <p className="mt-3 text-xs font-mono text-rose-400 tracking-wider">
              {error}
            </p>
          )}
        </div>

        {/* Subtle Specs */}
        <div className="mt-10 sm:mt-12 flex items-center justify-center gap-6 text-[10px] font-mono text-stone-500 tracking-widest uppercase">
          <span>LOCAL 2-PLAYER</span>
          <span className="text-stone-700">•</span>
          <span>ONLINE (BETA)</span>
          <span className="text-stone-700">•</span>
          <span>ZERO SETUP</span>
        </div>
      </main>
    </div>
  );
};

