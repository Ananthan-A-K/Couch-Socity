import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { JoinRoomSection } from '../components/landing/JoinRoomSection';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';
import { socket } from '../services/socket';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <main className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center my-auto py-12">
        {/* Title & Minimalist Tagline */}
        <div className="space-y-4 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-900/80 border border-stone-800 rounded-full text-[11px] font-mono text-stone-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="tracking-widest">MINIMAL ONLINE PONG</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-stone-100 font-mono uppercase select-none">
            Couch Socity
          </h1>

          <p className="text-stone-400 font-mono text-sm sm:text-base tracking-wide font-normal lowercase max-w-sm mx-auto">
            "just pong. nothing else."
          </p>
        </div>

        {/* Action Group with Generous Whitespace */}
        <div className="w-full flex flex-col items-center gap-7 sm:gap-8">
          {/* Primary Action Button */}
          <div className="w-full max-w-xs">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="py-4 shadow-xl shadow-stone-100/5 tracking-widest text-sm font-bold"
            >
              {isCreating ? 'CREATING ROOM...' : 'CREATE ROOM'}
            </Button>
          </div>

          {/* Minimal Subtle Divider */}
          <div className="w-full max-w-xs flex items-center gap-4 text-stone-700">
            <div className="h-px flex-1 bg-stone-800" />
            <span className="font-mono text-[11px] text-stone-500 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-stone-800" />
          </div>

          {/* Secondary Action (Join) */}
          <div className="w-full flex justify-center">
            <JoinRoomSection onJoin={handleJoinRoom} disabled={isCreating} />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <p className="mt-6 text-xs font-mono text-rose-400 tracking-wider">
            {error}
          </p>
        )}

        {/* Local Practice Link */}
        <div className="mt-12">
          <Link
            to="/game"
            className="font-mono text-xs text-stone-500 hover:text-stone-300 tracking-wider transition-colors inline-flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-stone-900/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400"
          >
            <span>play 2-player local mode on one keyboard</span>
            <span>→</span>
          </Link>
        </div>

        {/* Subtle Specs */}
        <div className="mt-12 sm:mt-16 flex items-center justify-center gap-6 text-[10px] font-mono text-stone-500 tracking-widest uppercase">
          <span>2 PLAYERS</span>
          <span className="text-stone-700">•</span>
          <span>1 LINK</span>
          <span className="text-stone-700">•</span>
          <span>ZERO SETUP</span>
        </div>
      </main>
    </div>
  );
};
