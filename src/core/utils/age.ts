/**
 * Utilitários para cálculo e formatação de idade de pacientes veterinários.
 */

export function calculateYearsAndMonths(birthDateStr: string | null | undefined): { years: number; months: number } | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
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
  const now = new Date();
  const safeYears = Math.max(0, Math.floor(years || 0));
  const safeMonths = Math.max(0, Math.floor(months || 0));

  const estimated = new Date(
    now.getFullYear() - safeYears,
    now.getMonth() - safeMonths,
    15 // Dia central do mês para evitar problemas de fuso horário
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
