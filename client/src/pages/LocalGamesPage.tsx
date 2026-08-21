import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';
import { Button } from '../components/ui/Button';

export const LocalGamesPage: React.FC = () => {
  const navigate = useNavigate();

  const handleStartLocalMatch = () => {
    navigate('/game');
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
              LOCAL PLAY
            </h1>
            <span className="self-center sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
              1 SCREEN · 2 PLAYERS
            </span>
          </div>
          <p className="text-xs sm:text-sm font-mono text-stone-400 mt-1">
            Grab a seat and play together on a single screen.
          </p>
        </div>

        {/* Cozy Main Game Card */}
        <div className="relative flex flex-col p-6 sm:p-8 rounded-3xl border bg-stone-900/60 border-stone-800 hover:border-stone-700 shadow-2xl shadow-black/50 transition-all">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[11px] font-mono font-bold tracking-widest text-stone-400 uppercase">
              COZY RETRO ARCADE
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              READY TO PLAY
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-100 tracking-tight mb-2">
            Classic Pong
          </h2>

          <p className="text-xs sm:text-sm font-mono text-stone-400 leading-relaxed mb-6">
            A calm, minimal paddle rally for two players. First to 10 points wins. Take a side on the keyboard or tap the on-screen touch buttons.
          </p>

          {/* Cozy Controls Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-stone-950/60 border border-stone-900 mb-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                PLAYER 1 (LEFT)
              </span>
              <span className="text-xs font-mono font-bold text-stone-300">
                W (Up) / S (Down)
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                PLAYER 2 (RIGHT)
              </span>
              <span className="text-xs font-mono font-bold text-stone-300">
                ↑ (Up) / ↓ (Down)
              </span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            variant="primary"
            size="lg"
            onClick={handleStartLocalMatch}
            className="w-full py-4 text-xs font-bold tracking-widest uppercase shadow-lg shadow-stone-100/5"
          >
            START LOCAL MATCH →
          </Button>
        </div>

        {/* Footer Switch */}
        <div className="mt-6 text-center text-[11px] font-mono text-stone-500">
          <Link
            to="/online"
            className="text-stone-400 hover:text-stone-200 underline decoration-stone-700 underline-offset-4 transition-colors"
          >
            Playing with someone far away? Switch to Online Play →
          </Link>
        </div>
      </main>
    </div>
  );
};
