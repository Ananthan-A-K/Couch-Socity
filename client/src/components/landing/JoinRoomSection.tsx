import React, { useState } from 'react';
import { sanitizeRoomCodeInput, ROOM_CODE_LENGTH } from '../../utils/roomCode';

export interface JoinRoomSectionProps {
  onJoin?: (code: string) => void;
  disabled?: boolean;
}

export const JoinRoomSection: React.FC<JoinRoomSectionProps> = ({ onJoin, disabled = false }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeRoomCodeInput(code);

    if (!cleanCode) {
      setError('Enter a 5-character room code');
      return;
    }

    if (cleanCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }

    setError(null);
    onJoin?.(cleanCode);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = sanitizeRoomCodeInput(e.target.value);
    setCode(val);
    if (error) setError(null);
  };

  const isReadyToJoin = code.length === ROOM_CODE_LENGTH;

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full relative flex items-center bg-stone-900/90 border border-stone-800 focus-within:border-stone-500 rounded-2xl p-1.5 transition-all shadow-inner"
      >
        <input
          value={code}
          onChange={handleInputChange}
          placeholder="ROOM CODE"
          maxLength={ROOM_CODE_LENGTH}
          aria-label="5-character Room Code"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-stone-100 placeholder:text-stone-600 font-mono text-sm tracking-widest uppercase px-4 py-2.5 focus:outline-none"
        />

        <button
          type="submit"
          disabled={disabled || !isReadyToJoin}
          className={`shrink-0 px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
            isReadyToJoin
              ? 'bg-stone-100 text-stone-950 hover:bg-white active:scale-95 shadow-md shadow-white/5'
              : 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-60'
          }`}
        >
          JOIN →
        </button>
      </form>

      {error && (
        <span className="mt-2.5 text-xs font-mono text-rose-400 tracking-wider transition-all animate-fadeIn">
          {error}
        </span>
      )}
    </div>
  );
};
