"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cancelarConsulta } from '@/app/agenda/actions';
import { useToast } from '@/components/ui/Toast';

interface CancelConsultationButtonProps {
  id: string;
}

export function CancelConsultationButton({ id }: CancelConsultationButtonProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;

    setLoading(true);
    try {
      await cancelarConsulta(id);
      success('Consulta cancelada com sucesso.');
    } catch (e) {
      console.error(e);
      error('Erro ao cancelar consulta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="secondary" 
      onClick={handleCancel} 
      disabled={loading}
      className="!text-error hover:!bg-error/10 !px-3 !py-2 text-xs sm:text-sm"
    >
      {loading ? '...' : 'Cancelar'}
    </Button>
  );
}
