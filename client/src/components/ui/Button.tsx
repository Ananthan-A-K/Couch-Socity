import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-mono tracking-wider uppercase select-none cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 rounded-xl';

  const variants = {
    primary:
      'bg-stone-100 text-stone-950 font-bold border border-stone-100 hover:bg-white hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] active:bg-stone-200',
    secondary:
      'bg-stone-900 text-stone-200 font-medium border border-stone-800 hover:border-stone-600 hover:bg-stone-800/80 hover:text-white',
    outline:
      'bg-transparent text-stone-300 font-medium border border-stone-800 hover:border-stone-600 hover:text-stone-100 hover:bg-stone-900/40',
    ghost:
      'bg-transparent text-stone-400 font-medium hover:text-stone-200 hover:bg-stone-900/60',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-5 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-8 py-3.5 gap-2.5 font-bold tracking-widest',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
