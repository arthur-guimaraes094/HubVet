"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';
import {
  gerarPDFReceituario,
  gerarPDFRelatorioAtendimento,
  type PrescriptionItem,
  type VetDocumentData,
} from '@/core/use-cases/generate-pdf';

interface HistoryPdfButtonsProps {
  docData: VetDocumentData;
}

export function HistoryPdfButtons({ docData }: HistoryPdfButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 pt-3 border-t border-foreground/5">
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
    </div>
  );
}

export type { PrescriptionItem };
