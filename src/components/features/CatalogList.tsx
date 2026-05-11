"use client";

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { InventoryItemForm } from './InventoryItemForm';
import { deleteInventoryItem } from '@/app/estoque/actions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  concentration: string | null;
  unitCost: number;
  salePrice: number;
}

interface CatalogListProps {
  initialItems: InventoryItem[];
}

export function CatalogList({ initialItems }: CatalogListProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  // Context Menu State
  const [pressingItemId, setPressingItemId] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<InventoryItem | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, item: InventoryItem) => {
    if ('button' in e && e.button !== 0) return;
    
    setPressingItemId(item.id);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    pressTimer.current = setTimeout(() => {
      setMenuItem(item);
      setMenuPosition({ x: clientX, y: clientY });
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      setPressingItemId(null);
    }, 600);
  };

  const handleEndPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setPressingItemId(null);
  };

  const handleCloseMenu = () => {
    setIsMenuClosing(true);
    setTimeout(() => {
      setMenuItem(null);
      setMenuPosition(null);
      setIsMenuClosing(false);
    }, 200);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteInventoryItem(itemToDelete.id);
      if (result.success) {
        success('Item removido do catálogo');
        setItemToDelete(null);
        handleCloseMenu();
        router.refresh();
      } else {
        error(result.error || 'Erro ao remover item');
      }
    } catch {
      error('Erro ao conectar com o servidor');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = initialItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filter */}
      <div className="flex flex-col gap-4 px-2 max-w-2xl mx-auto w-full">
        <div className="relative group">
          <input
            type="text"
            placeholder="Pesquisar por nome do item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-background rounded-2xl shadow-inner border border-border bg-gray-50/50 border border-foreground/[0.03] text-foreground font-medium placeholder:text-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-lg"
          />
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full appearance-none px-6 py-4 bg-background rounded-full shadow-sm border border-border border border-foreground/[0.03] text-foreground font-black uppercase tracking-widest text-[10px] focus:outline-none focus:shadow-inner border border-border bg-gray-50/50 transition-all cursor-pointer"
            >
              <option value="all">TODOS OS ITENS</option>
              <option value="Medication">MEDICAMENTOS</option>
              <option value="Vaccine">VACINAS</option>
              <option value="Consultation">CONSULTAS</option>
              <option value="Supply">OUTROS / MATERIAIS</option>
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="flex bg-background shadow-inner border border-border bg-gray-50/50 p-1 rounded-full border border-foreground/5 shrink-0 justify-center mx-auto sm:mx-0">
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
      </div>

      {filteredItems.length === 0 ? (
        <Card className="text-center py-20 flex flex-col items-center gap-4 bg-background/40 max-w-2xl mx-auto w-full">
          <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center text-4xl opacity-30">🔍</div>
          <p className="text-foreground/40 font-bold text-lg italic">Nenhum item encontrado</p>
        </Card>
      ) : (
        <div className={`grid gap-6 w-full ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              onMouseDown={(e) => handleStartPress(e, item)}
              onMouseUp={handleEndPress}
              onMouseLeave={handleEndPress}
              onTouchStart={(e) => handleStartPress(e, item)}
              onTouchEnd={handleEndPress}
              onContextMenu={(e) => e.preventDefault()}
              style={{ 
                transform: pressingItemId === item.id ? 'scale(0.98)' : 'scale(1)',
                WebkitTouchCallout: 'none'
              }}
              className={`flex flex-col h-full group transition-all duration-500 rounded-3xl overflow-hidden border border-transparent hover:border-primary/10 cursor-pointer hover:shadow-sm border border-border select-none ${
                viewMode === 'list' ? 'p-8 gap-4' : 'p-4 gap-2 text-center'
              } ${pressingItemId === item.id ? 'brightness-95' : ''}`}
            >
              {/* Header Section */}
              <div className={`flex ${viewMode === 'list' ? 'justify-between items-start' : 'flex-col items-center'} gap-3`}>
                
                {/* Icon Placeholder or Category Icon */}
                <div className={`${viewMode === 'list' ? 'text-4xl order-2 ml-4' : 'text-5xl order-1 mb-4'} shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1`}>
                  {item.type === 'Medication' ? '💊' : item.type === 'Vaccine' ? '💉' : item.type === 'Consultation' ? '📋' : '📦'}
                </div>

                {/* Info */}
                <div className={`flex flex-col min-w-0 ${viewMode === 'list' ? 'order-1' : 'order-2 w-full'}`}>
                  <h2 className={`${viewMode === 'list' ? 'text-2xl' : 'text-base sm:text-lg'} font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}>
                    {item.name}
                  </h2>
                  <div className={`flex items-center gap-2 mt-1 flex-wrap ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                    <span className="text-[9px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-widest">
                      {item.type === 'Medication' ? 'Medicamento' : item.type === 'Vaccine' ? 'Vacina' : item.type === 'Consultation' ? 'Consulta' : 'Material'}
                    </span>
                    {item.concentration && (
                      <span className="text-[9px] font-black bg-foreground/5 text-foreground/40 px-2.5 py-1 rounded-full uppercase tracking-widest">
                        {item.concentration}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Price Section */}
              <div className={`mt-auto flex flex-col bg-foreground/[0.02] rounded-2xl shadow-inner border border-border bg-gray-50/50 border border-foreground/[0.03] ${viewMode === 'list' ? 'p-4' : 'p-2'}`}>
                <div className={`flex flex-col ${viewMode === 'list' ? 'pl-2' : 'items-center'}`}>
                  <span className="text-[8px] font-black text-foreground/30 uppercase tracking-[0.2em] mb-0.5">Valor Aplicação</span>
                  <span className={`${viewMode === 'list' ? 'text-2xl' : 'text-lg'} font-black text-primary tracking-tighter`}>
                    R$ {item.salePrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* iOS Style Context Menu Overlay */}
      {menuItem && menuPosition && (
        <div className="fixed inset-0 z-[200]">
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
                  setEditingItem(menuItem);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-black/5 active:bg-black/10 transition-colors text-foreground"
              >
                <svg className="w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="font-bold text-sm">Editar Item</span>
              </button>
              <button
                onClick={() => {
                  setItemToDelete(menuItem);
                  handleCloseMenu();
                }}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-error/5 active:bg-error/10 transition-colors text-error"
              >
                <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-bold text-sm">Apagar Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)}
        title="Apagar Item"
      >
        <div className="flex flex-col gap-6">
          <p className="text-foreground/60 font-medium">
            Tem certeza que deseja remover <span className="text-foreground font-black">&ldquo;{itemToDelete?.name}&rdquo;</span> do catálogo? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={() => setItemToDelete(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-[2] !bg-error hover:!bg-error/90 border-none text-white"
            >
              {isDeleting ? 'Apagando...' : 'Sim, Apagar'}
            </Button>
          </div>
        </div>
      </Modal>

      {editingItem && (
        <InventoryItemForm 
          itemToEdit={editingItem} 
          onClose={() => setEditingItem(null)} 
        />
      )}
    </div>
  );
}
