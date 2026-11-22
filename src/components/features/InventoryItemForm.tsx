"use client";

import React, { useState, useId, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { addInventoryItem, updateInventoryItem, deleteInventoryItem } from '@/app/estoque/actions';
import {
  getCatalogOptionLabels,
  findCatalogItemByLabel,
} from '@/core/data/vet-supplies-catalog';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';

function parseNonNegativePrice(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) return null;
  return parsed;
}

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
  const categorySelectId = useId();
  
  const [name, setName] = useState(itemToEdit?.name || '');
  const [type, setType] = useState(itemToEdit?.type || 'Medication');
  const [concentration, setConcentration] = useState(itemToEdit?.concentration || '');
  const [salePrice, setSalePrice] = useState(
    itemToEdit?.salePrice !== undefined && itemToEdit?.salePrice !== null
      ? String(itemToEdit.salePrice)
      : ''
  );

  const catalogOptions = useMemo(() => getCatalogOptionLabels(), []);

  const handleNameChange = (val: string) => {
    const match = findCatalogItemByLabel(val);
    if (match) {
      setName(match.name);
      setConcentration(match.concentration || '');
      setType(match.category);
    } else {
      setName(val);
    }
  };

  // If itemToEdit is provided, the form is open by default as a modal edit
  const isEdit = !!itemToEdit;
  const effectivelyOpen = isEdit || isOpen;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !salePrice.trim()) {
      error('Preencha os campos obrigatórios');
      return;
    }

    const parsedSalePrice = parseNonNegativePrice(salePrice);
    if (parsedSalePrice === null) {
      error('Informe um valor de aplicação válido (maior ou igual a zero).');
      return;
    }

    setLoading(true);
    try {
      const preservedUnitCost =
        isEdit && itemToEdit && Number.isFinite(itemToEdit.unitCost) && itemToEdit.unitCost >= 0
          ? itemToEdit.unitCost
          : 0;

      const data = {
        name: trimmedName,
        type,
        concentration: concentration.trim() || undefined,
        unitCost: preservedUnitCost,
        salePrice: parsedSalePrice,
      };

      if (isEdit && itemToEdit) {
        const result = await updateInventoryItem(itemToEdit.id, data);
        if (!result.success) {
          error(result.error);
          return;
        }
        success('Item atualizado com sucesso!');
      } else {
        const result = await addInventoryItem(data);
        if (!result.success) {
          error(result.error);
          return;
        }
        success('Item cadastrado com sucesso!');
      }
      
      if (onClose) onClose();
      setIsOpen(false);
      setName('');
      setConcentration('');
      setSalePrice('');
    } catch {
      error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToEdit) return;
    
    setDeleting(true);
    try {
      const result = await deleteInventoryItem(itemToEdit.id);
      if (!result.success) {
        error(result.error);
        setIsConfirmingDelete(false);
        return;
      }
      success('Item removido com sucesso!');
      if (onClose) onClose();
    } catch {
      error('Erro ao excluir');
      setIsConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!effectivelyOpen) {
    return (
      <Button variant="primary" onClick={() => setIsOpen(true)} className="px-4! py-2! text-sm">
        + Novo Item
      </Button>
    );
  }

  return (
    <>
      {!isEdit && (
        <Button variant="primary" onClick={() => setIsOpen(true)} className="px-4! py-2! text-sm">
          + Novo Item
        </Button>
      )}

      <Modal 
        isOpen={effectivelyOpen} 
        onClose={() => isEdit ? onClose?.() : setIsOpen(false)} 
        title={isEdit ? 'Editar Item' : 'Cadastrar Novo Item'}
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <div className="relative">
          {/* Custom Confirmation Overlay */}
          {isConfirmingDelete && (
            <div className="absolute inset-0 z-60 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200">
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
                  className="w-full bg-error! hover:bg-error/80! border-none! py-4! shadow-sm"
                >
                  {deleting ? 'Removendo...' : 'Sim, Excluir Item'}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={deleting}
                  className="w-full py-4!"
                >
                  Não, Manter Item
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="flex flex-col gap-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <AutocompleteInput
              label="Nome do Item (Catálogo de Vacinas e Insumos)"
              placeholder="Ex: Vacina V10 Vanguard, Antirrábica, Maxicam..."
              value={name}
              onChange={handleNameChange}
              options={catalogOptions}
              required
            />

            <Input 
              label="Concentração (Opcional)" 
              placeholder="Ex: 500mg, 10mg/ml..." 
              value={concentration} 
              onChange={e => setConcentration(e.target.value)} 
            />
            
            <div className="flex flex-col gap-2">
              <label 
                htmlFor={categorySelectId} 
                className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4"
              >
                Categoria
              </label>
              <select 
                id={categorySelectId}
                value={type} 
                onChange={e => setType(e.target.value)}
                className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 font-medium transition-all border border-border appearance-none text-foreground"
              >
                <option className="bg-card text-foreground" value="Medication">Medicamento</option>
                <option className="bg-card text-foreground" value="Vaccine">Vacina</option>
                <option className="bg-card text-foreground" value="Consultation">Consulta</option>
                <option className="bg-card text-foreground" value="Supply">Material / Outros</option>
              </select>
            </div>

            <Input 
              label="Valor Aplicação (R$)" 
              type="text"
              inputMode="decimal"
              placeholder="0,00" 
              value={salePrice} 
              onChange={e => setSalePrice(e.target.value)} 
              required 
            />

            <div className="flex flex-col gap-3 mt-4">
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => isEdit ? onClose?.() : setIsOpen(false)} className="w-full uppercase font-black text-[10px] tracking-widest py-5!">
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={loading || deleting} className="w-full uppercase font-black text-[10px] tracking-widest py-5!">
                  {loading ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
