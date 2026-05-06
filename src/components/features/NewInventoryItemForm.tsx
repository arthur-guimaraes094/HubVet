"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { addInventoryItem } from '@/app/estoque/actions';

import { useToast } from '@/components/ui/Toast';

export function NewInventoryItemForm() {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Supply');
  const [unitCost, setUnitCost] = useState('');
  const [salePrice, setSalePrice] = useState('');

  if (!isOpen) {
    return (
      <Button variant="primary" onClick={() => setIsOpen(true)} className="!px-4 !py-2 text-sm">
        + Novo Item
      </Button>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !unitCost || !salePrice) {
      error('Preencha os campos');
      return;
    }
    
    setLoading(true);
    try {
      await addInventoryItem({
        name,
        type,
        unitCost: parseFloat(unitCost),
        salePrice: parseFloat(salePrice)
      });
      
      success('Item adicionado à maleta com sucesso!');
      setIsOpen(false);
      setName('');
      setUnitCost('');
      setSalePrice('');
    } catch (err: any) {
      error(err.message || 'Erro ao adicionar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md flex flex-col gap-4">
        <h3 className="text-xl font-bold text-primary">Cadastrar Novo Insumo</h3>
        
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input 
            label="Nome do Item" 
            placeholder="Ex: Vacina V10" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
          />
          
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-foreground/80 pl-1">Categoria</span>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)}
              className="w-full bg-background border-none rounded-xl px-4 py-3 shadow-neu-pressed focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none font-medium"
            >
              <option value="Supply">Material (Seringa, Luva)</option>
              <option value="Medication">Medicamento (Analgésico, Antibiótico)</option>
              <option value="Vaccine">Vacina</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Custo (R$)" 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={unitCost} 
              onChange={e => setUnitCost(e.target.value)} 
              required 
            />
            <Input 
              label="Preço Repasse (R$)" 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={salePrice} 
              onChange={e => setSalePrice(e.target.value)} 
              required 
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} className="w-full">Cancelar</Button>
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
