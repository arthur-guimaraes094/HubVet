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
        patientWeight: parseFloat(patientWeight)
      });
      
      success('Paciente cadastrado com sucesso!');
      setIsOpen(false);
      
      // Limpar form
      setTutorName('');
      setTutorPhone('');
      setPatientName('');
      setPatientWeight('');
    } catch (err: any) {
      error(err.message || 'Erro ao adicionar paciente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-primary">Cadastrar Novo Paciente</h3>
        
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Dados do Tutor */}
          <div className="flex flex-col gap-3 p-4 bg-background/50 rounded-xl border border-foreground/5">
            <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Dados do Tutor</span>
            <Input 
              label="Nome Completo *" 
              placeholder="Ex: João da Silva" 
              value={tutorName} 
              onChange={e => setTutorName(e.target.value)} 
              required 
            />
            <Input 
              label="WhatsApp" 
              placeholder="(11) 99999-9999" 
              value={tutorPhone} 
              onChange={handlePhoneChange}
              maxLength={15}
            />
          </div>

          {/* Dados do Paciente */}
          <div className="flex flex-col gap-3 p-4 bg-background/50 rounded-xl border border-foreground/5">
            <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Dados do Paciente</span>
            <Input 
              label="Nome do Pet *" 
              placeholder="Ex: Rex" 
              value={patientName} 
              onChange={e => setPatientName(e.target.value)} 
              required 
            />
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-foreground/80 pl-1">Espécie</span>
                <select 
                  value={patientSpecies} 
                  onChange={e => setPatientSpecies(e.target.value)}
                  className="w-full bg-background border-none rounded-xl px-4 py-3 shadow-neu-pressed focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none font-medium"
                >
                  <option value="Canine">Canina (Cão)</option>
                  <option value="Feline">Felina (Gato)</option>
                  <option value="Other">Outros / Silvestre</option>
                </select>
              </div>

              <Input 
                label="Peso (kg) *" 
                type="number" 
                step="0.01" 
                placeholder="Ex: 15.5" 
                value={patientWeight} 
                onChange={e => setPatientWeight(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="flex gap-3 mt-2">
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
