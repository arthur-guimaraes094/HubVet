"use client";

import React, { useCallback, useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

export interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number } | null;
  ariaLabel: string;
  items: ContextMenuItem[];
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const MENU_WIDTH = 220;
const VIEWPORT_MARGIN = 12;

export function ContextMenu({
  isOpen,
  onClose,
  position,
  ariaLabel,
  items,
  triggerRef,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const closeAndRestoreFocus = useCallback(() => {
    triggerRef?.current?.focus();
    onClose();
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen || !position || items.length === 0) return;

    const firstItem = itemRefs.current[0];
    if (firstItem) {
      firstItem.focus();
    } else {
      menuRef.current?.focus();
    }
  }, [isOpen, position, items.length]);

  useEffect(() => {
    if (!isOpen || !position || !menuRef.current) return;

    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    const clampedX = Math.max(VIEWPORT_MARGIN, Math.min(position.x, maxLeft));
    const clampedY = Math.max(VIEWPORT_MARGIN, Math.min(position.y, maxTop));

    el.style.left = `${clampedX}px`;
    el.style.top = `${clampedY}px`;
  }, [isOpen, position, items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeAndRestoreFocus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, closeAndRestoreFocus]);

  if (!isOpen || !position || items.length === 0) return null;

  const estimatedHeight = Math.max(items.length * 48 + 8, 104);
  const initialLeft =
    typeof window !== 'undefined'
      ? Math.max(
          VIEWPORT_MARGIN,
          Math.min(position.x, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN)
        )
      : position.x;
  const initialTop =
    typeof window !== 'undefined'
      ? Math.max(
          VIEWPORT_MARGIN,
          Math.min(position.y, window.innerHeight - estimatedHeight - VIEWPORT_MARGIN)
        )
      : position.y;

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const count = items.length;
    if (count === 0) return;

    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % count;
      itemRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex <= 0 ? count - 1 : currentIndex - 1;
      itemRefs.current[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemRefs.current[count - 1]?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      closeAndRestoreFocus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeAndRestoreFocus();
    }
  };

  const handleSelect = (item: ContextMenuItem) => {
    triggerRef?.current?.focus();
    onClose();
    item.onSelect();
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/10 backdrop-blur-[1px] animate-fade-in"
        onClick={closeAndRestoreFocus}
        onContextMenu={(e) => {
          e.preventDefault();
          closeAndRestoreFocus();
        }}
      />

      <div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleMenuKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: initialTop,
          left: initialLeft,
        }}
        className="absolute w-[220px] max-w-[calc(100vw-24px)] bg-card/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/20 overflow-hidden border border-border-strong animate-ios-pop outline-none"
      >
        <div className="flex flex-col divide-y divide-border">
          {items.map((item, index) => {
            const isDanger = item.tone === 'danger';
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={index === 0 ? 0 : -1}
                onClick={() => handleSelect(item)}
                className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-left text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                  isDanger
                    ? 'text-error hover:bg-error/10 focus-visible:bg-error/10'
                    : 'text-foreground hover:bg-foreground/5 focus-visible:bg-foreground/5'
                }`}
              >
                {item.icon && (
                  <span className="shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
