export const BRAZIL_TIMEZONE = 'America/Fortaleza'; // UTC-3 fixo (Natal/RN, sem horário de verão)

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d
  );
}

function parseDateInputForBrazil(dateInput: Date | string): Date | null {
  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput !== 'string') return null;

  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (!isValidCalendarDate(trimmed)) return null;
    const noonBrt = new Date(`${trimmed}T12:00:00.000-03:00`);
    return Number.isNaN(noonBrt.getTime()) ? null : noonBrt;
  }

  const normalized = /^\d{4}-\d{2}-\d{2} /.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Retorna a data no formato YYYY-MM-DD considerando o fuso horário do Brasil (BRT / UTC-3),
 * permitindo deslocamento em dias sem dependência do fuso UTC da máquina servidora.
 */
export function getBrazilDateString(referenceDate: Date = new Date(), offsetDays = 0): string {
  if (Number.isNaN(referenceDate.getTime())) return '';

  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate);

  if (offsetDays === 0) return formatted;

  const [y, m, d] = formatted.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return shifted.toISOString().split('T')[0];
}

/**
 * Retorna o horário no formato HH:mm considerando o fuso horário do Brasil (BRT / UTC-3).
 */
export function getBrazilTimeString(referenceDate: Date = new Date()): string {
  if (Number.isNaN(referenceDate.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BRAZIL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(referenceDate);

  const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const hour = rawHour === '24' ? '00' : rawHour.padStart(2, '0');
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Retorna ano, mês (1-12) e dia (1-31) no fuso horário do Brasil (BRT / UTC-3).
 */
export function getBrazilDateParts(referenceDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const safeDate = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;
  const [year, month, day] = getBrazilDateString(safeDate).split('-').map(Number);
  return { year, month, day };
}

/**
 * Formata Date ou string ISO/YYYY-MM-DD no padrão pt-BR ancorado em America/Fortaleza (UTC-3),
 * prevenindo recuo de -1 dia em datas de calendário puras (YYYY-MM-DD).
 */
export function formatBrazilDate(
  dateInput: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateInputForBrazil(dateInput);
  if (!parsed) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    ...options,
  }).format(parsed);
}

/**
 * Retorna o intervalo completo [00:00:00.000, 23:59:59.999] do dia atual em BRT (UTC-3)
 * convertido para strings ISO-8601 em UTC para consultas no banco.
 */
export function getBrazilDayBoundsUtc(referenceDate: Date = new Date()): {
  dateStr: string;
  startOfDayUtc: string;
  endOfDayUtc: string;
} {
  const dateStr = getBrazilDateString(referenceDate, 0);
  return {
    dateStr,
    startOfDayUtc: new Date(`${dateStr}T00:00:00.000-03:00`).toISOString(),
    endOfDayUtc: new Date(`${dateStr}T23:59:59.999-03:00`).toISOString(),
  };
}
