"use client";

import React, { useState, useId } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { agendarConsulta, atualizarConsulta } from '@/app/agenda/actions';
import { useToast } from '@/components/ui/Toast';
import { translateSpecies } from '@/core/utils/translations';
import { buildGoogleMapsUrl } from '@/core/utils/cep';

interface Tutor {
  name?: string;
  address?: string | null;
  phone?: string | null;
}

interface Patient {
  id: string;
  name: string;
  species: string;
  tutors?: Tutor | Tutor[] | null;
}

interface TravelEstimate {
  oneWayKm: number;
  roundTripKm: number;
  kmRate: number;
  recommendedFee: number;
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
      name: string;
      species: string;
      tutors?: Tutor | null;
    } | null;
  };
  onClose?: () => void;
  isOpenControlled?: boolean;
}

export function ScheduleConsultationForm({
  patients,
  itemToEdit,
  onClose,
  isOpenControlled,
}: ScheduleConsultationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { success, error } = useToast();

  const isEdit = !!itemToEdit;
  const effectivelyOpen = isOpenControlled !== undefined ? isOpenControlled : isOpen;
  const patientSelectId = useId();

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
        address: itemToEdit.address || itemToEdit.patients?.tutors?.address || '',
      };
    }
    return {
      patientId: '',
      date: '',
      time: '',
      type: 'Home' as 'Home' | 'Hospital',
      address: '',
    };
  });

  const [travelEstimate, setTravelEstimate] = useState<TravelEstimate | null>(null);
  const [calculatingTravel, setCalculatingTravel] = useState(false);

  const calculateTravelForAddress = async (addr: string) => {
    if (!addr || !addr.trim()) {
      setTravelEstimate(null);
      return;
    }
    setCalculatingTravel(true);
    try {
      const res = await fetch('/api/travel-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationAddress: addr }),
      });
      if (res.ok) {
        const data = (await res.json()) as TravelEstimate;
        setTravelEstimate(data);
      } else {
        setTravelEstimate(null);
      }
    } catch {
      setTravelEstimate(null);
    } finally {
      setCalculatingTravel(false);
    }
  };

  const handlePatientChange = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    let address = '';

    if (patient?.tutors) {
      const tutorsData = patient.tutors;
      if (Array.isArray(tutorsData)) {
        address = tutorsData[0]?.address || '';
      } else {
        address = tutorsData.address || '';
      }
    }

    setFormData((prev) => ({
      ...prev,
      patientId,
      address,
    }));

    if (address && formData.type === 'Home') {
      calculateTravelForAddress(address);
    } else {
      setTravelEstimate(null);
    }
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
    setSubmitError(null);
    try {
      const fullDate = `${formData.date}T${formData.time}:00`;

      const data = {
        patientId: formData.patientId,
        date: new Date(fullDate).toISOString(),
        type: formData.type,
        address: formData.address,
        travelDistanceKm: travelEstimate?.roundTripKm ?? null,
        travelFee: travelEstimate?.recommendedFee ?? 0,
      };

      if (isEdit && itemToEdit) {
        const result = await atualizarConsulta(itemToEdit.id, data);
        if (!result.success) {
          error(result.error);
          setSubmitError(result.error);
          return;
        }
        success('Agendamento atualizado com sucesso!');
      } else {
        const result = await agendarConsulta(data);
        if (!result.success) {
          error(result.error);
          setSubmitError(result.error);
          return;
        }
        success('Consulta agendada com sucesso!');
      }

      handleClose();
      if (!isEdit) {
        setFormData({ patientId: '', date: '', time: '', type: 'Home', address: '' });
        setTravelEstimate(null);
      }
    } catch {
      error('Erro ao processar agendamento');
      setSubmitError('Erro ao processar agendamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isEdit && (
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
          className="px-6! shadow-sm border border-border"
        >
          Agendar Consulta
        </Button>
      )}

      <Modal
        isOpen={effectivelyOpen}
        onClose={handleClose}
        title={isEdit ? 'Editar Consulta' : 'Nova Consulta'}
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor={patientSelectId}
              className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4"
            >
              Paciente
            </label>
            {isEdit ? (
              <div className="w-full bg-foreground/5 border border-border rounded-2xl px-5 py-4 text-foreground/40 font-black italic">
                {itemToEdit?.patients?.name} (
                {translateSpecies(itemToEdit?.patients?.species || '')})
              </div>
            ) : (
              <select
                id={patientSelectId}
                value={formData.patientId}
                onChange={(e) => handlePatientChange(e.target.value)}
                className="w-full bg-card rounded-2xl shadow-inner border border-border p-4 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground appearance-none"
              >
                <option className="bg-card text-foreground" value="">
                  Selecione um paciente...
                </option>
                {patients.map((p) => (
                  <option className="bg-card text-foreground" key={p.id} value={p.id}>
                    {p.name} ({translateSpecies(p.species)})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              label="Data"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Hora"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">
              Tipo
            </span>
            <div className="flex gap-4" role="group" aria-label="Tipo de Atendimento">
              {(['Home', 'Hospital'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, type: t });
                    if (t === 'Home' && formData.address) {
                      calculateTravelForAddress(formData.address);
                    } else if (t === 'Hospital') {
                      setTravelEstimate(null);
                    }
                  }}
                  aria-pressed={formData.type === t}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    formData.type === t
                      ? 'bg-primary text-white shadow-inner border border-border'
                      : 'bg-background text-foreground shadow-sm border border-border hover:shadow-inner'
                  }`}
                >
                  {t === 'Home' ? '🏠 Domicílio' : '🏥 Hospital'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Input
              label="Localização / Residência do Tutor"
              placeholder="Rua, número, bairro, CEP..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />

            {formData.type === 'Home' && formData.address && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => calculateTravelForAddress(formData.address)}
                  disabled={calculatingTravel}
                  className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  {calculatingTravel
                    ? 'Calculando rota...'
                    : '🚗 Calcular Custo de Deslocamento'}
                </button>

                <a
                  href={buildGoogleMapsUrl(formData.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors"
                >
                  🗺️ Ver no Mapa
                </a>
              </div>
            )}

            {formData.type === 'Home' && travelEstimate && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-1 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    🚗 Deslocamento Recomendado (Ida e Volta)
                  </span>
                  <span className="text-sm font-black text-emerald-700">
                    R$ {travelEstimate.recommendedFee.toFixed(2)}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-foreground/60">
                  Distância: {travelEstimate.oneWayKm} km (ida) •{' '}
                  <strong>{travelEstimate.roundTripKm} km (ida/volta)</strong> × R${' '}
                  {travelEstimate.kmRate.toFixed(2)}/km
                </span>
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-bold text-center animate-in fade-in slide-in-from-bottom-2">
              {submitError}
            </div>
          )}
          <div className="flex gap-4 mt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={handleClose}
              className="py-5 flex-1 font-black uppercase tracking-widest text-[10px]"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              className="py-5 flex-2 font-black uppercase tracking-widest text-[10px]"
            >
              {loading
                ? 'Processando...'
                : isEdit
                ? 'Salvar Alterações'
                : 'Confirmar Agendamento'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
