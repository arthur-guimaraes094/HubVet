"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  maxWidth?: string;
  role?: 'dialog' | 'alertdialog';
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => {
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      return el.getClientRects().length > 0;
    }
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  maxWidth = 'max-w-lg',
  role = 'dialog',
}: ModalProps) {
  const titleId = useId();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const closedInternallyRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restoreFocus = useCallback(() => {
    const prev = previousFocusRef.current;
    previousFocusRef.current = null;
    if (prev && prev.isConnected) {
      prev.focus();
    }
  }, []);

  useEffect(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (isOpen) {
      closedInternallyRef.current = false;
      if (!wasOpenRef.current) {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        wasOpenRef.current = true;
      }
      document.body.style.overflow = 'hidden';

      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          setShouldRender(true);
          setIsExiting(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (closedInternallyRef.current) {
      closedInternallyRef.current = false;
      wasOpenRef.current = false;
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250;
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          setIsExiting(true);
        }
      });
      exitTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
        document.body.style.overflow = '';
        restoreFocus();
      }, delay);

      return () => {
        cancelled = true;
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
      };
    }
  }, [isOpen, restoreFocus]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        document.body.style.overflow = '';
        restoreFocus();
      }
    };
  }, [restoreFocus]);

  useEffect(() => {
    if (!isOpen || !shouldRender || isExiting) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (panel.contains(document.activeElement)) return;

    const focusables = getFocusableElements(panel);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      panel.focus();
    }
  }, [isOpen, shouldRender, isExiting]);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250;
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      closedInternallyRef.current = true;
      wasOpenRef.current = false;
      setShouldRender(false);
      setIsExiting(false);
      document.body.style.overflow = '';
      restoreFocus();
      onClose();
    }, delay);
  }, [isExiting, onClose, restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [isOpen, handleClose]);

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key === 'Tab' && panelRef.current) {
      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!active || !panelRef.current.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (active === first || active === panelRef.current) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleDialogKeyDown}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm ${
        isExiting ? 'animate-fade-out' : 'animate-fade-in'
      }`}
    >
      <div className="absolute inset-0" aria-hidden="true" onClick={handleClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} outline-none ${
          isExiting ? 'animate-slide-out' : 'animate-slide-in'
        }`}
      >
        <Card className="w-full shadow-xl border border-border overflow-hidden p-5 sm:p-8">
          <div className="flex justify-between items-center mb-6 gap-3">
            <h2 id={titleId} className="text-xl font-extrabold text-primary">
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fechar"
                className="w-11 h-11 shrink-0 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-error hover:bg-error/10 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <svg
                  className="w-5 h-5"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {children}
        </Card>
      </div>
    </div>
  );
}
