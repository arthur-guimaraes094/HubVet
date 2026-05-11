"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/infrastructure/database/client';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
}

export function QuickSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Usar useMemo ou inicializar direto para evitar erro no SSR
  // Mas como precisamos do browser, chamamos dentro de useEffect/client context
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      // Busca tutores
      const { data: tutors } = await supabase
        .from('tutors')
        .select('id, name, phone')
        .ilike('name', `%${query}%`)
        .limit(3);

      // Busca pacientes
      const { data: patients } = await supabase
        .from('patients')
        .select('id, name, species, tutors(name)')
        .ilike('name', `%${query}%`)
        .limit(3);

      const combined = [
        ...(tutors || []).map(t => ({ type: 'Tutor', id: t.id, title: t.name, subtitle: t.phone || '' })),
        ...(patients || []).map(p => {
          const tutor = p.tutors as { name: string } | null | { name: string }[];
          const tutorName = Array.isArray(tutor) ? tutor[0]?.name : tutor?.name;
          return { type: 'Paciente', id: p.id, title: p.name, subtitle: `Tutor: ${tutorName || ''} - ${p.species}` };
        })
      ];

      setResults(combined);
      setLoading(false);
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query, supabase]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input 
          label="Busca Rápida (Tutor ou Paciente)" 
          placeholder="Ex: Rex ou João" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && !loading && (
          <button 
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-[24px] w-11 h-11 flex items-center justify-center text-foreground/40 hover:text-foreground active:text-foreground/60 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {loading && <div className="absolute right-5 top-[38px] w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
      </div>
      
      {results.length > 0 && (
        <Card className="absolute top-[105%] mt-2 w-full z-10 !p-2 !shadow-sm border border-border max-h-60 overflow-y-auto">
          {results.map((res) => (
            <Link 
              href={res.type === 'Tutor' ? `/pacientes?tutorId=${res.id}` : `/pacientes/${res.id}`} 
              key={`${res.type}-${res.id}`}
            >
              <div className="p-3 hover:bg-foreground/5 rounded-xl transition-colors cursor-pointer border-b border-foreground/5 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">{res.title}</span>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-bold">{res.type}</span>
                </div>
                <span className="text-sm text-foreground/60">{res.subtitle}</span>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
