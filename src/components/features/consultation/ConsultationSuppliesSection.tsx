"use client";

import React, { useId, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { addInventoryItem } from '@/app/estoque/actions';
import { findCatalogItemByLabel } from '@/core/data/vet-supplies-catalog';
import { useRouter } from 'next/navigation';

function parseNonNegativePrice(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) return null;
  return parsed;
}

export type InventoryItem = {
  id: string;
  name: string;
  type: 'Medication' | 'Vaccine' | 'Supply' | 'Material' | 'Consultation';
  unitCost: number;
  salePrice: number;
  concentration?: string;
};

interface ConsultationSuppliesSectionProps {
  inventory: InventoryItem[];
  selectedItems: { id: string; quantity: number }[];
  onAddItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  catalogNames: string[];
  parentLoading: boolean;
  onNotifySuccess: (message: string) => void;
  onNotifyError: (message: string) => void;
}

export function ConsultationSuppliesSection({
  inventory,
  selectedItems,
  onAddItem,
  onRemoveItem,
  catalogNames,
  parentLoading,
  onNotifySuccess,
  onNotifyError,
}: ConsultationSuppliesSectionProps) {
  const router = useRouter();
  const categorySelectId = useId();
  const searchInputId = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemConcentration, setNewItemConcentration] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Medication');
  const [savingNewItem, setSavingNewItem] = useState(false);

  const handleSelectCatalogForNewItem = (val: string) => {
    const match = findCatalogItemByLabel(val);
    if (match) {
      setNewItemName(match.name);
      setNewItemConcentration(match.concentration || '');
      if (match.category === 'Vaccine') setNewItemCategory('Vaccine');
      else if (match.category === 'Medication') setNewItemCategory('Medication');
      else if (match.category === 'Consultation') setNewItemCategory('Consultation');
      else setNewItemCategory('Supply');
    } else {
      setNewItemName(val);
    }
  };

  const handleAddNewInventoryItem = async () => {
    const trimmedName = newItemName.trim();
    if (!trimmedName || !newItemPrice.trim()) {
      onNotifyError('Preencha nome e valor de aplicação do novo item.');
      return;
    }

    const parsedPrice = parseNonNegativePrice(newItemPrice);
    if (parsedPrice === null) {
      onNotifyError('Informe um valor de aplicação válido (maior ou igual a zero).');
      return;
    }

    try {
      setSavingNewItem(true);
      const result = await addInventoryItem({
        name: trimmedName,
        type: newItemCategory as 'Medication' | 'Vaccine' | 'Supply' | 'Material' | 'Consultation',
        concentration: newItemConcentration.trim() || undefined,
        unitCost: 0,
        salePrice: parsedPrice,
      });

      if (result.success) {
        onNotifySuccess(`${trimmedName} cadastrado no catálogo!`);
        setNewItemName('');
        setNewItemPrice('');
        setNewItemConcentration('');
        setShowNewItemForm(false);
        router.refresh();
      } else {
        onNotifyError(result.error);
      }
    } catch {
      onNotifyError('Erro ao cadastrar novo item.');
    } finally {
      setSavingNewItem(false);
    }
  };

  const filteredInventory =
    inventory?.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center gap-2">
        <h3 className="font-bold text-foreground/85">
          Insumos e Procedimentos Cobrados (Maleta)
        </h3>
        <button
          type="button"
          onClick={() => setShowNewItemForm(!showNewItemForm)}
          className="min-h-[36px] text-xs font-black text-primary bg-primary/10 px-3.5 py-1.5 rounded-full hover:bg-primary/20 transition-colors shrink-0"
        >
          {showNewItemForm ? 'Cancelar' : '+ Cadastrar Novo'}
        </button>
      </div>

      {showNewItemForm && (
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AutocompleteInput
              label="Nome do Item"
              value={newItemName}
              onChange={handleSelectCatalogForNewItem}
              options={catalogNames}
              placeholder="Ex: Vacina V10, Dipirona..."
            />
            <Input
              label="Concentração (Opcional)"
              value={newItemConcentration}
              onChange={(e) => setNewItemConcentration(e.target.value)}
              placeholder="Ex: 500mg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label
                htmlFor={categorySelectId}
                className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider pl-1"
              >
                Categoria
              </label>
              <select
                id={categorySelectId}
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full bg-card rounded-xl px-4 py-3 shadow-inner border border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm font-bold text-foreground"
              >
                <option className="bg-card text-foreground" value="Consultation">
                  Consulta
                </option>
                <option className="bg-card text-foreground" value="Medication">
                  Medicamento
                </option>
                <option className="bg-card text-foreground" value="Vaccine">
                  Vacina
                </option>
                <option className="bg-card text-foreground" value="Supply">
                  Material/Serviço
                </option>
              </select>
            </div>
            <Input
              label="Valor Aplicação (R$)"
              type="text"
              inputMode="decimal"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              placeholder="Ex: 50,00"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={handleAddNewInventoryItem}
            disabled={parentLoading || savingNewItem}
            className="w-full py-2"
          >
            {savingNewItem ? 'Cadastrando...' : 'Confirmar Cadastro'}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            Buscar item na maleta
          </label>
          <input
            id={searchInputId}
            type="text"
            placeholder="Buscar item na maleta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-foreground/5 rounded-2xl pl-5 pr-14 py-4 shadow-inner border border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground font-medium placeholder:text-muted-foreground transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpar busca na maleta"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 max-h-[320px] overflow-y-auto p-2 scrollbar-none rounded-3xl">
          {filteredInventory.length > 0 ? (
            filteredInventory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAddItem(item.id)}
                className="flex items-center gap-3 px-5 py-3 bg-background shadow-sm hover:shadow-inner hover:bg-foreground/5 rounded-full border border-border-strong hover:border-primary/40 transition-all duration-300 group"
              >
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-black text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest">
                      {item.type === 'Medication'
                        ? 'Medicamento'
                        : item.type === 'Vaccine'
                        ? 'Vacina'
                        : item.type === 'Consultation'
                        ? 'Consulta'
                        : 'Material'}
                    </span>
                    {item.concentration && (
                      <span className="text-[10px] font-bold text-primary">
                        • {item.concentration}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-4 w-px bg-border mx-1"></div>
                <span className="text-xs font-black text-primary transition-colors">
                  R$ {item.salePrice.toFixed(2)}
                </span>
              </button>
            ))
          ) : (
            <p className="w-full text-center py-8 text-muted-foreground text-sm font-bold italic tracking-wide">
              Nenhum item encontrado no catálogo.
            </p>
          )}
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="mt-4 p-5 rounded-2xl bg-foreground/5 shadow-inner flex flex-col gap-3 border border-primary/10 animate-in zoom-in-95 duration-300">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">
            Itens Selecionados
          </span>
          <div className="flex flex-col gap-2">
            {selectedItems.map((item) => {
              const invItem = inventory.find((i) => i.id === item.id);
              return (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 bg-card rounded-2xl border border-border hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shadow-sm border border-border">
                      {item.quantity}x
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-foreground truncate">
                        {invItem?.name || 'Item Novo'}
                      </span>
                      {invItem?.concentration && (
                        <span className="text-[11px] font-medium text-muted-foreground leading-tight">
                          {invItem.concentration}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-xs text-muted-foreground">
                      R$ {invItem ? (invItem.salePrice * item.quantity).toFixed(2) : '0.00'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Diminuir ou remover ${invItem?.name || 'item'}`}
                      className="min-w-[44px] min-h-[44px] w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-error/10 text-red-700 dark:text-red-300 hover:bg-error hover:text-error-foreground transition-all duration-200"
                    >
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M20 12H4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
