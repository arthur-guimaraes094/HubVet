"use client";

import React, { useState, useId, useRef, useEffect, useMemo } from 'react';

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AutocompleteInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  className = '',
}: AutocompleteInputProps) {
  const inputId = useId();
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return options.slice(0, 25);
    return options
      .filter((opt) => opt.toLowerCase().includes(term))
      .slice(0, 25);
  }, [value, options]);

  const showListbox = isOpen && filtered.length > 0 && !disabled;
  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollOptionIntoView = (index: number) => {
    const el = optionRefs.current[index];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length === 0) return;
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
        scrollOptionIntoView(0);
      } else {
        const nextIndex = (safeActiveIndex + 1) % filtered.length;
        setActiveIndex(nextIndex);
        scrollOptionIntoView(nextIndex);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      if (!isOpen) {
        const lastIndex = filtered.length - 1;
        setIsOpen(true);
        setActiveIndex(lastIndex);
        scrollOptionIntoView(lastIndex);
      } else {
        const prevIndex =
          safeActiveIndex <= 0 ? filtered.length - 1 : safeActiveIndex - 1;
        setActiveIndex(prevIndex);
        scrollOptionIntoView(prevIndex);
      }
      return;
    }

    if (e.key === 'Enter' && showListbox && safeActiveIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[safeActiveIndex]);
      return;
    }

    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Tab') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      className="flex flex-col gap-2 w-full relative"
    >
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showListbox && safeActiveIndex >= 0
              ? `${listboxId}-option-${safeActiveIndex}`
              : undefined
          }
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={`w-full bg-card rounded-xl px-4 py-3 pr-12 shadow-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground font-medium placeholder:text-muted-foreground transition-colors border border-border-strong appearance-none min-w-0 ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Abrir sugestões"
          aria-expanded={showListbox}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <div
          id={listboxId}
          role="listbox"
          aria-label={label || placeholder || 'Sugestões'}
          hidden={!showListbox}
          className={
            showListbox
              ? 'absolute top-full left-0 right-0 z-30 mt-1.5 bg-card border border-border-strong rounded-2xl shadow-xl max-h-48 overflow-y-auto p-1.5'
              : 'hidden'
          }
        >
          {filtered.map((opt, index) => {
            const isActive = index === safeActiveIndex;
            const isExactMatch = opt.toLowerCase() === value.trim().toLowerCase();
            const isSelected = safeActiveIndex >= 0 ? isActive : isExactMatch;

            return (
              <button
                key={opt}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                  isActive || isExactMatch
                    ? 'bg-primary/15 text-primary font-bold'
                    : 'hover:bg-primary/10 hover:text-primary text-foreground'
                }`}
              >
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
