import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pressed?: boolean;
}

export function Card({ pressed = false, className = '', children, ...props }: CardProps) {
  const shadowStyle = pressed ? 'shadow-neu-pressed' : 'shadow-neu-flat';
  
  return (
    <div className={`bg-background rounded-[32px] p-6 ${shadowStyle} border border-foreground/[0.03] ${className}`} {...props}>
      {children}
    </div>
  );
}
