"use client";

import React, { useEffect } from 'react';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  maxWidth?: string;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  showCloseButton = true,
  maxWidth = 'max-w-lg'
}: ModalProps) {
  const [shouldRender, setShouldRender] = React.useState(isOpen);
  const [isExiting, setIsExiting] = React.useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
      document.body.style.overflow = 'hidden';
    } else {
      if (shouldRender) {
        setIsExiting(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsExiting(false);
          document.body.style.overflow = 'unset';
        }, 250);
        return () => clearTimeout(timer);
      }
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, shouldRender]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}`}>
      <div className="absolute inset-0" onClick={handleClose}></div>
      <Card className={`relative w-full ${maxWidth} shadow-xl border border-border overflow-hidden p-8 ${isExiting ? 'animate-slide-out' : 'animate-slide-in'}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-extrabold text-primary">{title}</h3>
          {showCloseButton && (
            <button 
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-foreground/40 hover:text-error hover:bg-error/10 transition-colors active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </Card>
    </div>
  );
}
