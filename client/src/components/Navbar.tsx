import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { socket } from '../services/socket';
import { sounds } from '../services/sound';

export const Navbar: React.FC = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleToggleSound = () => {
    sounds.unlock();
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="w-full z-20 py-6 px-6 sm:px-12 flex items-center justify-between border-b border-stone-900/60 backdrop-blur-xs">
      <Link
        to="/"
        className="group flex items-center gap-2.5 font-mono text-xs text-stone-300 hover:text-stone-100 tracking-widest uppercase transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 rounded px-1.5 py-0.5 -mx-1.5"
      >
        <span className="w-1.5 h-1.5 rounded-xs bg-stone-100 group-hover:scale-125 transition-transform" />
        <span className="font-bold tracking-widest">COUCH SOCIETY</span>
      </Link>

      <div className="flex items-center gap-3">
        {/* Sound Toggle Button */}
        <button
          onClick={handleToggleSound}
          aria-label={isMuted ? 'Unmute game sounds' : 'Mute game sounds'}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-900/80 hover:bg-stone-800 border border-stone-800 rounded-full font-mono text-[10px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400"
        >
          <span>{isMuted ? '🔇' : '🔊'}</span>
          <span className="uppercase tracking-wider hidden sm:inline">
            {isMuted ? 'MUTED' : 'SFX'}
          </span>
        </button>

        {/* Server status pill */}
        <div className="flex items-center gap-2 px-3 py-1 bg-stone-900/80 border border-stone-800/80 rounded-full font-mono text-[11px]">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${
              isConnected
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                : 'bg-amber-400 animate-pulse'
            }`}
            aria-hidden="true"
          />
          <span className="text-stone-400 text-[10px] tracking-wider uppercase font-medium">
            {isConnected ? 'ONLINE' : 'CONNECTING'}
          </span>
        </div>
      </div>
    </header>
  );
};
