import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label 
          htmlFor={inputId} 
          className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider pl-1"
        >
          {label}
        </label>
      )}
      <input 
        id={inputId}
        className={`w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium placeholder:text-foreground/40 transition-colors border border-border appearance-none min-w-0 ${className}`}
        {...props}
      />
    </div>
  );
}
