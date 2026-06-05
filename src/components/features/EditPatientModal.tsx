"use client";

import React, { useState, useId } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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
  const speciesSelectId = useId();

  const [patientName, setPatientName] = useState(patient.name);
  const [patientSpecies, setPatientSpecies] = useState(patient.species);
  const [patientWeight, setPatientWeight] = useState(patient.weight_kg?.toString() || '');
  const [patientBreed, setPatientBreed] = useState(patient.breed || '');
  const [patientColor, setPatientColor] = useState(patient.color || '');

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
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Editar Paciente"
      showCloseButton={false}
      maxWidth="max-w-md"
    >
      <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60 -mt-6 mb-8">{patient.name}</p>
      
      <form onSubmit={handleSave} className="flex flex-col gap-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-6 p-6 bg-foreground/2 rounded-3xl border border-foreground/3">
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
                <label 
                  htmlFor={speciesSelectId} 
                  className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4"
                >
                  Espécie *
                </label>
                <select 
                  id={speciesSelectId}
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
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 py-5! uppercase font-black text-[10px] tracking-widest">Cancelar</Button>
          <Button type="submit" variant="primary" disabled={loading} className="flex-2 py-5! shadow-sm border border-border uppercase font-black text-[10px] tracking-widest">
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
