"use client";

import React, { useId, useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  VaccineProtocolCode,
  calculateVaccineSchedule,
} from '@/core/use-cases/vaccine-protocols';
import { getBrazilDateString } from '@/core/utils/timezone';

function parseClampedIntervalDays(raw: string): number {
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 365;
  return Math.min(3650, Math.max(1, parsed));
}

export interface ConsultationVaccinationDraft {
  id: string;
  protocolCode: VaccineProtocolCode;
  customVaccineName?: string;
  doseStage: 'dose_1' | 'dose_2' | 'dose_3' | 'annual';
  customIntervalDays?: number;
  notes?: string;
}

interface ConsultationVaccinationSectionProps {
  species?: string;
  vaccinations: ConsultationVaccinationDraft[];
  onVaccinationsChange: React.Dispatch<React.SetStateAction<ConsultationVaccinationDraft[]>>;
  onNotifySuccess: (message: string) => void;
  onNotifyError: (message: string) => void;
}

export function ConsultationVaccinationSection({
  species,
  vaccinations,
  onVaccinationsChange,
  onNotifySuccess,
  onNotifyError,
}: ConsultationVaccinationSectionProps) {
  const protocolSelectId = useId();
  const stageSelectId = useId();
  const [showVacForm, setShowVacForm] = useState(false);
  const [vacProtocol, setVacProtocol] = useState<VaccineProtocolCode>(
    species === 'Feline' ? 'V5_FELINA' : 'V10_VANGUARD'
  );
  const [vacDoseStage, setVacDoseStage] = useState<'dose_1' | 'dose_2' | 'dose_3' | 'annual'>(
    'dose_1'
  );
  const [vacCustomName, setVacCustomName] = useState('');
  const [vacCustomInterval, setVacCustomInterval] = useState('365');

  const todayStr = getBrazilDateString();
  const isMultiDoseProtocol = vacProtocol === 'V10_VANGUARD' || vacProtocol === 'V5_FELINA';
  const isSingleAnnualProtocol = vacProtocol === 'ANTIRRABICA' || vacProtocol === 'GRIPE_ORAL';
  const effectiveDoseStage: 'dose_1' | 'dose_2' | 'dose_3' | 'annual' = isMultiDoseProtocol
    ? vacDoseStage
    : isSingleAnnualProtocol
    ? vacDoseStage === 'annual'
      ? 'annual'
      : 'dose_1'
    : 'dose_1';
  const clampedCustomInterval = parseClampedIntervalDays(vacCustomInterval);

  const previewSchedule = useMemo(() => {
    return calculateVaccineSchedule({
      protocolCode: vacProtocol,
      customVaccineName: vacCustomName || 'Vacina Personalizada',
      doseStage: effectiveDoseStage,
      appliedDate: todayStr,
      customIntervalDays: clampedCustomInterval,
    });
  }, [vacProtocol, vacCustomName, effectiveDoseStage, todayStr, clampedCustomInterval]);

  const handleAddVaccinationDraft = () => {
    if (vacProtocol === 'CUSTOM' && !vacCustomName.trim()) {
      onNotifyError('Informe o nome da vacina personalizada.');
      return;
    }
    const draft: ConsultationVaccinationDraft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      protocolCode: vacProtocol,
      customVaccineName: vacProtocol === 'CUSTOM' ? vacCustomName.trim() : undefined,
      doseStage: effectiveDoseStage,
      customIntervalDays: vacProtocol === 'CUSTOM' ? clampedCustomInterval : undefined,
    };
    onVaccinationsChange((prev) => [...prev, draft]);
    setShowVacForm(false);
    setVacCustomName('');
    onNotifySuccess('Protocolo vacinal adicionado ao atendimento!');
  };

  const handleRemoveVaccinationDraft = (id: string) => {
    onVaccinationsChange((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-foreground/[0.02] border border-border">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="font-extrabold text-foreground text-base flex items-center gap-2">
            💉 Protocolo Vacinal Aplicado
            {vaccinations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-success/15 text-success text-xs font-black">
                {vaccinations.length}
              </span>
            )}
          </h4>
          <p className="text-xs text-foreground/50 font-medium">
            Agenda automaticamente o retorno (+21 dias para V10/V5 inicial ou +1 ano para reforço anual)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowVacForm(!showVacForm)}
          className="text-xs font-black text-primary bg-primary/10 px-3.5 py-2 rounded-xl hover:bg-primary/20 transition-colors shrink-0"
        >
          {showVacForm ? 'Cancelar' : '+ Programar Vacina'}
        </button>
      </div>

      {showVacForm && (
        <div className="p-4 rounded-2xl bg-card border border-primary/20 flex flex-col gap-3 mt-1 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={protocolSelectId}
                className="text-sm font-semibold text-foreground/85"
              >
                Protocolo Vacinal
              </label>
              <select
                id={protocolSelectId}
                value={vacProtocol}
                onChange={(e) => {
                  const code = e.target.value as VaccineProtocolCode;
                  setVacProtocol(code);
                  if (code === 'ANTIRRABICA' || code === 'GRIPE_ORAL') {
                    setVacDoseStage((prev) => (prev === 'annual' ? 'annual' : 'dose_1'));
                  } else if (code === 'CUSTOM') {
                    setVacDoseStage('dose_1');
                  }
                }}
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="V10_VANGUARD">V10 Vanguard (Canino - 3 doses 21d + Anual)</option>
                <option value="ANTIRRABICA">Vacina Antirrábica (Dose única Anual)</option>
                <option value="V5_FELINA">V5 Viral Felina (Felino - 3 doses 21d + Anual)</option>
                <option value="GRIPE_ORAL">Vacina Gripe Oral (Dose única Anual)</option>
                <option value="CUSTOM">Outra Vacina Personalizada</option>
              </select>
            </div>

            {isMultiDoseProtocol && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={stageSelectId}
                  className="text-sm font-semibold text-foreground/85"
                >
                  Etapa do Protocolo
                </label>
                <select
                  id={stageSelectId}
                  value={vacDoseStage}
                  onChange={(e) =>
                    setVacDoseStage(
                      e.target.value as 'dose_1' | 'dose_2' | 'dose_3' | 'annual'
                    )
                  }
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="dose_1">1ª Dose Inicial (Retorno em 21 dias)</option>
                  <option value="dose_2">2ª Dose Inicial (Retorno em 21 dias)</option>
                  <option value="dose_3">3ª Dose Final (Reforço em 1 ano)</option>
                  <option value="annual">Reforço Anual (Retorno em 1 ano)</option>
                </select>
              </div>
            )}

            {isSingleAnnualProtocol && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={stageSelectId}
                  className="text-sm font-semibold text-foreground/85"
                >
                  Etapa do Protocolo
                </label>
                <select
                  id={stageSelectId}
                  value={effectiveDoseStage}
                  onChange={(e) => setVacDoseStage(e.target.value as 'dose_1' | 'annual')}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="dose_1">Dose Única (Inicial)</option>
                  <option value="annual">Reforço Anual (+1 ano)</option>
                </select>
              </div>
            )}
          </div>

          {vacProtocol === 'CUSTOM' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome da Vacina *"
                value={vacCustomName}
                onChange={(e) => setVacCustomName(e.target.value)}
                placeholder="Ex: Vacina Giárdia"
              />
              <Input
                label="Intervalo Próxima Dose (dias)"
                type="number"
                min={1}
                max={3650}
                value={vacCustomInterval}
                onChange={(e) => setVacCustomInterval(e.target.value)}
                placeholder="Ex: 21 ou 365"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-success/10 border border-success/20 text-xs font-bold text-success">
            <span>
              Próxima dose ({previewSchedule.nextDoseLabel}):{' '}
              {previewSchedule.nextDueDate.split('-').reverse().join('/')}
            </span>
            <Button
              type="button"
              variant="primary"
              onClick={handleAddVaccinationDraft}
              className="py-1.5! px-3! text-xs font-black"
            >
              Confirmar Vacina
            </Button>
          </div>
        </div>
      )}

      {vaccinations.length > 0 && (
        <div className="flex flex-col gap-2">
          {vaccinations.map((v) => {
            const sched = calculateVaccineSchedule({
              protocolCode: v.protocolCode,
              customVaccineName: v.customVaccineName,
              doseStage: v.doseStage,
              appliedDate: todayStr,
              customIntervalDays: v.customIntervalDays,
            });
            return (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 rounded-xl bg-card border border-border"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-black text-foreground">
                    💉 {sched.vaccineName} • {sched.currentDoseLabel}
                  </span>
                  <span className="text-[11px] font-bold text-primary">
                    Próxima dose ({sched.nextDoseLabel}):{' '}
                    {sched.nextDueDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVaccinationDraft(v.id)}
                  className="text-xs font-bold text-error hover:underline"
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
