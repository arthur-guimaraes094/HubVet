"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { getTutors, deleteTutor, updateTutor } from '@/app/pacientes/actions';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

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
      setMenuPosition({ x, y });
      setMenuTutor(tutor);
      setLastTriggeredId(tutor.id);
      setTimeout(() => setLastTriggeredId(null), 150);
      setPressingTutorId(null);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 500);
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
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
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
              className={`relative flex flex-col h-full group-hover:shadow-sm border border-border group-active:shadow-inner border border-border bg-gray-50/50 transition-all duration-500 rounded-3xl overflow-hidden hover:border-primary/10 select-none ${pressingTutorId === tutor.id ? 'brightness-95' : ''} ${lastTriggeredId === tutor.id ? 'animate-haptic' : ''} ${
                viewMode === 'list' ? 'p-8 gap-4' : 'p-4 gap-2 text-center'
              }`}
            >
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
              
              {/* Details Section */}
              <div className={`mt-auto flex flex-col bg-foreground/[0.02] rounded-2xl shadow-inner border border-border bg-gray-50/50 border border-foreground/[0.03] ${viewMode === 'list' ? 'p-4' : 'p-2'}`}>
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
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-6xl animate-bounce">
            ⚠️
          </div>
          
          <div className="text-center space-y-4">
            <p className="text-foreground/60 font-medium text-lg">
              Você está prestes a remover o tutor <span className="text-foreground font-black italic">&quot;{tutorToDelete?.name}&quot;</span>.
            </p>
            
            <div className="bg-error/5 border-2 border-error/20 p-5 rounded-2xl">
              <p className="text-error text-sm font-black leading-tight uppercase tracking-wide">
                CUIDADO: Esta ação excluirá permanentemente o tutor e TODOS os pets vinculados a ele, incluindo todo o histórico clínico e financeiro.
              </p>
            </div>
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
                'SIM, EXCLUIR TUDO'
              )}
            </button>
            <button
              onClick={() => setTutorToDelete(null)}
              disabled={isDeleting}
              className="w-full bg-foreground/5 text-foreground/60 font-black py-4 rounded-2xl hover:bg-foreground/10 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              NÃO, MANTER TUTOR
            </button>
          </div>
        </div>
      </Modal>

      {/* iOS Style Context Menu Overlay */}
      {menuTutor && menuPosition && (
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
                  setTutorToEdit(menuTutor);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-black/5 active:bg-black/10 transition-colors text-foreground"
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
      >
        <form onSubmit={handleUpdate} className="flex flex-col gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Nome Completo</label>
              <input 
                name="name"
                defaultValue={tutorToEdit?.name}
                required
                className="w-full bg-gray-50 border border-border rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Telefone</label>
              <input 
                name="phone"
                defaultValue={tutorToEdit?.phone || ''}
                className="w-full bg-gray-50 border border-border rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">CPF</label>
              <input 
                name="cpf"
                defaultValue={tutorToEdit?.cpf || ''}
                className="w-full bg-gray-50 border border-border rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isUpdating}
              className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  SALVANDO...
                </>
              ) : (
                'SALVAR ALTERAÇÕES'
              )}
            </button>
            <button
              type="button"
              onClick={() => setTutorToEdit(null)}
              disabled={isUpdating}
              className="w-full bg-foreground/5 text-foreground/60 font-black py-4 rounded-2xl hover:bg-foreground/10 transition-all"
            >
              CANCELAR
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
