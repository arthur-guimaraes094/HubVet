import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pressed?: boolean;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`bg-card rounded-2xl p-6 shadow-sm border border-border ${className}`} {...props}>
      {children}
    </div>
  );
}
