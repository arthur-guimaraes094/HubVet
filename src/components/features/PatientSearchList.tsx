"use client";

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { translateSpecies } from '@/core/utils/translations';
import { useRouter } from 'next/navigation';
import { deletePatient } from '@/app/pacientes/actions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { EditPatientModal } from './EditPatientModal';

interface Patient {
  id: string;
  name: string;
  species: string;
  weight_kg: number | null;
  breed: string | null;
  color: string | null;
  tutor_id: string;
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPatient, setMenuPatient] = useState<Patient | null>(null);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [lastTriggeredId, setLastTriggeredId] = useState<string | null>(null);
  const [pressingPatientId, setPressingPatientId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, patient: Patient) => {
    // Don't trigger if clicking a button inside
    if ((e.target as HTMLElement).closest('button')) return;

    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setPressingPatientId(patient.id);
    longPressTimer.current = setTimeout(() => {
      setMenuPosition({ x, y });
      setMenuPatient(patient);
      setLastTriggeredId(patient.id);
      setTimeout(() => setLastTriggeredId(null), 150);
      setPressingPatientId(null);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 500);
  };

  const handleEndPress = () => {
    setPressingPatientId(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCloseMenu = () => {
    setIsMenuClosing(true);
    setTimeout(() => {
      setMenuPatient(null);
      setMenuPosition(null);
      setIsMenuClosing(false);
    }, 200);
  };
  
  const isLastPatient = patientToDelete 
    ? initialPatients.filter(p => p.tutor_id === patientToDelete.tutor_id).length === 1
    : false;
  
  const { success, error } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    if (!patientToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await deletePatient(patientToDelete.id);
      if (result.success) {
        success('Paciente excluído com sucesso!');
        setPatientToDelete(null);
        router.refresh();
      } else {
        error(result.error || 'Erro ao excluir paciente');
      }
    } catch {
      error('Erro ao excluir paciente');
    } finally {
      setIsDeleting(false);
    }
  };

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
            className="w-full bg-background border-none rounded-2xl pl-14 pr-12 py-4 shadow-inner border border-border bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium placeholder:text-foreground/30 transition-all text-base"
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

        <div className="flex bg-background shadow-inner border border-border bg-gray-50/50 p-1 rounded-full border border-foreground/5 shrink-0">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 px-5 rounded-full transition-all duration-300 flex items-center gap-2 ${viewMode === 'list' ? 'bg-primary text-white shadow-sm border border-border' : 'text-foreground/40 hover:text-foreground'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Lista</span>
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 px-5 rounded-full transition-all duration-300 flex items-center gap-2 ${viewMode === 'grid' ? 'bg-primary text-white shadow-sm border border-border' : 'text-foreground/40 hover:text-foreground'}`}
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
            <Link 
              key={patient.id} 
              href={`/pacientes/${patient.id}`} 
              className="group block"
              style={{ WebkitTouchCallout: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={(e) => handleStartPress(e, patient)}
              onMouseUp={handleEndPress}
              onMouseLeave={handleEndPress}
              onTouchStart={(e) => handleStartPress(e, patient)}
              onTouchEnd={handleEndPress}
            >
              <Card 
                style={{ transform: pressingPatientId === patient.id ? 'scale(0.96)' : 'scale(1)' }}
                className={`relative flex flex-col h-full group-hover:shadow-sm border border-border group-active:shadow-inner border border-border bg-gray-50/50 transition-all duration-500 rounded-3xl overflow-hidden hover:border-primary/10 select-none ${pressingPatientId === patient.id ? 'brightness-95' : ''} ${lastTriggeredId === patient.id ? 'animate-haptic' : ''} ${viewMode === 'list' ? 'p-8 gap-4' : 'p-4 gap-2 text-center'}`}
              >
                
                {/* Header Section */}
                <div className={`flex ${viewMode === 'list' ? 'justify-between items-start' : 'flex-col items-center'} gap-3`}>
                  
                  {/* Icon */}
                  <div className={`${viewMode === 'list' ? 'text-4xl order-2 pr-4' : 'text-6xl order-1 mb-4'} transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1`}>
                    {patient.species === 'Canine' ? '🐶' : patient.species === 'Feline' ? '🐱' : '🐾'}
                  </div>

                  {/* Info */}
                  <div className={`flex flex-col min-w-0 ${viewMode === 'list' ? 'order-1' : 'order-2 w-full'}`}>
                    <h2 className={`${viewMode === 'list' ? 'text-3xl' : 'text-base sm:text-lg text-center'} font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}>
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
                <div className={`mt-auto flex flex-col bg-foreground/[0.02] rounded-2xl shadow-inner border border-border bg-gray-50/50 border border-foreground/[0.03] ${viewMode === 'list' ? 'p-4' : 'p-2'}`}>
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

      {/* Confirmation Modal */}
      <Modal 
        isOpen={!!patientToDelete} 
        onClose={() => !isDeleting && setPatientToDelete(null)}
        title="Confirmar Exclusão?"
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-6xl animate-bounce">
            ⚠️
          </div>
          
          <div className="text-center space-y-4">
            <p className="text-foreground/60 font-medium">
              Você está prestes a remover o paciente <span className="text-foreground font-black italic">&quot;{patientToDelete?.name}&quot;</span>.
            </p>
            
            {isLastPatient && (
              <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl">
                <p className="text-amber-700 text-sm font-black leading-tight">
                  Atenção: Este é o único pet de {patientToDelete?.tutors?.name}. 
                  Ao excluí-lo, o cadastro do tutor também será removido.
                </p>
              </div>
            )}

            <p className="text-foreground/40 text-sm font-bold">
              Esta ação é permanente e excluirá todo o histórico clínico associado.
            </p>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full bg-error text-white font-black py-4 rounded-2xl shadow-lg shadow-error/20 hover:bg-error/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  EXCLUINDO...
                </>
              ) : (
                'SIM, EXCLUIR PACIENTE'
              )}
            </button>
            <button
              onClick={() => setPatientToDelete(null)}
              disabled={isDeleting}
              className="w-full bg-foreground/5 text-foreground/60 font-black py-4 rounded-2xl hover:bg-foreground/10 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              NÃO, MANTER PACIENTE
            </button>
          </div>
        </div>
      </Modal>

      {/* iOS Style Context Menu Overlay */}
      {menuPatient && menuPosition && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop Blur */}
          <div 
            className={`absolute inset-0 bg-black/5 backdrop-blur-[1px] ${isMenuClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={handleCloseMenu}
          />
          
          {/* Menu Content */}
          <div 
            style={{ 
              top: Math.min(menuPosition.y, typeof window !== 'undefined' ? window.innerHeight - 150 : menuPosition.y),
              left: Math.min(menuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 220 : menuPosition.x)
            }}
            className={`absolute w-full max-w-[200px] bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/20 overflow-hidden border border-white/40 ${isMenuClosing ? 'animate-ios-pop-out' : 'animate-ios-pop'}`}
          >
            <div className="flex flex-col divide-y divide-foreground/10">
              <button
                onClick={() => {
                  setPatientToEdit(menuPatient);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-black/5 active:bg-black/10 transition-colors text-foreground"
              >
                <svg className="w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="font-bold text-sm">Editar Paciente</span>
              </button>
              <button
                onClick={() => {
                  setPatientToDelete(menuPatient);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-error/5 active:bg-error/10 transition-colors text-error"
              >
                <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-bold text-sm">Apagar Paciente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {patientToEdit && (
        <EditPatientModal
          key={patientToEdit.id}
          patient={patientToEdit}
          isOpen={!!patientToEdit}
          onClose={() => setPatientToEdit(null)}
        />
      )}
    </div>
  );
}
