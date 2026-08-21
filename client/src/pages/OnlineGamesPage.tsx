import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';
import { Button } from '../components/ui/Button';
import { JoinRoomSection } from '../components/landing/JoinRoomSection';
import { socket } from '../services/socket';

export const OnlineGamesPage: React.FC = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePongRoom = () => {
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

  const handleJoinPongRoom = (roomCode: string) => {
    setError(null);
    navigate(`/room/${roomCode}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-8.5rem)] flex flex-col justify-center items-center px-6 py-10 selection:bg-stone-100 selection:text-stone-950">
      <AmbientPongCanvas />

      <main className="relative z-10 w-full max-w-xl mx-auto flex flex-col my-auto">
        {/* Navigation & Header */}
        <div className="mb-6 text-center sm:text-left">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-xs text-stone-400 hover:text-stone-100 tracking-wider uppercase transition-colors mb-3"
          >
            <span>←</span>
            <span>BACK TO HOME</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-stone-100 tracking-tight uppercase">
              PLAY ONLINE
            </h1>
            <span className="self-center sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
              PRIVATE ROOMS
            </span>
          </div>
          <p className="text-xs sm:text-sm font-mono text-stone-400 mt-1">
            Create a room, send the code to a friend, and start playing.
          </p>
        </div>

        {/* Cozy Main Online Card */}
        <div className="relative flex flex-col p-6 sm:p-8 rounded-3xl border bg-stone-900/60 border-stone-800 hover:border-stone-700 shadow-2xl shadow-black/50 transition-all">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[11px] font-mono font-bold tracking-widest text-stone-400 uppercase">
              ONLINE PONG
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ONLINE LOBBY
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-100 tracking-tight mb-2">
            Pong with Friends
          </h2>

          <p className="text-xs sm:text-sm font-mono text-stone-400 leading-relaxed mb-6">
            Jump into a private match anywhere in the world. No signups or downloads needed.
          </p>

          {/* Interactive Room Actions */}
          <div className="space-y-4 mb-4">
            {/* Create Room Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCreatePongRoom}
              disabled={isCreating}
              className="py-4 text-xs font-bold tracking-widest uppercase shadow-lg shadow-stone-100/5"
            >
              {isCreating ? 'SETTING UP ROOM...' : 'CREATE PRIVATE ROOM →'}
            </Button>

            {/* Subtle separator */}
            <div className="flex items-center gap-4 text-stone-700 my-2">
              <div className="h-px flex-1 bg-stone-800" />
              <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">
                or join friend
              </span>
              <div className="h-px flex-1 bg-stone-800" />
            </div>

            {/* Join Room Form */}
            <div className="w-full">
              <JoinRoomSection onJoin={handleJoinPongRoom} disabled={isCreating} />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="mt-2 text-center text-xs font-mono text-rose-400 tracking-wider">
              {error}
            </p>
          )}
        </div>

        {/* Footer Switch */}
        <div className="mt-6 text-center text-[11px] font-mono text-stone-500">
          <Link
            to="/local"
            className="text-stone-400 hover:text-stone-200 underline decoration-stone-700 underline-offset-4 transition-colors"
          >
            Sharing a screen together? Switch to Local Play →
          </Link>
        </div>
      </main>
    </div>
  );
};
