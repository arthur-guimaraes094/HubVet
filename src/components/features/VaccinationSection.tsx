"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  addPatientVaccination,
  deletePatientVaccination,
} from '@/app/pacientes/actions';
import {
  VACCINE_PROTOCOLS,
  calculateVaccineSchedule,
  buildWhatsAppVaccineReminderUrl,
  type VaccineProtocolCode,
} from '@/core/use-cases/vaccine-protocols';
import { useRouter } from 'next/navigation';

export interface PatientVaccinationRecord {
  id: string;
  protocol_code: string;
  vaccine_name: string;
  dose_number: number;
  total_initial_doses: number;
  is_annual_booster: boolean;
  applied_date: string;
  next_due_date: string;
  next_dose_label: string;
  batch_number: string | null;
  notes: string | null;
  completed_by_vaccination_id: string | null;
}

interface VaccinationSectionProps {
  patientId: string;
  patientName: string;
  patientSpecies: string;
  tutorName?: string;
  tutorPhone?: string | null;
  vaccinations: PatientVaccinationRecord[];
}

export function VaccinationSection({
  patientId,
  patientName,
  patientSpecies,
  tutorName,
  tutorPhone,
  vaccinations,
}: VaccinationSectionProps) {
  const { success, error } = useToast();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const defaultProtocol: VaccineProtocolCode =
    patientSpecies === 'Feline' ? 'V5_FELINA' : 'V10_VANGUARD';

  const [protocolCode, setProtocolCode] = useState<VaccineProtocolCode>(defaultProtocol);
  const [customVaccineName, setCustomVaccineName] = useState('');
  const [doseStage, setDoseStage] = useState<'dose_1' | 'dose_2' | 'dose_3' | 'annual'>('dose_1');
  const [appliedDate, setAppliedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [customIntervalDays, setCustomIntervalDays] = useState('365');

  const isMultiDoseProtocol =
    protocolCode === 'V10_VANGUARD' || protocolCode === 'V5_FELINA';

  const previewSchedule = React.useMemo(() => {
    const effectiveStage = isMultiDoseProtocol ? doseStage : 'dose_1';
    return calculateVaccineSchedule({
      protocolCode,
      customVaccineName,
      doseStage: effectiveStage,
      appliedDate: appliedDate || new Date().toISOString().split('T')[0],
      customIntervalDays: parseInt(customIntervalDays || '365', 10),
    });
  }, [protocolCode, customVaccineName, doseStage, appliedDate, customIntervalDays, isMultiDoseProtocol]);

  const handleOpenModal = () => {
    // Sugerir automaticamente a próxima dose caso o pet já tenha tomado a 1ª ou 2ª dose
    const activeSameProtocol = vaccinations.find(
      (v) => v.protocol_code === defaultProtocol && !v.completed_by_vaccination_id
    );
    if (activeSameProtocol) {
      if (!activeSameProtocol.is_annual_booster && activeSameProtocol.dose_number === 1 && activeSameProtocol.total_initial_doses === 3) {
        setDoseStage('dose_2');
      } else if (!activeSameProtocol.is_annual_booster && activeSameProtocol.dose_number === 2 && activeSameProtocol.total_initial_doses === 3) {
        setDoseStage('dose_3');
      } else {
        setDoseStage('annual');
      }
    } else {
      setDoseStage('dose_1');
    }
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (protocolCode === 'CUSTOM' && !customVaccineName.trim()) {
      error('Informe o nome da vacina personalizada.');
      return;
    }

    setLoading(true);
    try {
      const result = await addPatientVaccination({
        patientId,
        protocolCode,
        customVaccineName,
        doseStage: isMultiDoseProtocol ? doseStage : 'dose_1',
        appliedDate,
        batchNumber,
        notes,
        customIntervalDays: parseInt(customIntervalDays || '365', 10),
      });

      if (!result.success) {
        error(result.error);
        return;
      }

      success('Vacinação registrada e próximo retorno agendado!');
      setIsOpen(false);
      setBatchNumber('');
      setNotes('');
      router.refresh();
    } catch {
      error('Erro ao registrar vacinação.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deletePatientVaccination(id, patientId);
    if (res.success) {
      success('Registro vacinal removido.');
      router.refresh();
    } else {
      error(res.error);
    }
  };

  const getDueStatus = (nextDueDateStr: string, isCompleted: boolean) => {
    if (isCompleted) {
      return {
        label: 'Ciclo Concluído',
        className: 'bg-foreground/10 text-foreground/50 border-foreground/10',
        daysDiff: 999,
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = nextDueDateStr.split('-').map(Number);
    const due = new Date(y, (m || 1) - 1, d || 1);
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Atrasada há ${Math.abs(diffDays)} dia(s)`,
        className: 'bg-error/15 text-error border-error/30',
        daysDiff: diffDays,
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Vence Hoje!',
        className: 'bg-amber-500/20 text-amber-600 border-amber-500/40 animate-pulse',
        daysDiff: 0,
      };
    }
    if (diffDays <= 14) {
      return {
        label: `Vence em ${diffDays} dia(s)`,
        className: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
        daysDiff: diffDays,
      };
    }
    return {
      label: `Em dia • Próxima em ${diffDays}d`,
      className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      daysDiff: diffDays,
    };
  };

  const formatBrDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return d && m && y ? `${d}/${m}/${y}` : dateStr;
  };

  return (
    <Card className="p-6 flex flex-col gap-5 bg-background shadow-sm border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">💉</span>
          <div>
            <h3 className="text-base font-black text-foreground tracking-tight">
              Carteira de Vacinação & Protocolos
            </h3>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
              Controle automático de doses (21 dias / Anual)
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenModal}
          className="px-4! py-2! text-xs font-black uppercase tracking-wider"
        >
          + Registrar Vacina
        </Button>
      </div>

      {vaccinations.length === 0 ? (
        <div className="p-6 rounded-2xl bg-foreground/3 border border-dashed border-foreground/10 text-center flex flex-col items-center gap-2">
          <p className="text-sm font-bold text-foreground/50">
            Nenhuma vacina registrada para {patientName}.
          </p>
          <p className="text-xs text-foreground/40">
            Registre V10 Vanguard, V5 Felina, Antirrábica ou Gripe Oral para ativar os avisos programados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vaccinations.map((v) => {
            const isCompleted = !!v.completed_by_vaccination_id;
            const status = getDueStatus(v.next_due_date, isCompleted);
            const doseBadge = v.is_annual_booster
              ? 'Reforço Anual'
              : v.total_initial_doses > 1
              ? `${v.dose_number}ª de ${v.total_initial_doses} Doses`
              : 'Dose Única';

            return (
              <div
                key={v.id}
                className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all ${
                  isCompleted
                    ? 'bg-foreground/2 border-border opacity-60'
                    : 'bg-card border-border shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-foreground">{v.vaccine_name}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {doseBadge}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    title="Remover registro"
                    className="text-foreground/20 hover:text-error transition-colors p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-foreground/4 p-3 rounded-xl border border-foreground/5">
                  <div>
                    <span className="text-[9px] font-black uppercase text-foreground/40 block">
                      Aplicada em
                    </span>
                    <span className="font-bold text-foreground">
                      {formatBrDate(v.applied_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-foreground/40 block">
                      Próxima ({v.next_dose_label})
                    </span>
                    <span className="font-black text-primary">
                      {formatBrDate(v.next_due_date)}
                    </span>
                  </div>
                </div>

                {v.batch_number && (
                  <span className="text-[10px] text-foreground/50 font-medium">
                    Lote/Fabricante: <strong>{v.batch_number}</strong>
                  </span>
                )}

                {!isCompleted && tutorPhone && (
                  <a
                    href={buildWhatsAppVaccineReminderUrl({
                      tutorPhone,
                      tutorName: tutorName || 'Tutor(a)',
                      patientName,
                      vaccineName: v.vaccine_name,
                      nextDoseLabel: v.next_dose_label,
                      nextDueDate: v.next_due_date,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    📲 Avisar Tutor no WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Registrar Vacina"
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60 -mt-6 mb-6">
          {patientName}
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">
              Protocolo Vacinal *
            </label>
            <select
              value={protocolCode}
              onChange={(e) => {
                const code = e.target.value as VaccineProtocolCode;
                setProtocolCode(code);
                if (code === 'ANTIRRABICA' || code === 'GRIPE_ORAL') {
                  setDoseStage('dose_1');
                }
              }}
              className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 font-bold text-sm transition-all border border-border text-foreground"
            >
              <option value="V10_VANGUARD">
                🐶 V10 Vanguard (3 doses c/ 21 dias → Anual)
              </option>
              <option value="ANTIRRABICA">
                🛡️ Vacina Antirrábica (Dose única → Anual)
              </option>
              <option value="V5_FELINA">
                🐱 V5 Viral Felina (3 doses c/ 21 dias → Anual)
              </option>
              <option value="GRIPE_ORAL">
                🐶 Vacina Gripe Oral (Dose única → Anual)
              </option>
              <option value="CUSTOM">➕ Outra Vacina (Personalizada)</option>
            </select>
            {protocolCode !== 'CUSTOM' && (
              <span className="text-[11px] text-foreground/50 pl-2 italic">
                {VACCINE_PROTOCOLS[protocolCode].description}
              </span>
            )}
          </div>

          {protocolCode === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nome da Vacina *"
                placeholder="Ex: Vacina Giárdia"
                value={customVaccineName}
                onChange={(e) => setCustomVaccineName(e.target.value)}
                required
              />
              <Input
                label="Intervalo Retorno (dias)"
                type="number"
                value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(e.target.value)}
              />
            </div>
          )}

          {isMultiDoseProtocol && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">
                Etapa do Protocolo Aplicada Hoje
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'dose_1', label: '1ª Dose (+21 dias)' },
                  { id: 'dose_2', label: '2ª Dose (+21 dias)' },
                  { id: 'dose_3', label: '3ª Dose (+1 ano)' },
                  { id: 'annual', label: 'Reforço Anual (+1 ano)' },
                ].map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() =>
                      setDoseStage(stage.id as 'dose_1' | 'dose_2' | 'dose_3' | 'annual')
                    }
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all border ${
                      doseStage === stage.id
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-foreground/70 border-border hover:border-primary/30'
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data da Aplicação *"
              type="date"
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
              required
            />
            <Input
              label="Lote / Fabricante"
              placeholder="Opcional"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
            />
          </div>

          <div className="p-4 rounded-2xl bg-primary/8 border border-primary/20 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              🔔 Aviso Programado Calculado Automaticamente
            </span>
            <span className="text-sm font-black text-foreground">
              Próxima etapa: {previewSchedule.nextDoseLabel}
            </span>
            <span className="text-xs font-bold text-primary">
              Data programada: {formatBrDate(previewSchedule.nextDueDate)}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-4! text-[10px] font-black uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex-2 py-4! text-[10px] font-black uppercase tracking-widest"
            >
              {loading ? 'Salvando...' : 'Confirmar Vacina'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
