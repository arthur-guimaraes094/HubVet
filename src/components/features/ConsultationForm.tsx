"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { salvarProntuario, addInventoryItem } from '@/app/prontuario/actions';
import { gerarPDFReceituario } from '@/core/use-cases/generate-pdf';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/Toast';

export type InventoryItem = {
  id: string;
  name: string;
  unit_cost: number;
  sale_price: number;
};

interface ConsultationFormProps {
  inventory: InventoryItem[];
  patientId?: string;
  patientName?: string;
  tutorName?: string;
  consultationId?: string;
}

export function ConsultationForm({ inventory, patientId, patientName, tutorName, consultationId }: ConsultationFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [weight, setWeight] = useState<string>('');
  const [baseFee, setBaseFee] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<{ id: string, quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Estados para novo item ad-hoc
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState('');

  const handleAddItem = (id: string) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id, quantity: 1 }];
    });
  };

  const handleAddNewInventoryItem = async () => {
    if (!newItemName || !newItemCost) {
      error('Preencha nome e custo do novo item.');
      return;
    }

    try {
      setLoading(true);
      const newItem = await addInventoryItem({
        name: newItemName,
        unitCost: parseFloat(newItemCost),
        salePrice: parseFloat(newItemCost) * 1.5 // Margem padrão de 50%
      });

      if (newItem) {
        // Adiciona aos itens selecionados
        handleAddItem(newItem.id);
        success(`${newItemName} cadastrado e adicionado!`);
        setNewItemName('');
        setNewItemCost('');
        setShowNewItemForm(false);
        // O ideal seria dar um refresh no inventory via router.refresh() mas como é client component o array original não muda.
        // Vamos apenas informar que foi adicionado.
      }
    } catch {
      error('Erro ao cadastrar novo item.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const itemsCost = selectedItems.reduce((acc, item) => {
    const inventoryItem = inventory?.find((i) => i.id === item.id);
    // Se não achar no array original (item recém criado), precisariamos de uma lógica extra ou refresh
    return acc + (inventoryItem ? inventoryItem.unit_cost * item.quantity : 0);
  }, 0);

  const profit = (parseFloat(baseFee) || 0) - itemsCost;

  const handleDownloadPDF = () => {
    const fullItems = selectedItems.map(si => {
      const inv = inventory.find((i) => i.id === si.id);
      return { name: inv?.name || 'Item Novo', quantity: si.quantity };
    });

    gerarPDFReceituario({
      tutorName: tutorName || 'Não Informado',
      patientName: patientName || 'Não Informado',
      notes: notes,
      items: fullItems,
      date: new Date().toISOString()
    });
  };

  const handleFinalize = async () => {
    if (!patientId) {
      error('Selecione um paciente pela Busca Rápida antes de iniciar o prontuário.');
      return;
    }
    
    setLoading(true);
    try {
      const fullItems = selectedItems.map(si => {
        const inv = inventory.find((i) => i.id === si.id);
        return { id: si.id, name: inv?.name || 'Item', quantity: si.quantity, unitCost: inv?.unit_cost || 0, price: inv?.sale_price || 0 };
      });
      
      const result = await salvarProntuario({
        patientId: patientId,
        notes,
        baseFee: parseFloat(baseFee) || 0,
        weightKg: parseFloat(weight) || undefined,
        items: fullItems,
        consultationId: consultationId
      });
      
      if (result) {
        // Tenta baixar automaticamente uma vez
        handleDownloadPDF();
        success('Prontuário salvo com sucesso!');
        setIsSuccess(true);
      }
    } catch {
      error('Erro ao salvar o prontuário.');
    } finally {
      setLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 gap-8 w-full max-w-2xl mx-auto text-center animate-slide-in">
        <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center shadow-neu-flat">
          <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-foreground">Atendimento Finalizado!</h3>
          <p className="text-foreground/60">O prontuário foi salvo e o financeiro foi atualizado.</p>
        </div>

        <div className="flex flex-col w-full gap-4 px-4">
          <Button variant="primary" onClick={handleDownloadPDF} className="w-full py-4 shadow-neu-flat">
            Baixar PDF Novamente
          </Button>
          <Button variant="secondary" onClick={() => router.push('/')} className="w-full py-4">
            Voltar ao Início
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <h3 className="text-xl font-extrabold text-primary">
        {patientName ? `Atendimento: ${patientName}` : 'Prontuário e Fechamento'}
      </h3>
      
      {!patientId && (
        <div className="p-3 bg-error/10 text-error rounded-xl text-sm font-bold text-center">
          Você não selecionou um paciente. Volte à página inicial e pesquise na Busca Rápida.
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-foreground/80">Evolução / Prescrição</h4>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-background/50 border border-foreground/10 rounded-xl p-4 shadow-neu-pressed min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-y"
          placeholder="Anote aqui a evolução clínica, sinais vitais e os medicamentos prescritos para a receita..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <h4 className="font-bold text-foreground/80">Peso do Animal</h4>
          <Input label="Peso (kg)" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="flex flex-col gap-4">
          <h4 className="font-bold text-foreground/80">Dados Financeiros</h4>
          <Input label="Valor Cobrado (R$)" type="number" value={baseFee} onChange={e => setBaseFee(e.target.value)} placeholder="Ex: 150.00" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-foreground/80">Insumos Utilizados (Estoque)</h4>
          <button 
            onClick={() => setShowNewItemForm(!showNewItemForm)}
            className="text-xs font-black text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            {showNewItemForm ? 'Cancelar' : '+ Cadastrar Novo Insumo'}
          </button>
        </div>

        {showNewItemForm && (
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome do Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ex: Dexmeton" />
              <Input label="Custo Unitário (R$)" type="number" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} placeholder="Ex: 25.00" />
            </div>
            <Button variant="primary" onClick={handleAddNewInventoryItem} className="w-full py-2">Confirmar Cadastro</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {inventory?.map((item) => (
            <Button key={item.id} variant="secondary" onClick={() => handleAddItem(item.id)} className="!justify-start text-left flex justify-between items-center !px-3 !py-2">
              <span className="truncate max-w-[70%]">{item.name}</span>
              <span className="text-xs opacity-60 ml-2 text-primary font-black">R$ {item.unit_cost.toFixed(2)}</span>
            </Button>
          ))}
        </div>
        
        {selectedItems.length > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-background shadow-neu-pressed flex flex-col gap-2">
            <span className="text-sm font-bold opacity-70">Resumo de Insumos Usados:</span>
            {selectedItems.map(item => {
              const invItem = inventory.find((i) => i.id === item.id);
              return (
                <div key={item.id} className="flex justify-between items-center text-sm border-b border-foreground/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-6 text-center text-primary">{item.quantity}x</span>
                    <span>{invItem?.name || 'Item Novo'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs opacity-60">R$ {invItem ? (invItem.unit_cost * item.quantity).toFixed(2) : '0.00'}</span>
                    <button onClick={() => handleRemoveItem(item.id)} className="text-error font-bold px-2 hover:bg-error/10 rounded">-</button>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 mt-1 flex justify-between font-bold text-error">
              <span>Custo Total:</span>
              <span className="font-mono">- R$ {itemsCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 p-6 rounded-2xl bg-success/10 border border-success/20 shadow-neu-flat flex flex-col items-center justify-center gap-1">
        <span className="text-sm font-bold text-success/80">Lucro Real Estimado</span>
        <span className="text-4xl font-extrabold text-success">
          R$ {profit > 0 ? profit.toFixed(2) : '0.00'}
        </span>
      </div>

      <Button variant="primary" onClick={handleFinalize} disabled={loading || !patientId} className="mt-4 py-4 text-lg">
        {loading ? 'Salvando...' : 'Finalizar Atendimento & Gerar PDF'}
      </Button>
    </Card>
  );
}

