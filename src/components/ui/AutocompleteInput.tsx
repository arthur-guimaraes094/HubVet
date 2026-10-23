"use client";

import React, { useState, useId, useRef, useEffect } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return options.slice(0, 25);
    return options
      .filter((opt) => opt.toLowerCase().includes(term))
      .slice(0, 25);
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col gap-2 w-full relative">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider pl-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={`w-full bg-card rounded-xl px-4 py-3 pr-9 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium placeholder:text-foreground/40 transition-colors border border-border appearance-none min-w-0 ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Abrir sugestões"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-card border border-border rounded-2xl shadow-xl max-h-48 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-1">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                  opt.toLowerCase() === value.toLowerCase()
                    ? 'bg-primary/15 text-primary font-bold'
                    : 'hover:bg-primary/10 hover:text-primary text-foreground'
                }`}
              >
                <span className="truncate">{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
