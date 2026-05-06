import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <label className="text-sm font-bold text-foreground/80 pl-2">{label}</label>}
      <input 
        className={`w-full bg-background rounded-xl px-4 py-3 shadow-neu-pressed outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-foreground/40 transition-all ${className}`}
        {...props}
      />
    </div>
  );
}
