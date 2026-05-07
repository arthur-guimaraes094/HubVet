"use client";

import React, { useEffect } from 'react';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>
      <Card className="relative w-full max-w-lg shadow-neu-flat border border-white/20 animate-slide-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-extrabold text-primary">{title}</h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-background shadow-neu-sm flex items-center justify-center text-foreground/40 hover:text-error transition-colors active:shadow-neu-pressed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
