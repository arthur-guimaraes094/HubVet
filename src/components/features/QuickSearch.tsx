"use client";

import React, { useState, useEffect, useId, useRef } from 'react';
import { createClient } from '@/infrastructure/database/client';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
}

function getResultHref(res: SearchResult): string {
  return res.type === 'Tutor'
    ? `/pacientes?tutorId=${res.id}`
    : `/pacientes/${res.id}`;
}

export function QuickSearch() {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  const [supabase] = useState(() => createClient());

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

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setLoading(true);
      try {
        const [{ data: tutors }, { data: patients }] = await Promise.all([
          supabase
            .from('tutors')
            .select('id, name, phone')
            .ilike('name', `%${trimmed}%`)
            .limit(3),
          supabase
            .from('patients')
            .select('id, name, species, tutors(name)')
            .ilike('name', `%${trimmed}%`)
            .limit(3),
        ]);

        if (cancelled) return;

        const combined: SearchResult[] = [
          ...(tutors || []).map((t) => ({
            type: 'Tutor',
            id: t.id,
            title: t.name,
            subtitle: t.phone || '',
          })),
          ...(patients || []).map((p) => {
            const tutor = p.tutors as { name: string } | null | { name: string }[];
            const tutorName = Array.isArray(tutor) ? tutor[0]?.name : tutor?.name;
            return {
              type: 'Paciente',
              id: p.id,
              title: p.name,
              subtitle: `Tutor: ${tutorName || ''} - ${p.species}`,
            };
          }),
        ];

        setResults(combined);
        setHasSearched(true);
        setIsOpen(combined.length > 0);
        setActiveIndex(-1);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [query, supabase]);

  const trimmedQuery = query.trim();
  const showListbox = isOpen && results.length > 0 && trimmedQuery.length >= 2;
  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < results.length ? activeIndex : -1;

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setHasSearched(false);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (results.length === 0) return;
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(results.length - 1);
      } else {
        setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      }
      return;
    }

    if (e.key === 'Enter' && showListbox && safeActiveIndex >= 0) {
      e.preventDefault();
      const chosen = results[safeActiveIndex];
      setIsOpen(false);
      setActiveIndex(-1);
      router.push(getResultHref(chosen));
      return;
    }

    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
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
    <div ref={containerRef} onBlur={handleBlur} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          label="Busca Rápida (Tutor ou Paciente)"
          placeholder="Ex: Rex ou João"
          value={query}
          role="combobox"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showListbox && safeActiveIndex >= 0
              ? `${listboxId}-option-${safeActiveIndex}`
              : undefined
          }
          autoComplete="off"
          className="pr-12"
          onFocus={() => {
            if (results.length > 0 && trimmedQuery.length >= 2) {
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setActiveIndex(-1);
            if (next.trim().length < 2) {
              setResults([]);
              setIsOpen(false);
              setHasSearched(false);
              setLoading(false);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {query && !loading && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar busca"
            className="absolute right-1.5 top-[25px] w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground active:scale-95 transition-all"
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
        {loading && (
          <div
            aria-hidden="true"
            className="absolute right-4 top-[38px] w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"
          />
        )}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? 'Buscando tutores e pacientes...'
          : hasSearched && trimmedQuery.length >= 2
          ? results.length === 0
            ? 'Nenhum resultado encontrado.'
            : `${results.length} ${
                results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'
              }.`
          : ''}
      </div>

      <Card
        id={listboxId}
        role="listbox"
        aria-label="Resultados da busca rápida"
        hidden={!showListbox}
        className={
          showListbox
            ? 'absolute top-[105%] mt-2 w-full z-20 p-2! shadow-lg! border border-border-strong max-h-60 overflow-y-auto'
            : 'hidden'
        }
      >
        {results.map((res, idx) => {
          const isActive = idx === safeActiveIndex;
          return (
            <Link
              href={getResultHref(res)}
              key={`${res.type}-${res.id}`}
              id={`${listboxId}-option-${idx}`}
              role="option"
              tabIndex={-1}
              aria-selected={isActive}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setIsOpen(false);
                setActiveIndex(-1);
              }}
              className={`block p-3 rounded-xl transition-colors cursor-pointer border-b border-foreground/5 last:border-0 ${
                isActive ? 'bg-primary/15' : 'hover:bg-foreground/5'
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-bold text-foreground">{res.title}</span>
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-bold shrink-0">
                  {res.type}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{res.subtitle}</span>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
