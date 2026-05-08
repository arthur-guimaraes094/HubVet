"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { agendarConsulta, atualizarConsulta } from '@/app/agenda/actions';
import { useToast } from '@/components/ui/Toast';
import { translateSpecies } from '@/core/utils/translations';
import { CancelConsultationButton } from './CancelConsultationButton';

interface Tutor {
  address: string | null;
}

interface Patient {
  id: string;
  name: string;
  species: string;
  tutors?: Tutor | Tutor[] | null;
}

interface ScheduleConsultationFormProps {
  patients: Patient[];
  itemToEdit?: {
    id: string;
    date: string;
    type: string;
    address: string | null;
    patients?: {
      id: string;
    } | null;
  };
  onClose?: () => void;
  isOpenControlled?: boolean;
}

export function ScheduleConsultationForm({ patients, itemToEdit, onClose, isOpenControlled }: ScheduleConsultationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const isEdit = !!itemToEdit;
  const effectivelyOpen = isOpenControlled !== undefined ? isOpenControlled : isOpen;

  const [formData, setFormData] = useState(() => {
    if (itemToEdit) {
      const dateObj = new Date(itemToEdit.date);
      const dateStr = dateObj.toISOString().split('T')[0];
      const timeStr = dateObj.toTimeString().split(':').slice(0, 2).join(':');
      
      return {
        patientId: itemToEdit.patients?.id || '',
        date: dateStr,
        time: timeStr,
        type: (itemToEdit.type as 'Home' | 'Hospital') || 'Home',
        address: itemToEdit.address || ''
      };
    }
    return { patientId: '', date: '', time: '', type: 'Home' as 'Home' | 'Hospital', address: '' };
  });

  const handlePatientChange = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    let address = '';
    
    if (patient?.tutors) {
      const tutorsData = patient.tutors;
      if (Array.isArray(tutorsData)) {
        address = tutorsData[0]?.address || '';
      } else {
        address = tutorsData.address || '';
      }
    }

    setFormData(prev => ({
      ...prev,
      patientId,
      address
    }));
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.date || !formData.time) {
      error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      // Use UTC adjustment or just template string carefully
      const fullDate = `${formData.date}T${formData.time}:00`;
      
      const data = {
        patientId: formData.patientId,
        date: new Date(fullDate).toISOString(),
        type: formData.type,
        address: formData.address
      };

      if (isEdit && itemToEdit) {
        await atualizarConsulta(itemToEdit.id, data);
        success('Agendamento atualizado com sucesso!');
      } else {
        await agendarConsulta(data);
        success('Consulta agendada com sucesso!');
      }
      
      handleClose();
      if (!isEdit) {
        setFormData({ patientId: '', date: '', time: '', type: 'Home', address: '' });
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao processar agendamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isEdit && (
        <Button variant="primary" onClick={() => setIsOpen(true)} className="!px-6 shadow-neu-flat">
          Agendar Consulta
        </Button>
      )}

      <Modal 
        isOpen={effectivelyOpen} 
        onClose={handleClose} 
        title={isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-foreground/60 ml-1">Paciente</label>
            <select 
              value={formData.patientId}
              onChange={(e) => handlePatientChange(e.target.value)}
              className="w-full bg-background rounded-2xl shadow-neu-pressed p-4 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground appearance-none border border-foreground/5"
              disabled={isEdit} // Optional: usually we don't change the patient of a scheduled consultation
            >
              <option value="">Selecione um paciente...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({translateSpecies(p.species)})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Input 
              label="Data" 
              type="date" 
              value={formData.date} 
              onChange={e => setFormData({ ...formData, date: e.target.value })} 
              required
            />
            <Input 
              label="Hora" 
              type="time" 
              value={formData.time} 
              onChange={e => setFormData({ ...formData, time: e.target.value })} 
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-foreground/60 ml-1">Tipo</label>
            <div className="flex gap-4">
              {['Home', 'Hospital'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: t as 'Home' | 'Hospital' })}
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

          <Input 
            label="Localização / Endereço" 
            placeholder="Rua, número, bairro..."
            value={formData.address} 
            onChange={e => setFormData({ ...formData, address: e.target.value })} 
          />

          <div className="flex gap-4 mt-2">
            {isEdit && itemToEdit && (
              <div className="flex-1">
                <CancelConsultationButton id={itemToEdit.id} />
              </div>
            )}
            <Button variant="primary" type="submit" disabled={loading} className="py-4 flex-[2]">
              {loading ? 'Processando...' : isEdit ? 'Salvar Alterações' : 'Confirmar Agendamento'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
