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
  const [isConfirming, setIsConfirming] = useState(false);

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    try {
      await cancelarConsulta(id);
      success('Consulta cancelada com sucesso.');
      setIsConfirming(false);
    } catch (e) {
      console.error(e);
      error('Erro ao cancelar consulta.');
    } finally {
      setLoading(false);
    }
  };

  const toggleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsConfirming(!isConfirming);
  };

  return (
    <>
      {isConfirming && (
        <div 
          className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-6xl mb-6 animate-bounce">⚠️</div>
          <h3 className="text-2xl font-black text-foreground mb-2 tracking-tight">Confirmar Cancelamento?</h3>
          <p className="text-foreground/60 font-medium mb-8 leading-relaxed max-w-xs">
            Esta ação removerá o agendamento da sua agenda. Você poderá agendá-lo novamente depois se desejar.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button 
              type="button"
              variant="primary" 
              onClick={handleCancel} 
              disabled={loading}
              className="w-full !bg-error hover:!bg-error/80 !border-none !py-4 shadow-neu-sm text-[10px] font-black uppercase tracking-widest"
            >
              {loading ? 'Cancelando...' : 'Sim, Cancelar Agendamento'}
            </Button>
            <Button 
              type="button"
              variant="secondary" 
              onClick={toggleConfirm}
              disabled={loading}
              className="w-full !py-4 text-[10px] font-black uppercase tracking-widest"
            >
              Não, Manter Agendamento
            </Button>
          </div>
        </div>
      )}

      <Button 
        type="button"
        variant="secondary" 
        onClick={toggleConfirm} 
        disabled={loading}
        className="!text-error hover:!bg-error/10 w-full py-4 text-sm font-bold shadow-neu-sm"
      >
        Cancelar Agendamento
      </Button>
    </>
  );
}
