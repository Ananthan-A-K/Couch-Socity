import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AmbientPongCanvas } from '../components/landing/AmbientPongCanvas';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[calc(100vh-8.5rem)] flex flex-col justify-center items-center px-6 selection:bg-stone-100 selection:text-stone-950">
      {/* Calm background ambient pong animation */}
      <AmbientPongCanvas />

      {/* Main Landing Area */}
      <main className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center my-auto py-10 sm:py-12">
        {/* Title & Cozy Tagline */}
        <div className="space-y-3 mb-10 sm:mb-12">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-stone-100 font-mono uppercase select-none">
            Couch Society
          </h1>

          <p className="text-stone-400 font-mono text-sm sm:text-base tracking-wide font-normal max-w-sm mx-auto">
            "Play Together. Stay Together."
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="w-full flex flex-col gap-4 max-w-xs">
          {/* LOCAL PLAY BUTTON */}
          <div className="w-full flex flex-col items-center gap-1.5">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/local')}
              className="py-4 shadow-xl shadow-stone-100/5 tracking-widest text-sm font-bold uppercase"
            >
              LOCAL PLAY →
            </Button>
            <span className="font-mono text-[11px] text-stone-500">
              Same screen • Shared keyboard or touch
            </span>
          </div>

          {/* Subtle Divider */}
          <div className="w-full flex items-center gap-4 text-stone-700 my-2">
            <div className="h-px flex-1 bg-stone-800" />
            <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-stone-800" />
          </div>

          {/* ONLINE PLAY BUTTON */}
          <div className="w-full flex flex-col items-center gap-1.5">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => navigate('/online')}
              className="py-4 tracking-widest text-sm font-bold uppercase flex items-center justify-center gap-2 border-stone-800 hover:border-stone-600 bg-stone-900/60"
            >
              <span>ONLINE PLAY</span>
              <span>→</span>
            </Button>
            <span className="font-mono text-[11px] text-stone-500">
              Private room codes • Play with friends
            </span>
          </div>
        </div>

        {/* Cozy Footer Notes */}
        <div className="mt-12 sm:mt-14 flex items-center justify-center gap-6 text-[10px] font-mono text-stone-500 tracking-widest uppercase">
          <span>ZERO SETUP</span>
          <span className="text-stone-700">•</span>
          <span>NO ACCOUNTS</span>
          <span className="text-stone-700">•</span>
          <span>JUST PLAY</span>
        </div>
      </main>
    </div>
  );
};


