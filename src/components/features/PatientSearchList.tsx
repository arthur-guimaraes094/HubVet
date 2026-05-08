"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { translateSpecies } from '@/core/utils/translations';

interface Patient {
  id: string;
  name: string;
  species: string;
  weight_kg: number | null;
  breed: string | null;
  color: string | null;
  tutors: {
    name: string;
    phone: string | null;
  } | null;
}

interface PatientSearchListProps {
  initialPatients: Patient[];
}

export function PatientSearchList({ initialPatients }: PatientSearchListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filteredPatients = initialPatients.filter(patient => {
    const term = searchTerm.toLowerCase();
    const patientMatch = patient.name.toLowerCase().includes(term);
    const speciesMatch = patient.species.toLowerCase().includes(term);
    const tutorMatch = patient.tutors?.name.toLowerCase().includes(term);
    return patientMatch || speciesMatch || tutorMatch;
  });

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Search Bar and View Toggle */}
      <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto w-full">
        <div className="relative group flex-1 w-full">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-foreground/20 group-focus-within:text-primary/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text"
            placeholder="Pesquisar por nome do pet, espécie ou tutor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border-none rounded-[28px] pl-14 pr-12 py-4 shadow-neu-pressed focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium placeholder:text-foreground/30 transition-all text-base"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground/60 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex bg-background shadow-neu-pressed p-1 rounded-full border border-foreground/5 shrink-0">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 px-5 rounded-full transition-all duration-300 flex items-center gap-2 ${viewMode === 'list' ? 'bg-primary text-white shadow-neu-sm' : 'text-foreground/40 hover:text-foreground'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Lista</span>
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 px-5 rounded-full transition-all duration-300 flex items-center gap-2 ${viewMode === 'grid' ? 'bg-primary text-white shadow-neu-sm' : 'text-foreground/40 hover:text-foreground'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Grade</span>
          </button>
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <Card className="text-center py-20 flex flex-col items-center gap-4 bg-background/40 max-w-2xl mx-auto w-full">
          <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center text-4xl opacity-30">🔍</div>
          <p className="text-foreground/40 font-bold text-lg italic">Nenhum paciente encontrado para &quot;{searchTerm}&quot;</p>
        </Card>
      ) : (
        <div className={`grid gap-6 w-full ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
          {filteredPatients.map((patient) => (
            <Link key={patient.id} href={`/pacientes/${patient.id}`} className="group block">
              <Card className={`flex flex-col h-full group-hover:shadow-neu-sm group-active:shadow-neu-pressed transition-all duration-500 rounded-[32px] overflow-hidden border border-transparent hover:border-primary/10 ${viewMode === 'list' ? 'p-8 gap-4' : 'p-4 gap-2 text-center'}`}>
                
                {/* Header Section */}
                <div className={`flex ${viewMode === 'list' ? 'justify-between items-start' : 'flex-col items-center'} gap-3`}>
                  
                  {/* Icon */}
                  <div className={`${viewMode === 'list' ? 'text-4xl order-2 pr-4' : 'text-6xl order-1 mb-4'} transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1`}>
                    {patient.species === 'Canine' ? '🐶' : patient.species === 'Feline' ? '🐱' : '🐾'}
                  </div>

                  {/* Info */}
                  <div className={`flex flex-col min-w-0 ${viewMode === 'list' ? 'order-1' : 'order-2 w-full'}`}>
                    <h2 className={`${viewMode === 'list' ? 'text-3xl' : 'text-base sm:text-lg'} font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}>
                      {patient.name}
                    </h2>
                    
                    {viewMode === 'list' && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[9px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-widest">
                          {translateSpecies(patient.species)}
                        </span>
                        {patient.breed && (
                          <span className="text-[9px] font-black bg-foreground/5 text-foreground/60 px-2.5 py-1 rounded-full uppercase tracking-widest truncate max-w-[120px]">
                            {patient.breed}
                          </span>
                        )}
                        {patient.weight_kg && (
                          <span className="text-[9px] font-black bg-success/10 text-success px-2.5 py-1 rounded-full uppercase tracking-widest">
                            {patient.weight_kg} kg
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Tutor Section */}
                <div className={`mt-auto flex flex-col bg-foreground/[0.02] rounded-2xl shadow-neu-pressed border border-foreground/[0.03] ${viewMode === 'list' ? 'p-4' : 'p-2'}`}>
                  {viewMode === 'list' && (
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3 h-3 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-[8px] font-black text-foreground/30 uppercase tracking-[0.2em]">Tutor</span>
                    </div>
                  )}
                  <div className={`flex flex-col ${viewMode === 'list' ? 'pl-5' : 'items-center'}`}>
                    <span className={`${viewMode === 'list' ? 'text-sm' : 'text-[10px]'} font-bold text-foreground truncate w-full`}>
                      {patient.tutors?.name || 'Sem tutor'}
                    </span>
                    {patient.tutors?.phone && viewMode === 'list' && (
                      <span className="text-xs font-medium text-foreground/50 mt-0.5">{patient.tutors.phone}</span>
                    )}
                  </div>
                </div>

              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
