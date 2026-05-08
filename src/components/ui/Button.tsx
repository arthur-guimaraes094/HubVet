import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success';
}

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  const baseStyles = "relative px-6 py-3 font-black uppercase tracking-widest text-[10px] rounded-full transition-all duration-300 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  
  const variants = {
    // True Neumorphic
    secondary: "bg-background text-foreground shadow-neu-flat hover:shadow-neu-sm active:shadow-neu-pressed border border-foreground/[0.03]",
    // Hybrid Neumorphic (solid color with neumorphic shadow)
    primary: "bg-primary text-white shadow-neu-sm active:shadow-neu-pressed active:bg-primary/90",
    success: "bg-success text-white shadow-neu-sm active:shadow-neu-pressed active:bg-success/90"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
