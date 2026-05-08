"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { salvarProntuario } from '@/app/prontuario/actions';
import { addInventoryItem } from '@/app/estoque/actions';
import { gerarPDFReceituario } from '@/core/use-cases/generate-pdf';
import { translateSpecies } from '@/core/utils/translations';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/infrastructure/database/client';
import Image from 'next/image';

export type InventoryItem = {
  id: string;
  name: string;
  type: 'Medication' | 'Vaccine' | 'Material' | 'Consultation';
  unitCost: number;
  salePrice: number;
  concentration?: string;
};

interface ConsultationFormProps {
  inventory: InventoryItem[];
  patientId?: string;
  patientName?: string;
  tutorName?: string;
  species?: string;
  breed?: string;
  color?: string;
  consultationId?: string;
  lastWeight?: number;
}

export function ConsultationForm({ inventory, patientId, patientName, tutorName, species, breed, color, consultationId, lastWeight }: ConsultationFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [weight, setWeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<{ id: string, quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [consultationType, setConsultationType] = useState<'Home' | 'Hospital'>('Home');

  // Estados para novo item ad-hoc
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemConcentration, setNewItemConcentration] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Medication');

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
    if (!newItemName || !newItemPrice) {
      error('Preencha nome e valor de aplicação do novo item.');
      return;
    }

    try {
      setLoading(true);
      const result = await addInventoryItem({
        name: newItemName,
        type: newItemCategory as 'Medication' | 'Vaccine' | 'Material' | 'Consultation',
        concentration: newItemConcentration,
        unitCost: parseFloat(newItemPrice) * 0.5, // Estimativa de custo para lucro
        salePrice: parseFloat(newItemPrice),
      });

      if (result.success) {
        success(`${newItemName} cadastrado no catálogo!`);
        setNewItemName('');
        setNewItemPrice('');
        setNewItemConcentration('');
        setShowNewItemForm(false);
        router.refresh();
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

  const totalValue = selectedItems.reduce((acc, item) => {
    const inventoryItem = inventory?.find((i) => i.id === item.id);
    return acc + (inventoryItem ? inventoryItem.salePrice * item.quantity : 0);
  }, 0);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      error('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploadingImage(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('consultations')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('consultations')
        .getPublicUrl(fileName);

      setImages(prev => [...prev, publicUrl]);
      success('Imagem adicionada!');
    } catch (err) {
      console.error(err);
      error('Erro ao subir imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const [showSuccess, setShowSuccess] = useState(false);

  const handleDownloadPDF = () => {
    const fullItems = selectedItems
      .map(si => {
        const item = inventory.find(i => i.id === si.id);
        return { name: item?.name || 'Item', quantity: si.quantity, type: item?.type };
      })
      .filter(item => item.type !== 'Consultation')
      .map(({ name, quantity }) => ({ name, quantity }));

    gerarPDFReceituario({
      tutorName: tutorName || 'Não Informado',
      patientName: patientName || 'Não Informado',
      species: translateSpecies(species || ''),
      breed: breed || '',
      color: color || '',
      weight: weight,
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
        return { id: si.id, name: inv?.name || 'Item', quantity: si.quantity, unitCost: inv?.unitCost || 0, price: inv?.salePrice || 0 };
      });
      
      const result = await salvarProntuario({
        patientId: patientId,
        notes,
        baseFee: totalValue, // Agora o valor base é a soma dos itens
        weightKg: weight ? parseFloat(weight) : lastWeight,
        items: fullItems,
        consultationId: consultationId,
        completionDate: new Date().toISOString(),
        images: images,
        type: consultationType
      });
      
      if (result) {
        success('Prontuário salvo e estoque atualizado!');
        setShowSuccess(true);
        // Não redirecionamos mais automaticamente para não quebrar o download no iOS
      }
    } finally {
      setLoading(false);
    }
  }

  const [searchTerm, setSearchTerm] = useState('');

  if (showSuccess) {
    return (
      <Card className="flex flex-col items-center justify-center gap-8 py-16 text-center w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
        <div className="text-6xl animate-bounce">
          ✅
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black text-foreground tracking-tight">Atendimento Finalizado!</h2>
          <p className="text-foreground/40 font-medium">O prontuário foi salvo com sucesso e o estoque foi atualizado.</p>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Button 
            variant="primary" 
            onClick={handleDownloadPDF} 
            className="w-full py-4 text-lg shadow-neu-sm hover:shadow-neu-flat flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar Receita (PDF)
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={() => router.push('/')} 
            className="w-full py-4 text-lg flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Voltar ao Início
          </Button>
        </div>
      </Card>
    );
  }



  const filteredInventory = inventory?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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

      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-foreground/80 flex items-center gap-2">
          Imagens e Anexos 
          {uploadingImage && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
        </h4>
        <div className="flex flex-wrap gap-4">
          {images.map((url, i) => (
            <div key={i} className="relative group w-24 h-24 rounded-2xl overflow-hidden shadow-neu-pressed bg-foreground/5 border border-foreground/5">
              <Image src={url} alt="Anexo" fill className="object-cover" />
              <button 
                onClick={() => removeImage(i)}
                className="absolute inset-0 bg-error/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-foreground/10 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group">
            <svg className="w-6 h-6 text-foreground/20 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] font-black text-foreground/30 group-hover:text-primary/60 uppercase tracking-tighter">Adicionar</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
          </label>
        </div>
      </div>

      {!consultationId && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-foreground/60 ml-1">Tipo de Atendimento</label>
          <div className="flex gap-4">
            {(['Home', 'Hospital'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setConsultationType(t)}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  consultationType === t 
                  ? 'bg-primary text-white shadow-neu-pressed' 
                  : 'bg-background text-foreground shadow-neu-sm hover:shadow-neu-pressed'
                }`}
              >
                {t === 'Home' ? '🏠 Domicílio' : '🏥 Hospital'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-foreground/80">Peso do Animal</h4>
        <Input label="Peso (kg)" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Opcional" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-foreground/80">Insumos Utilizados (Catálogo)</h4>
          <button 
            onClick={() => setShowNewItemForm(!showNewItemForm)}
            className="text-xs font-black text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            {showNewItemForm ? 'Cancelar' : '+ Cadastrar Novo'}
          </button>
        </div>

        {showNewItemForm && (
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome do Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ex: Vacina V10" />
              <Input label="Concentração (Opcional)" value={newItemConcentration} onChange={e => setNewItemConcentration(e.target.value)} placeholder="Ex: 500mg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-foreground/30 uppercase tracking-widest pl-1">Categoria</label>
                <select 
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full bg-background border-none rounded-xl px-4 py-3 shadow-neu-pressed focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold text-foreground"
                >
                  <option value="Consultation">Consulta</option>
                  <option value="Medication">Medicamento</option>
                  <option value="Vaccine">Vacina</option>
                  <option value="Material">Material/Serviço</option>
                </select>
              </div>
              <Input label="Valor Aplicação (R$)" type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} placeholder="Ex: 50.00" />
            </div>
            <Button variant="primary" onClick={handleAddNewInventoryItem} className="w-full py-2">Confirmar Cadastro</Button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="relative">
            <input 
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border-none rounded-[28px] px-6 py-4 shadow-neu-pressed focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium placeholder:text-foreground/30 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 max-h-[320px] overflow-y-auto p-2 scrollbar-none rounded-[32px]">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <button 
                  key={item.id} 
                  onClick={() => handleAddItem(item.id)} 
                  className="flex items-center gap-3 px-5 py-3 bg-background shadow-neu-flat hover:shadow-neu-pressed rounded-full border border-foreground/[0.03] hover:border-primary/20 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-start leading-tight">
                    <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{item.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-black opacity-40 group-hover:opacity-60 transition-opacity uppercase tracking-widest">
                        {item.type === 'Medication' ? 'Medicamento' : item.type === 'Vaccine' ? 'Vacina' : 'Material'}
                      </span>
                      {item.concentration && (
                        <span className="text-[9px] font-bold text-primary/40 group-hover:text-primary/60">• {item.concentration}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-4 w-px bg-foreground/5 group-hover:bg-primary/10 mx-1"></div>
                  <span className="text-xs font-black text-primary/40 group-hover:text-primary transition-colors">
                    R$ {item.salePrice.toFixed(2)}
                  </span>
                </button>
              ))
            ) : (
              <p className="w-full text-center py-8 text-foreground/20 text-sm font-bold italic tracking-wide">
                Nenhum item encontrado no catálogo.
              </p>
            )}
          </div>
        </div>
        
        {selectedItems.length > 0 && (
          <div className="mt-4 p-5 rounded-[28px] bg-background shadow-neu-pressed flex flex-col gap-3 border border-primary/5 animate-in zoom-in-95 duration-300">
            <span className="text-xs font-black text-foreground/40 uppercase tracking-widest pl-1">Itens Selecionados</span>
            <div className="flex flex-col gap-2">
              {selectedItems.map(item => {
                const invItem = inventory.find((i) => i.id === item.id);
                return (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-foreground/5 rounded-2xl border border-transparent hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shadow-neu-sm">
                        {item.quantity}x
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{invItem?.name || 'Item Novo'}</span>
                        {invItem?.concentration && (
                          <span className="text-[10px] font-medium text-foreground/40 leading-none">{invItem.concentration}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-xs text-foreground/60">R$ {invItem ? (invItem.salePrice * item.quantity).toFixed(2) : '0.00'}</span>
                      <button 
                        onClick={() => handleRemoveItem(item.id)} 
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-white transition-all duration-200"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" />
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

      <div className="mt-6 p-8 rounded-[32px] bg-gradient-to-br from-success/5 to-success/15 border border-success/20 shadow-neu-flat flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-success/10 transition-colors"></div>
        <span className="text-xs font-black text-success/60 uppercase tracking-[0.2em] relative z-10">Valor da Consulta</span>
        <div className="flex items-baseline gap-1 relative z-10">
          <span className="text-lg font-black text-success/60">R$</span>
          <span className="text-5xl font-extrabold text-success tracking-tighter">
            {totalValue > 0 ? totalValue.toFixed(2) : '0.00'}
          </span>
        </div>
      </div>

      <Button variant="primary" onClick={handleFinalize} disabled={loading || !patientId} className="mt-4 py-4 text-lg">
        {loading ? 'Salvando...' : 'Finalizar Atendimento & Gerar PDF'}
      </Button>
    </Card>
  );
}

