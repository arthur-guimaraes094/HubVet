"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      const existingTimer = timersRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      counterRef.current += 1;
      const id = `toast-${Date.now()}-${counterRef.current}`;
      const duration = type === 'error' ? 6500 : 4000;

      setToasts((prev) => [...prev, { id, message, type }]);
      scheduleDismiss(id, duration);
    },
    [scheduleDismiss]
  );

  const toast = useCallback((message: string, type?: ToastType) => addToast(message, type), [addToast]);
  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

  const politeToasts = toasts.filter((t) => t.type !== 'error');
  const assertiveToasts = toasts.filter((t) => t.type === 'error');

  const renderToast = (t: Toast) => {
    const duration = t.type === 'error' ? 6500 : 4000;
    const toneClass =
      t.type === 'success'
        ? 'bg-success border-success text-success-foreground'
        : t.type === 'error'
        ? 'bg-error border-error text-error-foreground'
        : 'bg-primary border-primary text-primary-foreground';

    return (
      <div
        key={t.id}
        role={t.type === 'error' ? 'alert' : 'status'}
        onMouseEnter={() => {
          const timer = timersRef.current.get(t.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(t.id);
          }
        }}
        onMouseLeave={() => scheduleDismiss(t.id, duration)}
        onFocus={() => {
          const timer = timersRef.current.get(t.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(t.id);
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            scheduleDismiss(t.id, duration);
          }
        }}
        className={`pointer-events-auto w-full flex items-center justify-between gap-3 pl-5 pr-2.5 py-3 rounded-2xl shadow-2xl animate-slideUp border-2 ${toneClass}`}
      >
        <span className="text-sm font-black tracking-tight flex-1">{t.message}</span>
        <button
          type="button"
          onClick={() => dismissToast(t.id)}
          aria-label="Fechar notificação"
          className="min-w-[36px] min-h-[36px] shrink-0 rounded-xl flex items-center justify-center hover:bg-black/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg
            className="w-4 h-4"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}

      {/* Toast Live Regions (permanently mounted for screen readers) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 pointer-events-none w-full max-w-[92vw] sm:max-w-md items-center">
        <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2.5 w-full items-center">
          {politeToasts.map(renderToast)}
        </div>
        <div aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2.5 w-full items-center">
          {assertiveToasts.map(renderToast)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
}
