"use client";

import { formatBrazilDate } from '@/core/utils/timezone';

interface LocalDateProps {
  date: string;
  format?: 'date' | 'time' | 'full';
}

export function LocalDate({ date, format = 'full' }: LocalDateProps) {
  let formatted = '';

  if (format === 'date') {
    formatted = formatBrazilDate(date, { day: '2-digit', month: 'short' });
  } else if (format === 'time') {
    formatted = formatBrazilDate(date, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } else {
    formatted = formatBrazilDate(date, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  return <span>{formatted}</span>;
}
