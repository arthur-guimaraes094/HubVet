"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { addPatientAndTutor } from '@/app/pacientes/actions';

import { useToast } from '@/components/ui/Toast';

export function NewPatientForm() {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tutor
  const [tutorName, setTutorName] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');

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
  const [patientSpecies, setPatientSpecies] = useState('Canine');
  const [patientWeight, setPatientWeight] = useState('');
  const [patientBreed, setPatientBreed] = useState('');
  const [patientColor, setPatientColor] = useState('');

  if (!isOpen) {
    return (
      <Button variant="primary" onClick={() => setIsOpen(true)} className="!px-4 !py-2 text-sm">
        + Novo Paciente
      </Button>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorName || !patientName || !patientWeight) {
      error('Preencha os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    try {
      await addPatientAndTutor({
        tutorName,
        tutorPhone,
        patientName,
        patientSpecies,
        patientWeight: parseFloat(patientWeight),
        patientBreed,
        patientColor
      });
      
      success('Paciente cadastrado com sucesso!');
      setIsOpen(false);
      
      // Limpar form
      setTutorName('');
      setTutorPhone('');
      setPatientName('');
      setPatientWeight('');
      setPatientBreed('');
      setPatientColor('');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao adicionar paciente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-lg flex flex-col gap-8 max-h-[90vh] overflow-y-auto p-10 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col gap-1">
          <h3 className="text-3xl font-black text-foreground tracking-tighter">Novo Cadastro</h3>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">Tutor e Paciente</p>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col gap-8">
          {/* Dados do Tutor */}
          <div className="flex flex-col gap-6 p-6 bg-foreground/[0.02] rounded-[32px] border border-foreground/[0.03]">
            <span className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.2em] pl-2">Informações do Tutor</span>
            <div className="flex flex-col gap-4">
              <Input 
                label="Nome Completo *" 
                placeholder="Ex: João da Silva" 
                value={tutorName} 
                onChange={e => setTutorName(e.target.value)} 
                required 
              />
              <Input 
                label="WhatsApp de Contato" 
                placeholder="(11) 99999-9999" 
                value={tutorPhone} 
                onChange={handlePhoneChange}
                maxLength={15}
              />
            </div>
          </div>

          {/* Dados do Paciente */}
          <div className="flex flex-col gap-6 p-6 bg-foreground/[0.02] rounded-[32px] border border-foreground/[0.03]">
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
                  <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">Espécie</span>
                  <select 
                    value={patientSpecies} 
                    onChange={e => setPatientSpecies(e.target.value)}
                    className="w-full bg-background rounded-[28px] px-6 py-4 shadow-neu-pressed outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium transition-all border border-foreground/[0.03] appearance-none"
                  >
                    <option value="Canine">Cão</option>
                    <option value="Feline">Gato</option>
                    <option value="Other">Outros</option>
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
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} className="flex-1 !py-5">Cancelar</Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-[2] !py-5 shadow-neu-sm hover:shadow-neu-flat">
              {loading ? 'Salvando...' : 'Finalizar Cadastro'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
