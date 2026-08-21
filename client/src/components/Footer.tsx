import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full z-20 py-6 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-stone-500 border-t border-stone-900/60">
      <div className="flex items-center gap-2">
        <span className="text-stone-400 font-bold">COUCH SOCIETY</span>
        <span>•</span>
        <span className="text-stone-500">PLAY TOGETHER. STAY TOGETHER.</span>
      </div>
      <div className="flex items-center gap-4 text-stone-500">
        <span>FIRST TO 10 WINS</span>
        <span>•</span>
        <span>SIT BACK & ENJOY</span>
      </div>
    </footer>
  );
};
