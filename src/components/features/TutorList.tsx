"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { MoreVertical } from 'lucide-react';
import { getTutors, deleteTutor, updateTutor } from '@/app/pacientes/actions';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Tutor {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
}

export function TutorList() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tutorToDelete, setTutorToDelete] = useState<Tutor | null>(null);
  const [tutorToEdit, setTutorToEdit] = useState<Tutor | null>(null);
  const [menuTutor, setMenuTutor] = useState<Tutor | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [lastTriggeredId, setLastTriggeredId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pressingTutorId, setPressingTutorId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const { success, error } = useToast();

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, tutor: Tutor) => {
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setPressingTutorId(tutor.id);
    longPressTimer.current = setTimeout(() => {
      triggerMenu(x, y, tutor);
    }, 500);
  };

  const triggerMenu = (x: number, y: number, tutor: Tutor) => {
    setMenuPosition({ x, y });
    setMenuTutor(tutor);
    setLastTriggeredId(tutor.id);
    setTimeout(() => setLastTriggeredId(null), 150);
    setPressingTutorId(null);
    if (window.navigator.vibrate) window.navigator.vibrate(50);
  };

  const handleEndPress = () => {
    setPressingTutorId(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCloseMenu = () => {
    setIsMenuClosing(true);
    setTimeout(() => {
      setMenuTutor(null);
      setMenuPosition(null);
      setIsMenuClosing(false);
    }, 200);
  };

  async function loadTutors(showLoading = true) {
    if (showLoading) setLoading(true);
    const data = await getTutors();
    setTutors(data as unknown as Tutor[]);
    setLoading(false);
  }

  useEffect(() => {
    getTutors().then(data => {
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
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      cpf: formData.get('cpf') as string,
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

  const filteredTutors = tutors.filter(tutor => 
    tutor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tutor.cpf?.includes(searchTerm) ||
    tutor.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500">
        {/* Search Bar Skeleton */}
        <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto w-full">
          <div className="h-16 bg-foreground/5 rounded-2xl flex-1 w-full animate-pulse" />
          <div className="flex gap-2 w-full md:w-auto">
            <div className="h-14 w-14 bg-foreground/5 rounded-full animate-pulse" />
            <div className="h-14 w-32 bg-foreground/5 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Cards Grid Skeleton */}
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
              
              <div className="space-y-3 mt-4">
                <div className="h-12 bg-foreground/5 rounded-2xl w-full animate-pulse border border-foreground/5" />
                <div className="h-12 bg-foreground/5 rounded-2xl w-full animate-pulse border border-foreground/5" />
              </div>

              <div className="mt-auto pt-6 border-t border-foreground/5 flex justify-center">
                <div className="h-4 bg-foreground/5 rounded-full w-32 animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full">      {/* Search Bar and View Toggle */}
      <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto w-full">
        <div className="relative group flex-1 w-full">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-foreground/20 group-focus-within:text-primary/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text"
            placeholder="Pesquisar tutor por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background rounded-2xl pl-14 pr-12 py-4 shadow-inner border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium placeholder:text-foreground/30 transition-all text-base"
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

        <div className="flex bg-foreground/5 p-1 rounded-full border border-border shrink-0">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 px-5 rounded-full transition-all duration-300 flex items-center gap-2 ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Lista</span>
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 px-5 rounded-full transition-all duration-300 flex items-center gap-2 ${viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Grade</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-6 w-full ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
        {filteredTutors.map((tutor) => (
          <Link 
            key={tutor.id} 
            href={`/pacientes?tutorId=${tutor.id}&tutorName=${encodeURIComponent(tutor.name)}`} 
            className="group block"
            style={{ WebkitTouchCallout: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => handleStartPress(e, tutor)}
            onMouseUp={handleEndPress}
            onMouseLeave={handleEndPress}
            onTouchStart={(e) => handleStartPress(e, tutor)}
            onTouchEnd={handleEndPress}
          >
            <Card 
              style={{ transform: pressingTutorId === tutor.id ? 'scale(0.96)' : 'scale(1)' }}
              className={`relative flex flex-col h-full group-hover:shadow-sm border border-border group-active:shadow-inner bg-foreground/5 transition-all duration-500 rounded-3xl overflow-hidden hover:border-primary/10 select-none ${pressingTutorId === tutor.id ? 'brightness-95' : ''} ${lastTriggeredId === tutor.id ? 'animate-haptic' : ''} ${
                viewMode === 'list' ? 'p-8 gap-4' : 'p-4 gap-2 text-center'
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerMenu(e.clientX, e.clientY, tutor);
                }}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 rounded-full hover:bg-foreground/5 transition-all text-foreground/20 hover:text-foreground/60 z-20"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {/* Header Section */}
              <div className={`flex ${viewMode === 'list' ? 'justify-between items-center' : 'flex-col items-center'} gap-3`}>
                {/* Icon */}
                <div className={`${viewMode === 'list' ? 'text-4xl order-2 pr-4' : 'text-6xl order-1 mb-4'} transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1`}>
                  👤
                </div>

                {/* Info */}
                <div className={`flex flex-col min-w-0 ${viewMode === 'list' ? 'order-1' : 'order-2 w-full'}`}>
                  <h2 className={`${viewMode === 'list' ? 'text-3xl' : 'text-base sm:text-lg'} font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}>
                    {tutor.name}
                  </h2>
                  
                  {viewMode === 'list' && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[9px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-widest">
                        Tutor
                      </span>
                      {tutor.phone && (
                        <span className="text-[9px] font-black bg-foreground/5 text-foreground/60 px-2.5 py-1 rounded-full uppercase tracking-widest">
                          {tutor.phone}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className={`mt-auto flex flex-col bg-foreground/5 rounded-2xl shadow-inner border border-border ${viewMode === 'list' ? 'p-4' : 'p-2'}`}>
                {viewMode === 'list' && (
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-3 h-3 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span className="text-[8px] font-black text-foreground/30 uppercase tracking-[0.2em]">Identificação</span>
                  </div>
                )}
                <div className={`flex flex-col ${viewMode === 'list' ? 'pl-5' : 'items-center'}`}>
                  <span className={`${viewMode === 'list' ? 'text-sm' : 'text-[10px]'} font-bold text-foreground truncate w-full`}>
                    {tutor.cpf || 'CPF não informado'}
                  </span>
                  {tutor.phone && viewMode === 'grid' && (
                    <span className="text-[9px] font-medium text-foreground/50 mt-0.5">{tutor.phone}</span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {filteredTutors.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 opacity-30">
            <div className="text-6xl">👥</div>
            <p className="font-bold italic text-lg">Nenhum tutor encontrado</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal 
        isOpen={!!tutorToDelete} 
        onClose={() => !isDeleting && setTutorToDelete(null)}
        title="Confirmar Exclusão?"
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col items-center gap-6 py-2">
          <div className="text-6xl animate-bounce">
            ⚠️
          </div>
          
          <div className="text-center space-y-4">
            <p className="text-foreground/60 font-medium text-lg leading-relaxed">
              Você está prestes a remover o tutor <span className="text-foreground font-black italic">&quot;{tutorToDelete?.name}&quot;</span>.
            </p>
            
            <div className="bg-error/5 border-2 border-error/10 p-5 rounded-2xl">
              <p className="text-error text-sm font-black leading-tight uppercase tracking-wide">
                Esta ação excluirá permanentemente o tutor e TODOS os pets vinculados a ele.
              </p>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <Button
              variant="primary"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full bg-error! border-none! py-5! uppercase font-black text-[10px] tracking-widest shadow-lg shadow-error/20"
            >
              {isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR TUDO'}
            </Button>
            <Button
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

      {/* iOS Style Context Menu Overlay */}
      {menuTutor && menuPosition && (
        <div className="fixed inset-0 z-100">
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
            className={`absolute w-full max-w-[200px] bg-card/90 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/20 overflow-hidden border border-border ${isMenuClosing ? 'animate-ios-pop-out' : 'animate-ios-pop'}`}
          >
            <div className="flex flex-col divide-y divide-foreground/10">
              <button
                onClick={() => {
                  setTutorToEdit(menuTutor);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-foreground/5 active:bg-foreground/10 transition-colors text-foreground"
              >
                <svg className="w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="font-bold text-sm">Editar Tutor</span>
              </button>
              <button
                onClick={() => {
                  setTutorToDelete(menuTutor);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-error/5 active:bg-error/10 transition-colors text-error"
              >
                <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-bold text-sm">Apagar Tutor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tutor Modal */}
      <Modal
        isOpen={!!tutorToEdit}
        onClose={() => !isUpdating && setTutorToEdit(null)}
        title="Editar Tutor"
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60 -mt-6 mb-8">{tutorToEdit?.name}</p>
        
        <form onSubmit={handleUpdate} className="flex flex-col gap-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-6 p-6 bg-foreground/2 rounded-3xl border border-foreground/3">
            <span className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.2em] pl-2">Informações Pessoais</span>
            <div className="flex flex-col gap-4">
              <Input 
                label="Nome Completo *"
                name="name"
                defaultValue={tutorToEdit?.name}
                placeholder="Ex: João da Silva"
                required
              />
              <Input 
                label="Telefone"
                name="phone"
                defaultValue={tutorToEdit?.phone || ''}
                placeholder="(00) 00000-0000"
              />
              <Input 
                label="CPF"
                name="cpf"
                defaultValue={tutorToEdit?.cpf || ''}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setTutorToEdit(null)} 
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
