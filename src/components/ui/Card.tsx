import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pressed?: boolean;
}

export function Card({ pressed = false, className = '', children, ...props }: CardProps) {
  const shadowStyle = pressed ? 'shadow-neu-pressed' : 'shadow-neu-flat';
  
  return (
    <div className={`bg-background rounded-3xl p-6 ${shadowStyle} ${className}`} {...props}>
      {children}
    </div>
  );
}
