import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success';
}

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  const baseStyles = "relative min-h-[44px] flex items-center justify-center px-6 py-3 font-bold uppercase tracking-widest text-xs rounded-xl transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  
  const variants = {
    secondary: "bg-white text-foreground shadow-sm hover:bg-gray-50 border border-border",
    primary: "bg-primary text-white shadow-sm hover:bg-primary/90",
    success: "bg-success text-white shadow-sm hover:bg-success/90"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
