"use client";

import React, { useState, useRef, useId, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { InventoryItemForm } from './InventoryItemForm';
import { deleteInventoryItem } from '@/app/estoque/actions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ContextMenu } from '@/components/ui/ContextMenu';
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
  const searchId = useId();
  const filterId = useId();
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Context Menu State
  const [pressingItemId, setPressingItemId] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<InventoryItem | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastTriggeredId, setLastTriggeredId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMenuTriggerRef = useRef<HTMLElement | null>(null);
  const triggerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const triggerMenu = useCallback((x: number, y: number, item: InventoryItem) => {
    setMenuItem(item);
    setMenuPosition({ x, y });
    setLastTriggeredId(item.id);
    setTimeout(() => setLastTriggeredId(null), 150);
    if (window.navigator.vibrate) window.navigator.vibrate(50);
    setPressingItemId(null);
  }, []);

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, item: InventoryItem) => {
    if ('button' in e && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    setPressingItemId(item.id);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    pressTimer.current = setTimeout(() => {
      lastMenuTriggerRef.current = triggerButtonRefs.current[item.id] ?? null;
      triggerMenu(clientX, clientY, item);
    }, 500);
  };

  const handleEndPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setPressingItemId(null);
  };

  const handleCloseMenu = useCallback(() => {
    setMenuItem(null);
    setMenuPosition(null);
  }, []);

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

  const filteredItems = initialItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === 'all' ||
      item.type === filterType ||
      (filterType === 'Supply' && item.type === 'Material');
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filter */}
      <div className="flex flex-col gap-4 px-2 max-w-2xl mx-auto w-full">
        <div className="relative group">
          <label htmlFor={searchId} className="sr-only">
            Pesquisar itens do catálogo por nome
          </label>
          <input
            id={searchId}
            type="text"
            placeholder="Pesquisar por nome do item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-14 py-5 bg-background rounded-2xl shadow-inner border border-border-strong text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary transition-all text-lg"
          />
          <div
            aria-hidden="true"
            className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
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

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <label htmlFor={filterId} className="sr-only">
              Filtrar por categoria
            </label>
            <select
              id={filterId}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full min-h-[44px] appearance-none px-6 py-3.5 pr-12 bg-card rounded-full shadow-sm border border-border-strong text-foreground font-black uppercase tracking-widest text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all cursor-pointer"
            >
              <option className="bg-card text-foreground" value="all">TODOS OS ITENS</option>
              <option className="bg-card text-foreground" value="Medication">MEDICAMENTOS</option>
              <option className="bg-card text-foreground" value="Vaccine">VACINAS</option>
              <option className="bg-card text-foreground" value="Consultation">CONSULTAS</option>
              <option className="bg-card text-foreground" value="Supply">OUTROS / MATERIAIS</option>
            </select>
            <div aria-hidden="true" className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label="Modo de visualização"
            className="flex bg-foreground/5 p-1 rounded-full border border-border shrink-0 justify-center mx-auto sm:mx-0 gap-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'list'}
              aria-label="Visualização em lista"
              onClick={() => setViewMode('list')}
              className={`min-h-[44px] py-2 px-5 rounded-full transition-all duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm border border-border'
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
                  ? 'bg-primary text-primary-foreground shadow-sm border border-border'
                  : 'text-foreground/75 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest">Grade</span>
            </button>
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card className="text-center py-20 flex flex-col items-center gap-4 bg-background/40 max-w-2xl mx-auto w-full">
          <div aria-hidden="true" className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center text-4xl">
            🔍
          </div>
          <p className="text-muted-foreground font-bold text-lg italic">Nenhum item encontrado</p>
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
                transform: pressingItemId === item.id ? 'scale(0.96)' : 'scale(1)',
                WebkitTouchCallout: 'none',
              }}
              className={`relative flex flex-col h-full group transition-all duration-500 rounded-3xl overflow-hidden hover:shadow-sm border border-border hover:border-primary/20 select-none ${
                viewMode === 'list' ? 'p-5 sm:p-8 gap-4' : 'p-4 gap-2 text-center'
              } ${pressingItemId === item.id ? 'brightness-95' : ''} ${lastTriggeredId === item.id ? 'animate-haptic' : ''}`}
            >
              <button
                ref={(el) => {
                  triggerButtonRefs.current[item.id] = el;
                }}
                type="button"
                aria-label={`Mais ações para ${item.name}`}
                aria-haspopup="menu"
                aria-expanded={menuItem?.id === item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  lastMenuTriggerRef.current = e.currentTarget;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX || rect.right - 180;
                  const y = e.clientY || rect.bottom + 4;
                  triggerMenu(x, y, item);
                }}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary z-20"
              >
                <MoreVertical aria-hidden="true" className="w-5 h-5" />
              </button>

              {/* Header Section */}
              <div className={`flex ${viewMode === 'list' ? 'justify-between items-start pr-12' : 'flex-col items-center pt-6'} gap-3`}>
                {/* Category Icon */}
                <div
                  aria-hidden="true"
                  className={`${viewMode === 'list' ? 'text-4xl order-2 ml-4' : 'text-5xl order-1 mb-4'} shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1`}
                >
                  {item.type === 'Medication' ? '💊' : item.type === 'Vaccine' ? '💉' : item.type === 'Consultation' ? '📋' : '📦'}
                </div>

                {/* Info */}
                <div className={`flex flex-col min-w-0 ${viewMode === 'list' ? 'order-1' : 'order-2 w-full'}`}>
                  <h2 className={`${viewMode === 'list' ? 'text-2xl' : 'text-base sm:text-lg'} font-black text-foreground group-hover:text-primary transition-colors leading-tight truncate`}>
                    {item.name}
                  </h2>
                  <div className={`flex items-center gap-2 mt-1 flex-wrap ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-widest">
                      {item.type === 'Medication' ? 'Medicamento' : item.type === 'Vaccine' ? 'Vacina' : item.type === 'Consultation' ? 'Consulta' : 'Material'}
                    </span>
                    {item.concentration && (
                      <span className="text-[10px] font-black bg-foreground/5 text-muted-foreground px-2.5 py-1 rounded-full uppercase tracking-widest">
                        {item.concentration}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Price Section */}
              <div className={`mt-auto flex flex-col bg-foreground/5 rounded-2xl shadow-inner border border-border ${viewMode === 'list' ? 'p-4' : 'p-2'}`}>
                <div className={`flex flex-col ${viewMode === 'list' ? 'pl-2' : 'items-center'}`}>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">
                    Valor Aplicação
                  </span>
                  <span className={`${viewMode === 'list' ? 'text-2xl' : 'text-lg'} font-black text-primary tracking-tighter`}>
                    R$ {item.salePrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContextMenu
        isOpen={!!menuItem && !!menuPosition}
        onClose={handleCloseMenu}
        position={menuPosition}
        ariaLabel={menuItem ? `Ações para ${menuItem.name}` : 'Ações do item'}
        triggerRef={lastMenuTriggerRef}
        items={
          menuItem
            ? [
                {
                  id: 'edit',
                  label: 'Editar Item',
                  icon: <Edit2 className="w-4 h-4" />,
                  onSelect: () => setEditingItem(menuItem),
                },
                {
                  id: 'delete',
                  label: 'Apagar Item',
                  icon: <Trash2 className="w-4 h-4" />,
                  tone: 'danger',
                  onSelect: () => setItemToDelete(menuItem),
                },
              ]
            : []
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => {
          if (!isDeleting) setItemToDelete(null);
        }}
        title="Apagar Item"
        role="alertdialog"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground font-medium">
            Tem certeza que deseja remover <span className="text-foreground font-black">&ldquo;{itemToDelete?.name}&rdquo;</span> do catálogo? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItemToDelete(null)}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-2"
            >
              {isDeleting ? 'Apagando...' : 'Sim, Apagar'}
            </Button>
          </div>
        </div>
      </Modal>

      {editingItem && (
        <InventoryItemForm
          key={editingItem.id}
          itemToEdit={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
