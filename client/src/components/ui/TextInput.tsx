import React, { forwardRef } from 'react';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className = '', error = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`bg-stone-900/90 text-stone-100 placeholder-stone-600 font-mono text-sm tracking-wider px-4 py-2.5 rounded-lg border transition-all duration-150 focus:outline-none focus-visible:outline-none ${
          error
            ? 'border-rose-500/80 focus:border-rose-400 focus:ring-1 focus:ring-rose-400'
            : 'border-stone-800 hover:border-stone-700 focus:border-stone-400 focus:ring-1 focus:ring-stone-400'
        } ${className}`}
        {...props}
      />
    );
  }
);

TextInput.displayName = 'TextInput';
