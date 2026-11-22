/**
 * Utilitários para cálculo e formatação de idade de pacientes veterinários.
 */

import { getBrazilDateString } from '@/core/utils/timezone';

function parseCalendarDateParts(
  birthDateStr: string
): { year: number; month: number; day: number } | null {
  const trimmed = birthDateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
    return { year, month, day };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const brtYmd = getBrazilDateString(parsed);
  const [year, month, day] = brtYmd.split('-').map(Number);
  return { year, month, day };
}

export function calculateYearsAndMonths(
  birthDateStr: string | null | undefined
): { years: number; months: number } | null {
  if (!birthDateStr) return null;
  const birth = parseCalendarDateParts(birthDateStr);
  if (!birth) return null;

  const todayStr = getBrazilDateString();
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

  const birthUtc = Date.UTC(birth.year, birth.month - 1, birth.day);
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  if (birthUtc > todayUtc) {
    return null;
  }

  let years = todayYear - birth.year;
  let months = todayMonth - birth.month;

  if (todayDay < birth.day) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
  };
}

export function formatPatientAge(birthDateStr: string | null | undefined): string {
  const age = calculateYearsAndMonths(birthDateStr);
  if (!age) return '';

  const { years, months } = age;

  if (years === 0 && months === 0) {
    return 'Menos de 1 mês';
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  }

  return parts.join(' e ');
}

export function estimateBirthDateFromAge(years: number, months: number): string {
  const todayStr = getBrazilDateString();
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

  const safeYears = Number.isFinite(years) ? Math.min(150, Math.max(0, Math.floor(years))) : 0;
  const safeMonths = Number.isFinite(months) ? Math.min(1800, Math.max(0, Math.floor(months))) : 0;

  const targetDay = safeYears === 0 && safeMonths === 0 && todayDay < 15 ? todayDay : 15;
  const estimated = new Date(
    Date.UTC(todayYear - safeYears, todayMonth - 1 - safeMonths, targetDay)
  );

  return estimated.toISOString().split('T')[0];
}

export function formatFertilityStatus(status: string | null | undefined): string {
  switch (status) {
    case 'Neutered':
      return 'Castrado(a)';
    case 'Intact':
      return 'Inteiro(a) / Não Castrado(a)';
    case 'Breeding':
      return 'Reprodutor(a) / Gestante';
    default:
      return '';
  }
}
