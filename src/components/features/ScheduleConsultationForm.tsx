"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { agendarConsulta } from '@/app/agenda/actions';
import { useToast } from '@/components/ui/Toast';

interface Patient {
  id: string;
  name: string;
  species: string;
}

interface ScheduleConsultationFormProps {
  patients: Patient[];
}

export function ScheduleConsultationForm({ patients }: ScheduleConsultationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    patientId: '',
    date: '',
    time: '',
    type: 'Home' as 'Home' | 'Hospital'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.date || !formData.time) {
      error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const fullDate = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      await agendarConsulta({
        patientId: formData.patientId,
        date: fullDate,
        type: formData.type
      });
      
      success('Consulta agendada com sucesso!');
      setIsOpen(false);
      setFormData({ patientId: '', date: '', time: '', type: 'Home' });
    } catch (e) {
      error('Erro ao agendar consulta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)} className="!px-6 shadow-neu-flat">
        Agendar Consulta
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Novo Agendamento">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-foreground/60 ml-1">Paciente</label>
            <select 
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
              className="w-full bg-background rounded-2xl shadow-neu-pressed p-4 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground appearance-none border border-foreground/5"
            >
              <option value="">Selecione um paciente...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Input 
              label="Data" 
              type="date" 
              value={formData.date} 
              onChange={e => setFormData({ ...formData, date: e.target.value })} 
            />
            <Input 
              label="Hora" 
              type="time" 
              value={formData.time} 
              onChange={e => setFormData({ ...formData, time: e.target.value })} 
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-foreground/60 ml-1">Tipo</label>
            <div className="flex gap-4">
              {['Home', 'Hospital'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: t as any })}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    formData.type === t 
                    ? 'bg-primary text-white shadow-neu-pressed' 
                    : 'bg-background text-foreground shadow-neu-sm hover:shadow-neu-pressed'
                  }`}
                >
                  {t === 'Home' ? '🏠 Domicílio' : '🏥 Hospital'}
                </button>
              ))}
            </div>
          </div>

          <Button variant="primary" type="submit" disabled={loading} className="py-4 mt-2">
            {loading ? 'Agendando...' : 'Confirmar Agendamento'}
          </Button>
        </form>
      </Modal>
    </>
  );
}
