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
        totalValue: totalValue,
      })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-foreground/5">
      <Button
        type="button"
        variant="secondary"
        onClick={() => gerarPDFRelatorioAtendimento(docData)}
        className="px-3! py-1.5! text-[10px] font-black uppercase tracking-wider"
      >
        📄 Relatório (PDF)
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={() => gerarPDFReceituario(docData)}
        className="px-3! py-1.5! text-[10px] font-black uppercase tracking-wider"
      >
        💊 Receita (PDF)
      </Button>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#1ea952] border border-[#25D366]/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors ml-auto sm:ml-0"
        >
          📱 WhatsApp
        </a>
      )}
    </div>
  );
}

export type { PrescriptionItem };
