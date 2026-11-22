"use client";

import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { getTutors, deleteTutor, updateTutor } from '@/app/pacientes/actions';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ContextMenu } from '@/components/ui/ContextMenu';
import {
  buildGoogleMapsUrl,
  fetchAddressByCep,
  formatCep,
  formatFullAddress,
} from '@/core/utils/cep';

interface Tutor {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  address?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

function formatCpfInput(raw: string): string {
  let value = raw.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length <= 3) return value;
  if (value.length <= 6) return `${value.slice(0, 3)}.${value.slice(3)}`;
  if (value.length <= 9) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
  return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
}

function formatPhoneInput(raw: string, stripCountryPrefix = false): string {
  let value = raw.replace(/\D/g, '');
  if (stripCountryPrefix && (value.length === 12 || value.length === 13) && value.startsWith('55')) {
    value = value.slice(2);
  }
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length <= 2) return value;

  const ddd = value.slice(0, 2);
  const part1 = value.slice(2, value.length <= 10 ? 6 : 7);
  const part2 = value.slice(value.length <= 10 ? 6 : 7);

  if (part2) {
    return `(${ddd}) ${part1}-${part2}`;
  }
  return `(${ddd}) ${part1}`;
}

export function TutorList() {
  const searchId = useId();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tutorToDelete, setTutorToDelete] = useState<Tutor | null>(null);
  const [tutorToEdit, setTutorToEdit] = useState<Tutor | null>(null);
  const [menuTutor, setMenuTutor] = useState<Tutor | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastTriggeredId, setLastTriggeredId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pressingTutorId, setPressingTutorId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMenuTriggerRef = useRef<HTMLElement | null>(null);
  const triggerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Campos de edição controlada do tutor
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editCep, setEditCep] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editComplement, setEditComplement] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editFreeAddress, setEditFreeAddress] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  const { success, error } = useToast();

  const openEditTutor = (tutor: Tutor) => {
    setTutorToEdit(tutor);
    setEditName(tutor.name || '');
    setEditPhone(tutor.phone ? formatPhoneInput(tutor.phone, true) : '');
    setEditCpf(tutor.cpf ? formatCpfInput(tutor.cpf) : '');
    setEditCep(tutor.cep ? formatCep(tutor.cep) : '');
    setEditStreet(tutor.street || '');
    setEditNumber(tutor.number || '');
    setEditComplement(tutor.complement || '');
    setEditNeighborhood(tutor.neighborhood || '');
    setEditCity(tutor.city || '');
    setEditState(tutor.state || '');
    setEditFreeAddress(tutor.address || '');
  };

  const handleEditCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setEditCep(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      try {
        const found = await fetchAddressByCep(digits);
        if (found) {
          if (found.street) setEditStreet(found.street);
          if (found.neighborhood) setEditNeighborhood(found.neighborhood);
          if (found.city) setEditCity(found.city);
          if (found.state) setEditState(found.state);
        }
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const triggerMenu = useCallback((x: number, y: number, tutor: Tutor) => {
    setMenuPosition({ x, y });
    setMenuTutor(tutor);
    setLastTriggeredId(tutor.id);
    setTimeout(() => setLastTriggeredId(null), 150);
    setPressingTutorId(null);
    if (window.navigator.vibrate) window.navigator.vibrate(50);
  }, []);

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, tutor: Tutor) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setPressingTutorId(tutor.id);
    longPressTimer.current = setTimeout(() => {
      lastMenuTriggerRef.current = triggerButtonRefs.current[tutor.id] ?? null;
      triggerMenu(x, y, tutor);
    }, 500);
  };

  const handleEndPress = () => {
    setPressingTutorId(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCloseMenu = useCallback(() => {
    setMenuTutor(null);
    setMenuPosition(null);
  }, []);

  async function loadTutors(showLoading = true) {
    if (showLoading) setLoading(true);
    const data = await getTutors();
    setTutors(data as unknown as Tutor[]);
    setLoading(false);
  }

  useEffect(() => {
    getTutors().then((data) => {
      setTutors(data as unknown as Tutor[]);
      setLoading(false);
    });
  }, []);

  const handleDelete = async () => {
    if (!tutorToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteTutor(tutorToDelete.id);
      if (result.success) {
        success('Tutor e pets excluídos com sucesso!');
        setTutorToDelete(null);
        setMenuTutor(null);
        loadTutors();
      } else {
        error(result.error || 'Erro ao excluir tutor');
      }
    } catch {
      error('Erro ao excluir tutor');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tutorToEdit) return;

    setIsUpdating(true);
    const structuredAddr = formatFullAddress({
      cep: editCep,
      street: editStreet,
      number: editNumber,
      complement: editComplement,
      neighborhood: editNeighborhood,
      city: editCity,
      state: editState,
    });

    const resolvedAddress =
      !editStreet.trim() && editFreeAddress.trim()
        ? editFreeAddress.trim()
        : structuredAddr || editFreeAddress.trim();

    const data = {
      name: editName,
      phone: editPhone,
      cpf: editCpf,
      cep: editCep,
      street: editStreet,
      number: editNumber,
      complement: editComplement,
      neighborhood: editNeighborhood,
      city: editCity,
      state: editState,
      address: resolvedAddress,
    };

    try {
      const result = await updateTutor(tutorToEdit.id, data);
      if (result.success) {
        success('Tutor atualizado com sucesso!');
        setTutorToEdit(null);
        setMenuTutor(null);
        loadTutors();
      } else {
        error(result.error || 'Erro ao atualizar tutor');
      }
    } catch {
      error('Erro ao atualizar tutor');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredTutors = tutors.filter(
    (tutor) =>
      tutor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tutor.cpf?.includes(searchTerm) ||
      tutor.phone?.includes(searchTerm) ||
      tutor.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Carregando tutores"
        className="flex flex-col gap-8 w-full animate-in fade-in duration-500"
      >
        <span className="sr-only">Carregando tutores...</span>
        <div aria-hidden="true" className="flex flex-col gap-8 w-full">
          <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto w-full">
            <div className="h-16 bg-foreground/5 rounded-2xl flex-1 w-full animate-pulse" />
            <div className="flex gap-2 w-full md:w-auto">
              <div className="h-14 w-14 bg-foreground/5 rounded-full animate-pulse" />
              <div className="h-14 w-32 bg-foreground/5 rounded-full animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-8 flex flex-col gap-6 bg-card/50 border-border/50 rounded-3xl">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 bg-foreground/5 rounded-full animate-pulse" />
                  <div className="space-y-3 w-full">
                    <div className="h-6 bg-foreground/10 rounded-lg w-3/4 mx-auto animate-pulse" />
                    <div className="h-4 bg-foreground/5 rounded-lg w-1/2 mx-auto animate-pulse" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Search Bar and View Toggle */}
      <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto w-full">
        <div className="relative group flex-1 w-full">
          <label htmlFor={searchId} className="sr-only">
            Pesquisar tutor por nome, CPF, telefone ou endereço
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
            placeholder="Pesquisar tutor por nome, CPF, telefone ou endereço..."
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
          className="flex bg-foreground/5 p-1 rounded-full border border-border shrink-0 gap-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'list'}
            aria-label="Visualização em lista"
            onClick={() => setViewMode('list')}
            className={`min-h-[44px] py-2 px-5 rounded-full transition-all duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/75 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[11px] font-black uppercase tracking-widest">Lista</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'grid'}
            aria-label="Visualização em grade"
            onClick={() => setViewMode('grid')}
            className={`min-h-[44px] py-2 px-5 rounded-full transition-all duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
            <span className="text-[11px] font-black uppercase tracking-widest">Grade</span>
          </button>
        </div>
      </div>

      <div
        className={`grid gap-6 w-full ${
          viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-4xl mx-auto'
        }`}
      >
        {filteredTutors.map((tutor) => (
          <Card
            key={tutor.id}
            style={{
              transform: pressingTutorId === tutor.id ? 'scale(0.96)' : 'scale(1)',
              WebkitTouchCallout: 'none',
            }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => handleStartPress(e, tutor)}
            onMouseUp={handleEndPress}
            onMouseLeave={handleEndPress}
            onTouchStart={(e) => handleStartPress(e, tutor)}
            onTouchEnd={handleEndPress}
            className={`group relative flex flex-col h-full hover:shadow-sm border border-border active:shadow-inner bg-foreground/5 transition-all duration-500 rounded-3xl overflow-hidden hover:border-primary/20 select-none has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-offset-2 ${
              pressingTutorId === tutor.id ? 'brightness-95' : ''
            } ${lastTriggeredId === tutor.id ? 'animate-haptic' : ''} ${
              viewMode === 'list' ? 'p-5 sm:p-8 gap-4' : 'p-4 gap-2 text-center'
            }`}
          >
            <button
              ref={(el) => {
                triggerButtonRefs.current[tutor.id] = el;
              }}
              type="button"
              aria-label={`Mais ações para ${tutor.name}`}
              aria-haspopup="menu"
              aria-expanded={menuTutor?.id === tutor.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                lastMenuTriggerRef.current = e.currentTarget;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX || rect.right - 180;
                const y = e.clientY || rect.bottom + 4;
                triggerMenu(x, y, tutor);
              }}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary z-20"
            >
              <MoreVertical aria-hidden="true" className="w-5 h-5" />
            </button>

            <div
              className={`flex ${
                viewMode === 'list' ? 'justify-between items-center pr-12' : 'flex-col items-center pt-6'
              } gap-3`}
            >
              <div
                aria-hidden="true"
                className={`${
                  viewMode === 'list' ? 'text-4xl order-2 pr-4' : 'text-6xl order-1 mb-4'
                } transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1`}
              >
                👤
              </div>

              <div
                className={`flex flex-col min-w-0 ${
                  viewMode === 'list' ? 'order-1' : 'order-2 w-full'
                }`}
              >
                <h2
                  className={`${
                    viewMode === 'list' ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'
                  } font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}
                >
                  <Link
                    href={`/pacientes?tutorId=${tutor.id}&tutorName=${encodeURIComponent(tutor.name)}`}
                    onClick={(e) => {
                      if (lastTriggeredId === tutor.id) e.preventDefault();
                    }}
                    className="after:absolute after:inset-0 after:z-10 after:rounded-3xl focus:outline-none"
                  >
                    {tutor.name}
                  </Link>
                </h2>

                {viewMode === 'list' && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-widest">
                      Tutor
                    </span>
                    {tutor.phone && (
                      <span className="text-[10px] font-black bg-foreground/5 text-foreground/80 px-2.5 py-1 rounded-full uppercase tracking-widest">
                        {tutor.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              className={`mt-auto flex flex-col gap-1.5 bg-foreground/5 rounded-2xl shadow-inner border border-border ${
                viewMode === 'list' ? 'p-4' : 'p-2.5'
              }`}
            >
              <div className={`flex flex-col ${viewMode === 'list' ? 'pl-2' : 'items-center'}`}>
                <span
                  className={`${
                    viewMode === 'list' ? 'text-sm' : 'text-xs'
                  } font-bold text-foreground truncate w-full`}
                >
                  {tutor.cpf || 'CPF não informado'}
                </span>
                {tutor.phone && viewMode === 'grid' && (
                  <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                    {tutor.phone}
                  </span>
                )}
                {tutor.address && (
                  <span className="text-xs text-foreground/75 truncate w-full mt-1">
                    <span aria-hidden="true">📍 </span>
                    {tutor.address}
                  </span>
                )}
              </div>

              {tutor.address && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(buildGoogleMapsUrl(tutor.address!), '_blank', 'noopener,noreferrer');
                  }}
                  className="relative z-20 mt-1 w-full min-h-[44px] py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span aria-hidden="true">🗺️</span>
                  <span>Ver no Mapa</span>
                  <span className="sr-only"> (abre em nova aba)</span>
                </button>
              )}
            </div>
          </Card>
        ))}
        {filteredTutors.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
            <div aria-hidden="true" className="text-6xl text-muted-foreground">
              👥
            </div>
            <p className="font-bold italic text-lg text-muted-foreground">
              Nenhum tutor encontrado
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!tutorToDelete}
        onClose={() => !isDeleting && setTutorToDelete(null)}
        title="Confirmar Exclusão?"
        role="alertdialog"
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col items-center gap-6 py-2">
          <div className="text-6xl" aria-hidden="true">
            ⚠️
          </div>

          <div className="text-center space-y-4">
            <p className="text-foreground/80 font-medium text-lg leading-relaxed">
              Você está prestes a remover o tutor{' '}
              <span className="text-foreground font-black italic">
                &quot;{tutorToDelete?.name}&quot;
              </span>
              .
            </p>

            <div className="bg-error/5 border-2 border-error/20 p-5 rounded-2xl">
              <p className="text-error text-sm font-black leading-tight uppercase tracking-wide">
                Esta ação excluirá permanentemente o tutor e TODOS os pets vinculados a ele.
              </p>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-5! uppercase font-black text-[10px] tracking-widest shadow-lg shadow-error/20"
            >
              {isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR TUDO'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTutorToDelete(null)}
              disabled={isDeleting}
              className="w-full py-5! uppercase font-black text-[10px] tracking-widest"
            >
              NÃO, MANTER TUTOR
            </Button>
          </div>
        </div>
      </Modal>

      <ContextMenu
        isOpen={!!menuTutor && !!menuPosition}
        onClose={handleCloseMenu}
        position={menuPosition}
        ariaLabel={menuTutor ? `Ações para ${menuTutor.name}` : 'Ações do tutor'}
        triggerRef={lastMenuTriggerRef}
        items={
          menuTutor
            ? [
                {
                  id: 'edit',
                  label: 'Editar Tutor',
                  icon: <Edit2 className="w-4 h-4" />,
                  onSelect: () => openEditTutor(menuTutor),
                },
                {
                  id: 'delete',
                  label: 'Apagar Tutor',
                  icon: <Trash2 className="w-4 h-4" />,
                  tone: 'danger',
                  onSelect: () => setTutorToDelete(menuTutor),
                },
              ]
            : []
        }
      />

      {/* Edit Tutor Modal */}
      <Modal
        isOpen={!!tutorToEdit}
        onClose={() => !isUpdating && setTutorToEdit(null)}
        title="Editar Tutor"
        showCloseButton={false}
        maxWidth="max-w-lg"
      >
        <p className="text-xs font-black text-primary uppercase tracking-[0.25em] -mt-4 mb-6">
          {tutorToEdit?.name}
        </p>

        <form
          onSubmit={handleUpdate}
          className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar"
        >
          <div className="flex flex-col gap-4 p-5 bg-foreground/2 rounded-3xl border border-border">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1">
              Informações Pessoais
            </span>
            <Input
              label="Nome Completo *"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex: João da Silva"
              autoComplete="name"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Telefone / WhatsApp"
                value={editPhone}
                onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))}
                placeholder="(84) 99999-9999"
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
              />
              <Input
                label="CPF"
                value={editCpf}
                onChange={(e) => setEditCpf(formatCpfInput(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
              />
            </div>

            <div className="pt-3 border-t border-border flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                  <span aria-hidden="true">📍 </span>Endereço Completo da Residência
                </span>
                {loadingCep && (
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-[10px] font-bold text-primary animate-pulse"
                  >
                    Buscando CEP...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="CEP"
                  placeholder="00000-000"
                  value={editCep}
                  onChange={handleEditCepChange}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={9}
                />
                <div className="col-span-2">
                  <Input
                    label="Rua / Logradouro"
                    placeholder="Ex: Rua das Embarcações"
                    value={editStreet}
                    onChange={(e) => setEditStreet(e.target.value)}
                    autoComplete="street-address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Número"
                  placeholder="Ex: 171"
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value)}
                />
                <div className="col-span-2">
                  <Input
                    label="Complemento"
                    placeholder="Apto, Bloco, Referência..."
                    value={editComplement}
                    onChange={(e) => setEditComplement(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Bairro"
                    placeholder="Nova Parnamirim"
                    value={editNeighborhood}
                    onChange={(e) => setEditNeighborhood(e.target.value)}
                    autoComplete="address-level3"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="Cidade"
                    placeholder="Parnamirim"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    autoComplete="address-level2"
                  />
                </div>
                <Input
                  label="UF"
                  placeholder="RN"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value.toUpperCase().slice(0, 2))}
                  autoComplete="address-level1"
                  maxLength={2}
                />
              </div>

              {!editStreet.trim() && (
                <Input
                  label="Endereço Livre / Observação de Localização"
                  placeholder="Rua, número, bairro..."
                  value={editFreeAddress}
                  onChange={(e) => setEditFreeAddress(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTutorToEdit(null)}
              disabled={isUpdating}
              className="flex-1 py-5! uppercase font-black text-[10px] tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isUpdating}
              className="flex-2 py-5! shadow-sm border border-border uppercase font-black text-[10px] tracking-widest"
            >
              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
