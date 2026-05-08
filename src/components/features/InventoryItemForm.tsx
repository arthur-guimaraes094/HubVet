"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { addInventoryItem, updateInventoryItem, deleteInventoryItem } from '@/app/estoque/actions';
import { useToast } from '@/components/ui/Toast';

interface InventoryItemFormProps {
  itemToEdit?: {
    id: string;
    name: string;
    type: string;
    concentration: string | null;
    unitCost: number;
    salePrice: number;
  };
  onClose?: () => void;
}

export function InventoryItemForm({ itemToEdit, onClose }: InventoryItemFormProps) {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const [name, setName] = useState(itemToEdit?.name || '');
  const [type, setType] = useState(itemToEdit?.type || 'Medication');
  const [concentration, setConcentration] = useState(itemToEdit?.concentration || '');
  const [salePrice, setSalePrice] = useState(itemToEdit?.salePrice?.toString() || '');

  // If itemToEdit is provided, the form is open by default as a modal edit
  const isEdit = !!itemToEdit;
  const effectivelyOpen = isEdit || isOpen;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !salePrice) {
      error('Preencha os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    try {
      const data = {
        name,
        type,
        concentration: concentration || undefined,
        unitCost: 0,
        salePrice: parseFloat(salePrice)
      };

      if (isEdit && itemToEdit) {
        await updateInventoryItem(itemToEdit.id, data);
        success('Item atualizado com sucesso!');
      } else {
        await addInventoryItem(data);
        success('Item cadastrado com sucesso!');
      }
      
      if (onClose) onClose();
      setIsOpen(false);
      setName('');
      setConcentration('');
      setSalePrice('');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToEdit) return;
    
    setDeleting(true);
    try {
      await deleteInventoryItem(itemToEdit.id);
      success('Item removido com sucesso!');
      if (onClose) onClose();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao excluir');
      setIsConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!effectivelyOpen) {
    return (
      <Button variant="primary" onClick={() => setIsOpen(true)} className="!px-4 !py-2 text-sm">
        + Novo Item
      </Button>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      onClick={() => isEdit ? onClose?.() : setIsOpen(false)}
    >
      <Card 
        className="w-full max-w-md flex flex-col gap-4 shadow-2xl relative overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Custom Confirmation Overlay */}
        {isConfirmingDelete && (
          <div className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="text-6xl mb-6 animate-bounce">⚠️</div>
            <h3 className="text-2xl font-black text-foreground mb-2">Confirmar Exclusão?</h3>
            <p className="text-foreground/60 font-medium mb-8 leading-relaxed">
              Você está prestes a remover <span className="text-foreground font-bold italic">&quot;{name}&quot;</span> do catálogo. Esta ação é permanente e não poderá ser desfeita.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button 
                variant="primary" 
                onClick={confirmDelete} 
                disabled={deleting}
                className="w-full !bg-error hover:!bg-error/80 !border-none !py-4 shadow-neu-sm"
              >
                {deleting ? 'Removendo...' : 'Sim, Excluir Item'}
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setIsConfirmingDelete(false)}
                disabled={deleting}
                className="w-full !py-4"
              >
                Não, Manter Item
              </Button>
            </div>
          </div>
        )}

        <h3 className="text-xl font-bold text-primary">
          {isEdit ? 'Editar Item' : 'Cadastrar Novo Item'}
        </h3>
        
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input 
            label="Nome do Item" 
            placeholder="Ex: Vacina V10, Dexametasona..." 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
          />

          <Input 
            label="Concentração (Opcional)" 
            placeholder="Ex: 500mg, 10mg/ml..." 
            value={concentration} 
            onChange={e => setConcentration(e.target.value)} 
          />
          
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-foreground/80 pl-1">Categoria</span>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)}
              className="w-full bg-background border-none rounded-2xl px-4 py-3 shadow-neu-pressed focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none font-medium"
            >
              <option value="Medication">Medicamento</option>
              <option value="Vaccine">Vacina</option>
              <option value="Consultation">Consulta</option>
              <option value="Supply">Material / Outros</option>
            </select>
          </div>

          <Input 
            label="Valor Aplicação (R$)" 
            type="number" 
            step="0.01" 
            placeholder="0.00" 
            value={salePrice} 
            onChange={e => setSalePrice(e.target.value)} 
            required 
          />

          <div className="flex flex-col gap-3 mt-4">
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => isEdit ? onClose?.() : setIsOpen(false)} className="w-full">
                Voltar
              </Button>
              <Button type="submit" variant="primary" disabled={loading || deleting} className="w-full">
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
            
            {isEdit && (
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => setIsConfirmingDelete(true)}
                disabled={loading || deleting}
                className="w-full !text-error hover:bg-error/10 border-error/20 font-black uppercase tracking-widest text-[10px]"
              >
                Excluir Item do Estoque
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
