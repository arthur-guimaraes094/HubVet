"use client";

import { useEffect, useState } from 'react';

interface LocalDateProps {
  date: string;
  format?: 'date' | 'time' | 'full';
}

export function LocalDate({ date, format = 'full' }: LocalDateProps) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    // Normaliza a string para garantir que o JS a trate como UTC se tiver Z ou +00
    const d = new Date(date.replace(' ', 'T'));
    let newVal = '';
    
    if (format === 'date') {
      newVal = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } else if (format === 'time') {
      newVal = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      newVal = d.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    }
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormatted(newVal);
  }, [date, format]);

  // Enquanto não monta no cliente, retorna um placeholder ou nada para evitar hidratação incorreta
  if (!formatted) return <span className="opacity-0">...</span>;

  return <span>{formatted}</span>;
}
