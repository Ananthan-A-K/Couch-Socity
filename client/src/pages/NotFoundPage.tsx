import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';
import { socket } from '../services/socket';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('create-room', (response) => {
      if (response && response.success && response.roomCode) {
        navigate(`/room/${response.roomCode}`, {
          state: { initialRoomState: response.room },
        });
      } else {
        navigate('/');
      }
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center px-6 selection:bg-stone-100 selection:text-stone-950">
      {/* Background ambient canvas animation */}
      <AmbientPongCanvas />

      {/* Main 404 Viewport */}
      <main className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center my-auto py-12">
        <div className="space-y-3 mb-10">
          <span className="font-mono text-xs text-stone-500 uppercase tracking-widest px-3 py-1 bg-stone-900 border border-stone-800 rounded-full inline-block">
            404 • OUT OF BOUNDS
          </span>
          <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tighter text-stone-100 font-mono">
            404
          </h1>
          <p className="text-stone-400 font-mono text-xs sm:text-sm max-w-xs mx-auto leading-relaxed lowercase">
            "there's nothing here. just an empty court."
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs font-mono">
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => navigate('/')}
            className="tracking-wider text-xs font-bold"
          >
            ← BACK TO LOBBY
          </Button>

          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleCreateRoom}
            className="tracking-wider text-xs"
          >
            CREATE ROOM
          </Button>
        </div>
      </main>
    </div>
  );
};
