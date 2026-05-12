"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { addPatientAndTutor, getTutors } from '@/app/pacientes/actions';

import { useToast } from '@/components/ui/Toast';

interface Tutor {
  id: string;
  name: string;
}

interface NewPatientFormProps {
  initialTutorId?: string;
  initialTutorName?: string;
}

export function NewPatientForm({ initialTutorId, initialTutorName }: NewPatientFormProps) {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tutor
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [tutorSelectionMode, setTutorSelectionMode] = useState<'new' | 'existing'>(initialTutorId ? 'existing' : 'new');
  const [selectedTutorId, setSelectedTutorId] = useState(initialTutorId || '');
  const [tutorName, setTutorName] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');
  const [tutorCpf, setTutorCpf] = useState('');

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length <= 3) {
      setTutorCpf(value);
    } else if (value.length <= 6) {
      setTutorCpf(`${value.slice(0, 3)}.${value.slice(3)}`);
    } else if (value.length <= 9) {
      setTutorCpf(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`);
    } else {
      setTutorCpf(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      const fetchTutors = async () => {
        const data = await getTutors();
        setTutors(data as unknown as Tutor[]);
      };
      fetchTutors();
    }
  }, [isOpen]);


  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não for número
    if (value.length > 11) value = value.slice(0, 11); // Limite de 11 dígitos

    if (value.length <= 2) {
      setTutorPhone(value);
      return;
    }

    const ddd = value.slice(0, 2);
    const part1 = value.slice(2, value.length <= 10 ? 6 : 7);
    const part2 = value.slice(value.length <= 10 ? 6 : 7);

    if (part2) {
      setTutorPhone(`(${ddd}) ${part1}-${part2}`);
    } else {
      setTutorPhone(`(${ddd}) ${part1}`);
    }
  };
  
  // Paciente
  const [patientName, setPatientName] = useState('');
  const [patientSpecies, setPatientSpecies] = useState('');
  const [patientWeight, setPatientWeight] = useState('');
  const [patientBreed, setPatientBreed] = useState('');
  const [patientColor, setPatientColor] = useState('');

  // Searchable Tutor
  const [tutorSearch, setTutorSearch] = useState(initialTutorName || '');
  const [isTutorListOpen, setIsTutorListOpen] = useState(false);

  const filteredTutors = tutors.filter(t => 
    t.name.toLowerCase().includes(tutorSearch.toLowerCase())
  );

  const handleSelectTutor = (tutor: Tutor) => {
    setSelectedTutorId(tutor.id);
    setTutorSearch(tutor.name);
    setIsTutorListOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tutorSelectionMode === 'new' && !tutorName) {
      error('Nome do tutor é obrigatório');
      return;
    }
    
    if (tutorSelectionMode === 'existing' && !selectedTutorId) {
      error('Selecione um tutor existente');
      return;
    }

    if (!patientName || !patientSpecies || !patientWeight) {
      error('Preencha os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    try {
      const result = await addPatientAndTutor({
        tutorId: tutorSelectionMode === 'existing' ? selectedTutorId : undefined,
        tutorName: tutorSelectionMode === 'new' ? tutorName : undefined,
        tutorPhone: tutorSelectionMode === 'new' ? tutorPhone : undefined,
        tutorCpf: tutorSelectionMode === 'new' ? tutorCpf : undefined,
        patientName,
        patientSpecies,
        patientWeight: (patientWeight && !isNaN(parseFloat(patientWeight.replace(',', '.')))) ? parseFloat(patientWeight.replace(',', '.')) : 0,
        patientBreed,
        patientColor
      });
      
      if (!result.success) {
        error(result.error);
        return;
      }
      
      success('Paciente cadastrado com sucesso!');
      setIsOpen(false);
      
      // Limpar form
      setSelectedTutorId('');
      setTutorSearch('');
      setTutorName('');
      setTutorPhone('');
      setTutorCpf('');
      setPatientName('');
      setPatientSpecies('');
      setPatientWeight('');
      setPatientBreed('');
      setPatientColor('');
    } catch {
      error('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)} className="!px-4 !py-2 text-sm">
        + Novo Paciente
      </Button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title="Novo Cadastro"
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60 -mt-6 mb-8">Tutor e Paciente</p>
        
        <form onSubmit={handleSave} className="flex flex-col gap-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Dados do Tutor */}
          <div className="flex flex-col gap-6 p-6 bg-foreground/[0.02] rounded-3xl border border-foreground/[0.03]">
            <div className="flex justify-between items-center px-2">
              <span className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.2em]">Responsável</span>
              <div className="flex bg-background shadow-inner border border-border bg-foreground/5 p-0.5 rounded-full border border-foreground/5 scale-90">
                <button 
                  type="button"
                  onClick={() => setTutorSelectionMode('new')}
                  className={`p-1.5 px-3 rounded-full transition-all text-[8px] font-black uppercase tracking-widest ${tutorSelectionMode === 'new' ? 'bg-primary text-white shadow-sm' : 'text-foreground/40'}`}
                >
                  Novo
                </button>
                <button 
                  type="button"
                  onClick={() => setTutorSelectionMode('existing')}
                  className={`p-1.5 px-3 rounded-full transition-all text-[8px] font-black uppercase tracking-widest ${tutorSelectionMode === 'existing' ? 'bg-primary text-white shadow-sm' : 'text-foreground/40'}`}
                >
                  Existente
                </button>
              </div>
            </div>

            {tutorSelectionMode === 'new' ? (
              <div className="flex flex-col gap-4">
                <Input 
                  label="Nome Completo *" 
                  placeholder="Ex: João da Silva" 
                  value={tutorName} 
                  onChange={e => setTutorName(e.target.value)} 
                  required 
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="CPF" 
                    placeholder="000.000.000-00" 
                    value={tutorCpf} 
                    onChange={handleCpfChange}
                    maxLength={14}
                  />
                  <Input 
                    label="WhatsApp" 
                    placeholder="(11) 99999-9999" 
                    value={tutorPhone} 
                    onChange={handlePhoneChange}
                    maxLength={15}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 relative">
                <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">Pesquisar Tutor</span>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Digite o nome do tutor..."
                    value={tutorSearch}
                    onChange={(e) => {
                      setTutorSearch(e.target.value);
                      setSelectedTutorId(''); // Reset selection if typing
                      setIsTutorListOpen(true);
                    }}
                    onFocus={() => setIsTutorListOpen(true)}
                    className="w-full bg-background rounded-2xl px-6 py-4 shadow-inner border border-border bg-foreground/5 outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium transition-all border border-foreground/[0.03]"
                    required={tutorSelectionMode === 'existing'}
                  />
                  {isTutorListOpen && tutorSearch && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-2 bg-background border border-border rounded-2xl shadow-xl max-h-60 overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2">
                      {filteredTutors.length > 0 ? (
                        filteredTutors.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTutor(t)}
                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all font-medium text-sm flex items-center justify-between"
                          >
                            {t.name}
                            <span className="text-[10px] opacity-40">Selecionar</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-foreground/40 italic">
                          Nenhum tutor encontrado
                        </div>
                      )}
                    </div>
                  )}
                  {/* Click outside to close inner list */}
                  {isTutorListOpen && (
                    <div className="fixed inset-0 z-10" onClick={() => setIsTutorListOpen(false)} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dados do Paciente */}
          <div className="flex flex-col gap-6 p-6 bg-foreground/[0.02] rounded-3xl border border-foreground/[0.03]">
            <span className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.2em] pl-2">Informações do Pet</span>
            <div className="flex flex-col gap-4">
              <Input 
                label="Nome do Pet *" 
                placeholder="Ex: Rex" 
                value={patientName} 
                onChange={e => setPatientName(e.target.value)} 
                required 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">Espécie *</span>
                  <select 
                    value={patientSpecies} 
                    onChange={e => setPatientSpecies(e.target.value)}
                    required
                    className={`w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 font-medium transition-all border border-border appearance-none ${!patientSpecies ? 'text-foreground/40' : 'text-foreground'}`}
                  >
                    <option value=""></option>
                    <option value="Canine" className="text-foreground">Cão</option>
                    <option value="Feline" className="text-foreground">Gato</option>
                    <option value="Other" className="text-foreground">Outros</option>
                  </select>
                </div>

                <Input 
                  label="Peso (kg) *" 
                  type="number" 
                  step="0.01" 
                  placeholder="0.0" 
                  value={patientWeight} 
                  onChange={e => setPatientWeight(e.target.value)} 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Raça" 
                  placeholder="Poodle" 
                  value={patientBreed} 
                  onChange={e => setPatientBreed(e.target.value)} 
                />
                <Input 
                  label="Pelagem" 
                  placeholder="Branco" 
                  value={patientColor} 
                  onChange={e => setPatientColor(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} className="flex-1 !py-5 uppercase font-black text-[10px] tracking-widest">Cancelar</Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-[2] !py-5 shadow-sm border border-border uppercase font-black text-[10px] tracking-widest">
              {loading ? 'Salvando...' : 'Finalizar Cadastro'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
