"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';
import {
  gerarPDFReceituario,
  gerarPDFRelatorioAtendimento,
  type PrescriptionItem,
  type VetDocumentData,
} from '@/core/use-cases/generate-pdf';
import { buildWhatsAppConsultationSummaryUrl } from '@/core/utils/whatsapp';

interface HistoryPdfButtonsProps {
  docData: VetDocumentData;
  tutorPhone?: string | null;
  totalValue?: number | null;
}

export function HistoryPdfButtons({
  docData,
  tutorPhone,
  totalValue,
}: HistoryPdfButtonsProps) {
  const whatsappUrl = tutorPhone
    ? buildWhatsAppConsultationSummaryUrl({
        phone: tutorPhone,
        tutorName: docData.tutorName,
        patientName: docData.patientName,
        vetName: docData.vetName,
        notes: docData.notes,
        prescriptionText: docData.prescriptionText,
        prescriptions: docData.prescriptions,
        totalValue: totalValue,
      })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-foreground/5">
      <Button
        type="button"
        variant="secondary"
        onClick={() => gerarPDFRelatorioAtendimento(docData)}
        className="min-h-[44px] px-3.5! py-2! text-xs font-bold uppercase tracking-wider gap-1.5"
      >
        <span aria-hidden="true">📄</span> Relatório (PDF)
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={() => gerarPDFReceituario(docData)}
        className="min-h-[44px] px-3.5! py-2! text-xs font-bold uppercase tracking-wider gap-1.5"
      >
        <span aria-hidden="true">💊</span> Receita (PDF)
      </Button>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors ml-auto sm:ml-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">📱</span> WhatsApp
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      )}
    </div>
  );
}

export type { PrescriptionItem };
