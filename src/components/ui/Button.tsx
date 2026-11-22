import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'info' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function buttonClasses(variant: ButtonVariant = 'secondary', className = ''): string {
  const baseStyles =
    'relative min-h-[44px] inline-flex items-center justify-center px-6 py-3 font-bold uppercase tracking-widest text-xs rounded-xl transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants: Record<ButtonVariant, string> = {
    secondary: 'bg-card text-foreground shadow-sm hover:bg-foreground/5 border border-border-strong',
    primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
    success: 'bg-success text-success-foreground shadow-sm hover:bg-success/90',
    info: 'bg-blue-700 text-white shadow-sm hover:bg-blue-800 border border-blue-700',
    danger: 'bg-error text-error-foreground shadow-sm hover:bg-error/90',
  };

  return `${baseStyles} ${variants[variant] || variants.secondary} ${className}`.trim();
}

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, className)} {...props}>
      {children}
    </button>
  );
}
