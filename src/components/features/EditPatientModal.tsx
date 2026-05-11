"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updatePatient } from '@/app/pacientes/actions';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

interface Patient {
  id: string;
  name: string;
  species: string;
  weight_kg: number | null;
  breed?: string | null;
  color?: string | null;
}

interface EditPatientModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}

export function EditPatientModal({ patient, isOpen, onClose }: EditPatientModalProps) {
  const { success, error } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [patientName, setPatientName] = useState(patient.name);
  const [patientSpecies, setPatientSpecies] = useState(patient.species);
  const [patientWeight, setPatientWeight] = useState(patient.weight_kg?.toString() || '');
  const [patientBreed, setPatientBreed] = useState(patient.breed || '');
  const [patientColor, setPatientColor] = useState(patient.color || '');

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientName || !patientSpecies || !patientWeight) {
      error('Preencha os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    try {
      const result = await updatePatient(patient.id, {
        name: patientName,
        species: patientSpecies,
        weight_kg: parseFloat(patientWeight.replace(',', '.')),
        breed: patientBreed,
        color: patientColor
      });
      
      if (!result.success) {
        error(result.error || 'Erro ao atualizar paciente');
        return;
      }
      
      success('Paciente atualizado com sucesso!');
      onClose();
      router.refresh();
    } catch {
      error('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-lg flex flex-col gap-8 max-h-[90vh] overflow-y-auto p-10 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col gap-1">
          <h3 className="text-3xl font-black text-foreground tracking-tighter">Editar Paciente</h3>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">{patient.name}</p>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col gap-8">
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
                    className={`w-full bg-white rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 font-medium transition-all border border-border appearance-none ${!patientSpecies ? 'text-foreground/40' : 'text-foreground'}`}
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
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 !py-5">Cancelar</Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-[2] !py-5 shadow-sm border border-border hover:shadow-sm border border-border">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
