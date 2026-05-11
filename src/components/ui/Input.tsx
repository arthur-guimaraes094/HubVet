import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <label className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">{label}</label>}
      <input 
        className={`w-full bg-white rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium placeholder:text-foreground/40 transition-all border border-border appearance-none min-w-0 ${className}`}
        {...props}
      />
    </div>
  );
}
