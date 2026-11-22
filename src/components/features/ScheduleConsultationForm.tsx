"use client";

import React, { useState, useId, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { agendarConsulta, atualizarConsulta } from '@/app/agenda/actions';
import { useToast } from '@/components/ui/Toast';
import { translateSpecies } from '@/core/utils/translations';
import { buildGoogleMapsUrl } from '@/core/utils/cep';
import { getBrazilDateString, getBrazilTimeString } from '@/core/utils/timezone';

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
  oneWayKm: number | null;
  roundTripKm: number | null;
  kmRate: number | null;
  recommendedFee: number;
}

interface ScheduleConsultationFormProps {
  patients: Patient[];
  itemToEdit?: {
    id: string;
    date: string;
    type: string;
    address: string | null;
    travel_distance_km?: number | null;
    travel_fee?: number | null;
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

function buildInitialTravelEstimate(
  itemToEdit?: ScheduleConsultationFormProps['itemToEdit']
): TravelEstimate | null {
  if (!itemToEdit || itemToEdit.type !== 'Home') return null;

  const hasFee =
    itemToEdit.travel_fee !== null && itemToEdit.travel_fee !== undefined;
  const hasDist =
    itemToEdit.travel_distance_km !== null && itemToEdit.travel_distance_km !== undefined;

  if (!hasFee && !hasDist) return null;

  const fee = hasFee ? Number(itemToEdit.travel_fee) : 0;
  const dist = hasDist ? Number(itemToEdit.travel_distance_km) : null;
  const safeFee = Number.isFinite(fee) ? fee : 0;
  const safeDist = dist !== null && Number.isFinite(dist) ? dist : null;

  if (safeFee === 0 && safeDist === null) return null;

  return {
    oneWayKm: safeDist !== null ? Number((safeDist / 2).toFixed(1)) : null,
    roundTripKm: safeDist,
    kmRate:
      safeDist !== null && safeDist > 0 && safeFee > 0
        ? Number((safeFee / safeDist).toFixed(2))
        : null,
    recommendedFee: safeFee,
  };
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
  const travelAbortRef = useRef<AbortController | null>(null);

  const initialEditAddress = itemToEdit
    ? itemToEdit.address || itemToEdit.patients?.tutors?.address || ''
    : '';
  const initialEditTravelEstimate = buildInitialTravelEstimate(itemToEdit);

  const [formData, setFormData] = useState(() => {
    if (itemToEdit) {
      const dateObj = new Date(itemToEdit.date);
      const valid = !Number.isNaN(dateObj.getTime());
      const dateStr = valid ? getBrazilDateString(dateObj) : '';
      const timeStr = valid ? getBrazilTimeString(dateObj) : '';

      return {
        patientId: itemToEdit.patients?.id || '',
        date: dateStr,
        time: timeStr,
        type: (itemToEdit.type as 'Home' | 'Hospital') || 'Home',
        address: initialEditAddress,
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

  const [travelEstimate, setTravelEstimate] = useState<TravelEstimate | null>(
    () => initialEditTravelEstimate
  );
  const [calculatingTravel, setCalculatingTravel] = useState(false);

  useEffect(() => {
    return () => {
      travelAbortRef.current?.abort();
    };
  }, []);

  const calculateTravelForAddress = async (addr: string) => {
    travelAbortRef.current?.abort();

    if (!addr || !addr.trim()) {
      travelAbortRef.current = null;
      setTravelEstimate(null);
      setCalculatingTravel(false);
      return;
    }

    const controller = new AbortController();
    travelAbortRef.current = controller;
    setCalculatingTravel(true);

    try {
      const res = await fetch('/api/travel-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationAddress: addr }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        setTravelEstimate(null);
        error(data?.error || 'Não foi possível calcular o custo de deslocamento.');
        return;
      }

      setTravelEstimate(data as TravelEstimate);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (controller.signal.aborted) return;
      setTravelEstimate(null);
      error('Erro ao calcular custo de deslocamento.');
    } finally {
      if (travelAbortRef.current === controller) {
        travelAbortRef.current = null;
        setCalculatingTravel(false);
      }
    }
  };

  const handlePatientChange = (patientId: string) => {
    travelAbortRef.current?.abort();
    travelAbortRef.current = null;
    setCalculatingTravel(false);
    setTravelEstimate(null);

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
    }
  };

  const handleClose = () => {
    travelAbortRef.current?.abort();
    travelAbortRef.current = null;
    setCalculatingTravel(false);
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

    const normalizedTime =
      formData.time.length === 5 ? `${formData.time}:00` : formData.time;
    const brtDate = new Date(`${formData.date}T${normalizedTime}-03:00`);
    if (
      Number.isNaN(brtDate.getTime()) ||
      getBrazilDateString(brtDate) !== formData.date
    ) {
      error('Data ou horário inválido.');
      return;
    }

    const isoDateTime = brtDate.toISOString();

    setLoading(true);
    setSubmitError(null);
    try {
      const data = {
        patientId: formData.patientId,
        date: isoDateTime,
        type: formData.type,
        address: formData.address,
        travelDistanceKm:
          formData.type === 'Home' ? (travelEstimate?.roundTripKm ?? null) : null,
        travelFee:
          formData.type === 'Home' ? (travelEstimate?.recommendedFee ?? 0) : 0,
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
                    setFormData((prev) => ({ ...prev, type: t }));
                    if (t === 'Home') {
                      if (
                        isEdit &&
                        initialEditTravelEstimate &&
                        initialEditAddress.trim() !== '' &&
                        formData.address.trim() === initialEditAddress.trim()
                      ) {
                        setTravelEstimate(initialEditTravelEstimate);
                      } else if (formData.address) {
                        calculateTravelForAddress(formData.address);
                      }
                    } else {
                      travelAbortRef.current?.abort();
                      travelAbortRef.current = null;
                      setCalculatingTravel(false);
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
              onChange={(e) => {
                const nextAddress = e.target.value;
                travelAbortRef.current?.abort();
                travelAbortRef.current = null;
                setCalculatingTravel(false);
                setFormData((prev) => ({ ...prev, address: nextAddress }));
                if (
                  isEdit &&
                  initialEditTravelEstimate &&
                  initialEditAddress.trim() !== '' &&
                  nextAddress.trim() === initialEditAddress.trim()
                ) {
                  setTravelEstimate(initialEditTravelEstimate);
                } else {
                  setTravelEstimate(null);
                }
              }}
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

            {formData.type === 'Home' &&
              travelEstimate &&
              (travelEstimate.recommendedFee > 0 || (travelEstimate.roundTripKm ?? 0) > 0) && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-1 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      🚗 Deslocamento Recomendado (Ida e Volta)
                    </span>
                    <span className="text-sm font-black text-emerald-700">
                      R$ {travelEstimate.recommendedFee.toFixed(2)}
                    </span>
                  </div>
                  {travelEstimate.roundTripKm !== null && travelEstimate.roundTripKm > 0 && (
                    <span className="text-[11px] font-medium text-foreground/60">
                      {travelEstimate.oneWayKm !== null
                        ? `Distância: ${travelEstimate.oneWayKm} km (ida) • `
                        : 'Distância: '}
                      <strong>{travelEstimate.roundTripKm} km (ida/volta)</strong>
                      {travelEstimate.kmRate !== null
                        ? ` × R$ ${travelEstimate.kmRate.toFixed(2)}/km`
                        : ''}
                    </span>
                  )}
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
