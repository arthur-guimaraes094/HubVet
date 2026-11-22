export const BRAZIL_TIMEZONE = 'America/Fortaleza'; // UTC-3 fixo (Natal/RN, sem horário de verão)

/**
 * Retorna a data no formato YYYY-MM-DD considerando o fuso horário do Brasil (BRT / UTC-3),
 * permitindo deslocamento em dias sem dependência do fuso UTC da máquina servidora.
 */
export function getBrazilDateString(referenceDate: Date = new Date(), offsetDays = 0): string {
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
