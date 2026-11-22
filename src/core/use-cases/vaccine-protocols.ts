import { getBrazilDateString } from '@/core/utils/timezone';
import { cleanPhoneNumber } from '@/core/utils/whatsapp';

/**
 * Regras oficiais dos Protocolos Vacinais do HubVet:
 * - V10 Vanguard (Canino): Protocolo inicial de 3 doses com intervalo de 21 dias cada; finalizando as 3, 1 dose por ano.
 * - Vacina Antirrábica (Canino/Felino): Dose única, anual.
 * - V5 Vacina Viral Felina (Felino): Protocolo inicial de 3 doses com intervalo de 21 dias entre elas; em seguida 1 dose anual.
 * - Vacina Gripe Oral (Canino): 1 dose anual.
 */

export type VaccineProtocolCode =
  | 'V10_VANGUARD'
  | 'ANTIRRABICA'
  | 'V5_FELINA'
  | 'GRIPE_ORAL'
  | 'CUSTOM';

export interface VaccineProtocolDefinition {
  code: VaccineProtocolCode;
  name: string;
  species: ('Canine' | 'Feline' | 'Other')[];
  initialDosesCount: number;
  initialIntervalDays: number; // 21 dias para V10 e V5
  annualIntervalDays: number;  // 365 dias
  description: string;
}

export const VACCINE_PROTOCOLS: Record<Exclude<VaccineProtocolCode, 'CUSTOM'>, VaccineProtocolDefinition> = {
  V10_VANGUARD: {
    code: 'V10_VANGUARD',
    name: 'V10 Vanguard',
    species: ['Canine'],
    initialDosesCount: 3,
    initialIntervalDays: 21,
    annualIntervalDays: 365,
    description: 'Protocolo inicial: 3 doses com intervalo de 21 dias; após a 3ª dose, reforço anual (1 dose/ano).',
  },
  ANTIRRABICA: {
    code: 'ANTIRRABICA',
    name: 'Vacina Antirrábica',
    species: ['Canine', 'Feline'],
    initialDosesCount: 1,
    initialIntervalDays: 365,
    annualIntervalDays: 365,
    description: 'Dose única com reforço anual (1 dose/ano).',
  },
  V5_FELINA: {
    code: 'V5_FELINA',
    name: 'V5 Vacina Viral Felina',
    species: ['Feline'],
    initialDosesCount: 3,
    initialIntervalDays: 21,
    annualIntervalDays: 365,
    description: 'Protocolo inicial: 3 doses com intervalo de 21 dias entre elas; em seguida, reforço anual (1 dose/ano).',
  },
  GRIPE_ORAL: {
    code: 'GRIPE_ORAL',
    name: 'Vacina Gripe Oral',
    species: ['Canine'],
    initialDosesCount: 1,
    initialIntervalDays: 365,
    annualIntervalDays: 365,
    description: 'Dose única com reforço anual (1 dose/ano).',
  },
};

export interface CalculatedVaccineSchedule {
  protocolCode: VaccineProtocolCode;
  vaccineName: string;
  doseNumber: number;
  totalInitialDoses: number;
  isAnnualBooster: boolean;
  appliedDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  nextDoseLabel: string;
  currentDoseLabel: string;
}

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

export function addYearsCalendar(dateStr: string, years: number): string {
  const validDate = isValidCalendarDate(dateStr) ? dateStr : getBrazilDateString();
  const [year, month, day] = validDate.split('-').map(Number);
  const targetYear = year + (Number.isFinite(years) ? Math.trunc(years) : 0);
  const maxDayInMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDayInMonth);
  const date = new Date(Date.UTC(targetYear, month - 1, targetDay));
  return date.toISOString().split('T')[0];
}

export function calculateVaccineSchedule(params: {
  protocolCode: VaccineProtocolCode;
  customVaccineName?: string;
  doseStage: 'dose_1' | 'dose_2' | 'dose_3' | 'annual';
  appliedDate: string; // YYYY-MM-DD
  customIntervalDays?: number;
}): CalculatedVaccineSchedule {
  const { protocolCode, customVaccineName, doseStage, appliedDate, customIntervalDays } = params;
  const validAppliedDate = isValidCalendarDate(appliedDate) ? appliedDate : getBrazilDateString();

  if (protocolCode === 'CUSTOM') {
    const rawInterval =
      typeof customIntervalDays === 'number' && Number.isFinite(customIntervalDays)
        ? Math.round(customIntervalDays)
        : 365;
    const interval = Math.min(3650, Math.max(1, rawInterval));
    return {
      protocolCode: 'CUSTOM',
      vaccineName: (customVaccineName || '').trim() || 'Vacina Personalizada',
      doseNumber: 1,
      totalInitialDoses: 1,
      isAnnualBooster: interval >= 360,
      appliedDate: validAppliedDate,
      nextDueDate: addDaysToDateStr(validAppliedDate, interval),
      nextDoseLabel:
        interval === 21
          ? 'Próxima Dose (21 dias)'
          : interval >= 360
          ? 'Reforço Anual'
          : `Retorno (${interval} dias)`,
      currentDoseLabel: 'Dose Aplicada',
    };
  }

  const def = VACCINE_PROTOCOLS[protocolCode];

  // Protocolos de dose única anual (Antirrábica e Gripe Oral)
  if (def.initialDosesCount === 1) {
    const isAnnual = doseStage === 'annual';
    return {
      protocolCode,
      vaccineName: def.name,
      doseNumber: 1,
      totalInitialDoses: 1,
      isAnnualBooster: isAnnual,
      appliedDate: validAppliedDate,
      nextDueDate: addYearsCalendar(validAppliedDate, 1),
      nextDoseLabel: 'Reforço Anual (1 ano)',
      currentDoseLabel: isAnnual ? 'Reforço Anual' : 'Dose Única',
    };
  }

  // Protocolos de 3 doses iniciais com 21 dias (V10 Vanguard e V5 Viral Felina)
  if (doseStage === 'dose_1') {
    return {
      protocolCode,
      vaccineName: def.name,
      doseNumber: 1,
      totalInitialDoses: 3,
      isAnnualBooster: false,
      appliedDate: validAppliedDate,
      nextDueDate: addDaysToDateStr(validAppliedDate, def.initialIntervalDays), // +21 dias
      nextDoseLabel: '2ª Dose do Protocolo Inicial (21 dias)',
      currentDoseLabel: '1ª Dose (Protocolo Inicial)',
    };
  }

  if (doseStage === 'dose_2') {
    return {
      protocolCode,
      vaccineName: def.name,
      doseNumber: 2,
      totalInitialDoses: 3,
      isAnnualBooster: false,
      appliedDate: validAppliedDate,
      nextDueDate: addDaysToDateStr(validAppliedDate, def.initialIntervalDays), // +21 dias
      nextDoseLabel: '3ª Dose do Protocolo Inicial (21 dias)',
      currentDoseLabel: '2ª Dose (Protocolo Inicial)',
    };
  }

  if (doseStage === 'dose_3') {
    return {
      protocolCode,
      vaccineName: def.name,
      doseNumber: 3,
      totalInitialDoses: 3,
      isAnnualBooster: false,
      appliedDate: validAppliedDate,
      nextDueDate: addYearsCalendar(validAppliedDate, 1),
      nextDoseLabel: 'Reforço Anual (1 ano)',
      currentDoseLabel: '3ª Dose (Fim do Protocolo Inicial)',
    };
  }

  // Reforço anual
  return {
    protocolCode,
    vaccineName: def.name,
    doseNumber: 3,
    totalInitialDoses: 3,
    isAnnualBooster: true,
    appliedDate: validAppliedDate,
    nextDueDate: addYearsCalendar(validAppliedDate, 1),
    nextDoseLabel: 'Reforço Anual (1 ano)',
    currentDoseLabel: 'Reforço Anual',
  };
}

export function buildWhatsAppVaccineReminderUrl(params: {
  tutorPhone: string;
  tutorName: string;
  patientName: string;
  vaccineName: string;
  nextDoseLabel: string;
  nextDueDate: string; // YYYY-MM-DD
  vetName?: string;
}): string {
  const phoneWithCountry = cleanPhoneNumber(params.tutorPhone);
  if (!phoneWithCountry) return '';

  const [y, m, d] = params.nextDueDate.split('-');
  const formattedDate = d && m && y ? `${d}/${m}/${y}` : params.nextDueDate;
  const vetTitle = params.vetName || 'Dra. Gabriela Soares';

  const message = `Olá, ${params.tutorName}! Tudo bem? 🐾\nAqui é da equipe da ${vetTitle}. Passando para lembrar que a *${params.nextDoseLabel}* da vacina *${params.vaccineName}* do(a) *${params.patientName}* está programada para o dia *${formattedDate}*.\n\nVamos agendar o melhor horário para o atendimento?`;

  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}
