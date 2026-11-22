"use client";

import React, { useState, useRef, useId, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { translateSpecies } from '@/core/utils/translations';
import { formatPatientAge, formatFertilityStatus } from '@/core/utils/age';
import { useRouter } from 'next/navigation';
import { deletePatient } from '@/app/pacientes/actions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { EditPatientModal } from './EditPatientModal';

interface Patient {
  id: string;
  name: string;
  species: string;
  weight_kg: number | null;
  breed: string | null;
  color: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  is_birth_date_estimated?: boolean | null;
  fertility_status?: string | null;
  fertility_notes?: string | null;
  clinical_observations?: string | null;
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
  const searchId = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [deleteTutorAlso, setDeleteTutorAlso] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPatient, setMenuPatient] = useState<Patient | null>(null);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastTriggeredId, setLastTriggeredId] = useState<string | null>(null);
  const [pressingPatientId, setPressingPatientId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMenuTriggerRef = useRef<HTMLElement | null>(null);
  const triggerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const triggerMenu = useCallback((x: number, y: number, patient: Patient) => {
    setMenuPosition({ x, y });
    setMenuPatient(patient);
    setLastTriggeredId(patient.id);
    setTimeout(() => setLastTriggeredId(null), 150);
    setPressingPatientId(null);
    if (window.navigator.vibrate) window.navigator.vibrate(50);
  }, []);

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, patient: Patient) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setPressingPatientId(patient.id);
    longPressTimer.current = setTimeout(() => {
      lastMenuTriggerRef.current = triggerButtonRefs.current[patient.id] ?? null;
      triggerMenu(x, y, patient);
    }, 500);
  };

  const handleEndPress = () => {
    setPressingPatientId(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCloseMenu = useCallback(() => {
    setMenuPatient(null);
    setMenuPosition(null);
  }, []);

  const isLastPatient = patientToDelete
    ? initialPatients.filter((p) => p.tutor_id === patientToDelete.tutor_id).length === 1
    : false;

  const { success, error } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    if (!patientToDelete) return;

    const shouldDeleteTutor = isLastPatient && deleteTutorAlso;
    setIsDeleting(true);
    try {
      const result = await deletePatient(patientToDelete.id, {
        deleteOrphanTutor: shouldDeleteTutor,
      });
      if (result.success) {
        success(
          shouldDeleteTutor
            ? 'Paciente e tutor excluídos com sucesso!'
            : 'Paciente excluído com sucesso!'
        );
        setPatientToDelete(null);
        setDeleteTutorAlso(false);
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

  const filteredPatients = initialPatients.filter((patient) => {
    const term = searchTerm.toLowerCase();
    const patientMatch = patient.name.toLowerCase().includes(term);
    const speciesMatch = patient.species.toLowerCase().includes(term);
    const breedMatch = patient.breed?.toLowerCase().includes(term);
    const tutorMatch = patient.tutors?.name.toLowerCase().includes(term);
    return patientMatch || speciesMatch || breedMatch || tutorMatch;
  });

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Search Bar and View Toggle */}
      <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto w-full">
        <div className="relative group flex-1 w-full">
          <label htmlFor={searchId} className="sr-only">
            Pesquisar por nome do pet, raça, espécie ou tutor
          </label>
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-5 flex items-center pointer-events-none"
          >
            <svg
              className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            id={searchId}
            type="text"
            placeholder="Pesquisar por nome do pet, raça, espécie ou tutor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background rounded-2xl pl-14 pr-14 py-4 shadow-inner border border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary text-foreground font-medium placeholder:text-muted-foreground transition-all text-base"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Modo de visualização"
          className="flex bg-foreground/5 border border-border p-1 rounded-2xl shrink-0 gap-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'list'}
            aria-label="Visualização em lista"
            onClick={() => setViewMode('list')}
            className={`min-h-[44px] py-2 px-4 rounded-xl transition-[transform,background-color,color] duration-150 active:scale-[0.97] flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/75 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Lista</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'grid'}
            aria-label="Visualização em grade"
            onClick={() => setViewMode('grid')}
            className={`min-h-[44px] py-2 px-4 rounded-xl transition-[transform,background-color,color] duration-150 active:scale-[0.97] flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/75 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            <span>Grade</span>
          </button>
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <Card className="text-center py-20 flex flex-col items-center gap-4 bg-background/40 max-w-2xl mx-auto w-full">
          <div aria-hidden="true" className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center text-4xl">
            🔍
          </div>
          <p className="text-muted-foreground font-bold text-lg italic">
            Nenhum paciente encontrado para &quot;{searchTerm}&quot;
          </p>
        </Card>
      ) : (
        <div
          className={`grid gap-6 w-full ${
            viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-4xl mx-auto'
          }`}
        >
          {filteredPatients.map((patient) => {
            const ageText = formatPatientAge(patient.birth_date);
            const fertilityText = formatFertilityStatus(patient.fertility_status);

            return (
              <Card
                key={patient.id}
                style={{
                  transform: pressingPatientId === patient.id ? 'scale(0.96)' : 'scale(1)',
                  WebkitTouchCallout: 'none',
                }}
                onContextMenu={(e) => e.preventDefault()}
                onMouseDown={(e) => handleStartPress(e, patient)}
                onMouseUp={handleEndPress}
                onMouseLeave={handleEndPress}
                onTouchStart={(e) => handleStartPress(e, patient)}
                onTouchEnd={handleEndPress}
                className={`group relative flex flex-col h-full hover:shadow-sm border border-border active:shadow-inner bg-foreground/5 transition-all duration-500 rounded-3xl overflow-hidden hover:border-primary/20 select-none has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-offset-2 ${
                  pressingPatientId === patient.id ? 'brightness-95' : ''
                } ${lastTriggeredId === patient.id ? 'animate-haptic' : ''} ${
                  viewMode === 'list' ? 'p-5 sm:p-8 gap-4' : 'p-4 gap-2 text-center'
                }`}
              >
                <button
                  ref={(el) => {
                    triggerButtonRefs.current[patient.id] = el;
                  }}
                  type="button"
                  aria-label={`Mais ações para ${patient.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuPatient?.id === patient.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    lastMenuTriggerRef.current = e.currentTarget;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX || rect.right - 180;
                    const y = e.clientY || rect.bottom + 4;
                    triggerMenu(x, y, patient);
                  }}
                  className="absolute top-2 right-2 sm:top-3 sm:right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary z-20"
                >
                  <MoreVertical aria-hidden="true" className="w-5 h-5" />
                </button>

                {/* Header Section */}
                <div
                  className={`flex ${
                    viewMode === 'list' ? 'justify-between items-start pr-12' : 'flex-col items-center pt-6'
                  } gap-3`}
                >
                  {/* Photo or Emoji Icon */}
                  {patient.photo_url ? (
                    <div
                      className={`relative rounded-full overflow-hidden border-2 border-primary/20 shadow-sm shrink-0 transition-all duration-500 group-hover:scale-105 ${
                        viewMode === 'list'
                          ? 'w-16 h-16 order-2 mr-2'
                          : 'w-20 h-20 order-1 mb-2'
                      }`}
                    >
                      <Image
                        src={patient.photo_url}
                        alt={patient.name}
                        fill
                        sizes="80px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className={`${
                        viewMode === 'list' ? 'text-4xl order-2 pr-4' : 'text-6xl order-1 mb-2'
                      } transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1`}
                    >
                      {patient.species === 'Canine'
                        ? '🐶'
                        : patient.species === 'Feline'
                        ? '🐱'
                        : '🐾'}
                    </div>
                  )}

                  {/* Info */}
                  <div
                    className={`flex flex-col min-w-0 ${
                      viewMode === 'list' ? 'order-1' : 'order-2 w-full'
                    }`}
                  >
                    <h2
                      className={`${
                        viewMode === 'list' ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg text-center'
                      } font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}
                    >
                      <Link
                        href={`/pacientes/${patient.id}`}
                        onClick={(e) => {
                          if (lastTriggeredId === patient.id) e.preventDefault();
                        }}
                        className="after:absolute after:inset-0 after:z-10 after:rounded-3xl focus:outline-none"
                      >
                        {patient.name}
                      </Link>
                    </h2>

                    <div
                      className={`flex flex-wrap items-center gap-1.5 mt-2 ${
                        viewMode === 'grid' ? 'justify-center' : ''
                      }`}
                    >
                      <span className="text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full tracking-wide">
                        {translateSpecies(patient.species)}
                      </span>
                      {patient.breed && (
                        <span className="text-[11px] font-bold bg-foreground/5 text-foreground/80 px-2.5 py-0.5 rounded-full tracking-wide truncate max-w-[120px]">
                          {patient.breed}
                        </span>
                      )}
                      {patient.weight_kg && (
                        <span className="text-[11px] font-bold bg-success/10 text-success px-2.5 py-0.5 rounded-full tracking-wide">
                          {patient.weight_kg} kg
                        </span>
                      )}
                      {ageText && (
                        <span className="text-[11px] font-bold bg-foreground/5 text-foreground/80 px-2.5 py-0.5 rounded-full tracking-wide">
                          <span aria-hidden="true">🎂 </span>
                          {ageText}
                        </span>
                      )}
                      {fertilityText && viewMode === 'list' && (
                        <span className="text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full tracking-wide">
                          {fertilityText}
                        </span>
                      )}
                      {patient.clinical_observations && (
                        <span className="text-[11px] font-bold bg-error/15 text-error px-2.5 py-0.5 rounded-full tracking-wide">
                          <span aria-hidden="true">⚠️ </span>Obs/Alergia
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tutor Section */}
                <div
                  className={`mt-auto flex flex-col bg-foreground/5 rounded-2xl shadow-inner border border-border ${
                    viewMode === 'list' ? 'p-4' : 'p-2'
                  }`}
                >
                  {viewMode === 'list' && (
                    <div className="flex items-center gap-2 mb-1">
                      <svg
                        aria-hidden="true"
                        className="w-3 h-3 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Tutor
                      </span>
                    </div>
                  )}
                  <div className={`flex flex-col ${viewMode === 'list' ? 'pl-5' : 'items-center'}`}>
                    <span
                      className={`${
                        viewMode === 'list' ? 'text-sm' : 'text-xs'
                      } font-bold text-foreground truncate w-full`}
                    >
                      {patient.tutors?.name || 'Sem tutor'}
                    </span>
                    {patient.tutors?.phone && viewMode === 'list' && (
                      <span className="text-xs font-medium text-muted-foreground mt-0.5">
                        {patient.tutors.phone}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!patientToDelete}
        onClose={() => {
          if (!isDeleting) {
            setPatientToDelete(null);
            setDeleteTutorAlso(false);
          }
        }}
        title="Confirmar Exclusão?"
        role="alertdialog"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-6xl" aria-hidden="true">⚠️</div>

          <div className="text-center space-y-4">
            <p className="text-foreground/80 font-medium">
              Você está prestes a remover o paciente{' '}
              <span className="text-foreground font-black italic">
                &quot;{patientToDelete?.name}&quot;
              </span>
              .
            </p>

            {isLastPatient && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/50 p-4 rounded-2xl text-left flex flex-col gap-3">
                <p className="text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-black leading-tight">
                  Este é o único pet cadastrado de {patientToDelete?.tutors?.name}.
                </p>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-amber-900 dark:text-amber-100">
                  <input
                    type="checkbox"
                    checked={deleteTutorAlso}
                    onChange={(e) => setDeleteTutorAlso(e.target.checked)}
                    disabled={isDeleting}
                    className="mt-0.5 rounded border-amber-400 text-error focus:ring-error w-4 h-4 shrink-0"
                  />
                  <span>
                    Excluir também o cadastro do tutor ({patientToDelete?.tutors?.name})
                  </span>
                </label>
              </div>
            )}

            <p className="text-muted-foreground text-sm font-bold">
              Esta ação é permanente e excluirá todo o histórico clínico associado.
            </p>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-4! rounded-2xl shadow-lg shadow-error/20"
            >
              {isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR PACIENTE'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPatientToDelete(null);
                setDeleteTutorAlso(false);
              }}
              disabled={isDeleting}
              className="w-full py-4! rounded-2xl"
            >
              NÃO, MANTER PACIENTE
            </Button>
          </div>
        </div>
      </Modal>

      <ContextMenu
        isOpen={!!menuPatient && !!menuPosition}
        onClose={handleCloseMenu}
        position={menuPosition}
        ariaLabel={menuPatient ? `Ações para ${menuPatient.name}` : 'Ações do paciente'}
        triggerRef={lastMenuTriggerRef}
        items={
          menuPatient
            ? [
                {
                  id: 'edit',
                  label: 'Editar Paciente',
                  icon: <Edit2 className="w-4 h-4" />,
                  onSelect: () => setPatientToEdit(menuPatient),
                },
                {
                  id: 'delete',
                  label: 'Apagar Paciente',
                  icon: <Trash2 className="w-4 h-4" />,
                  tone: 'danger',
                  onSelect: () => {
                    setDeleteTutorAlso(false);
                    setPatientToDelete(menuPatient);
                  },
                },
              ]
            : []
        }
      />

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
