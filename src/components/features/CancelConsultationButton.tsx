"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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
      const result = await cancelarConsulta(id);
      if (!result.success) {
        error(result.error);
        setIsConfirming(false);
        return;
      }
      success('Consulta cancelada com sucesso.');
      setIsConfirming(false);
    } catch {
      error('Erro ao cancelar consulta.');
    } finally {
      setLoading(false);
    }
  };

  const toggleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsConfirming((prev) => !prev);
  };

  return (
    <>
      <Modal
        isOpen={isConfirming}
        onClose={() => {
          if (!loading) setIsConfirming(false);
        }}
        title="Confirmar Cancelamento?"
        role="alertdialog"
        showCloseButton={false}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col items-center gap-6 py-2 text-center">
          <div className="text-6xl" aria-hidden="true">
            ⚠️
          </div>
          <p className="text-muted-foreground font-medium leading-relaxed max-w-xs">
            Esta ação removerá o agendamento da sua agenda. Você poderá agendá-lo novamente depois se desejar.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Button
              type="button"
              variant="danger"
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-4! text-[10px] font-black uppercase tracking-widest"
            >
              {loading ? 'Cancelando...' : 'Sim, Cancelar Agendamento'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfirming(false)}
              disabled={loading}
              className="w-full py-4! text-[10px] font-black uppercase tracking-widest"
            >
              Não, Manter Agendamento
            </Button>
          </div>
        </div>
      </Modal>

      <Button
        type="button"
        variant="secondary"
        onClick={toggleConfirm}
        disabled={loading}
        className="text-error! hover:bg-error/10! w-full py-4 text-sm font-bold shadow-sm border border-border-strong"
      >
        Cancelar Agendamento
      </Button>
    </>
  );
}
