"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  buildWhatsAppConsultationSummaryUrl,
  buildWhatsAppPixBillingUrl,
} from '@/core/utils/whatsapp';
import type { PrescriptionItem } from '@/core/use-cases/generate-pdf';

interface ConsultationSuccessViewProps {
  patientName?: string;
  tutorName?: string;
  tutorPhone?: string;
  vetName?: string;
  notes: string;
  prescriptionText: string;
  prescriptions?: PrescriptionItem[];
  totalValue: number;
  prescriptionsCount: number;
  effectivePixKey: string;
  effectivePixType: string;
  pixPayload: string;
  pixQrCodeUrl: string;
  onDownloadRelatorioPDF: () => void;
  onDownloadReceituarioPDF: () => void;
  onConfigurePix: () => void;
  onGoHome: () => void;
  onNotifySuccess: (message: string) => void;
}

export function ConsultationSuccessView({
  patientName,
  tutorName,
  tutorPhone,
  vetName,
  notes,
  prescriptionText,
  prescriptions,
  totalValue,
  prescriptionsCount,
  effectivePixKey,
  effectivePixType,
  pixPayload,
  pixQrCodeUrl,
  onDownloadRelatorioPDF,
  onDownloadReceituarioPDF,
  onConfigurePix,
  onGoHome,
  onNotifySuccess,
}: ConsultationSuccessViewProps) {
  const whatsappSummaryUrl = buildWhatsAppConsultationSummaryUrl({
    phone: tutorPhone,
    tutorName,
    patientName,
    vetName: vetName || 'Dra. Gabriela Soares',
    notes,
    prescriptionText,
    prescriptions,
    totalValue,
    pixKey: effectivePixKey,
    pixKeyType: effectivePixType,
    pixCopiaECola: pixPayload || null,
  });

  const whatsappPixUrl =
    effectivePixKey && Number.isFinite(totalValue) && totalValue > 0
      ? buildWhatsAppPixBillingUrl({
          phone: tutorPhone,
          tutorName,
          patientName,
          totalValue,
          pixKey: effectivePixKey,
          pixKeyType: effectivePixType,
          pixCopiaECola: pixPayload || null,
        })
      : null;

  return (
    <Card className="flex flex-col items-center justify-center gap-6 py-10 text-center w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
      <div className="text-5xl animate-bounce">✅</div>
      <div className="flex flex-col gap-1.5 px-4">
        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          Atendimento Finalizado!
        </h2>
        <p className="text-foreground/60 font-medium text-xs sm:text-sm max-w-md mx-auto">
          O prontuário do(a) <strong className="text-foreground">{patientName}</strong> foi registrado com sucesso.
        </p>
      </div>

      {/* Card de Cobrança / PIX */}
      {totalValue > 0 && (
        <div className="w-full max-w-md p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Valor Total do Atendimento
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              R$ {totalValue.toFixed(2)}
            </span>
          </div>

          {effectivePixKey ? (
            <div className="flex flex-col gap-3 pt-2 border-t border-emerald-500/15">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/60 font-medium">
                  Chave PIX ({effectivePixType}):
                </span>
                <span className="font-mono font-bold text-foreground">
                  {effectivePixKey}
                </span>
              </div>

              {/* QR Code Oficial Banco Central (EMVCo) */}
              {pixQrCodeUrl && (
                <div className="flex flex-col items-center justify-center py-3 px-4 bg-white rounded-2xl shadow-sm border border-emerald-500/25 my-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pixQrCodeUrl}
                    alt="QR Code PIX Banco Central"
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800 mt-2">
                    Aponte a câmera do banco para pagar
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700">
                    R$ {totalValue.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                {pixPayload && (
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        navigator.clipboard
                          .writeText(pixPayload)
                          .then(() => onNotifySuccess('Código PIX Copia e Cola copiado!'))
                          .catch(() => {});
                      }
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    📋 PIX Copia e Cola
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                      navigator.clipboard
                        .writeText(effectivePixKey)
                        .then(() => onNotifySuccess('Chave PIX copiada!'))
                        .catch(() => {});
                    }
                  }}
                  className="py-2 px-3 rounded-xl bg-card border border-border hover:border-emerald-500 text-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                >
                  🔑 Chave
                </button>
                {whatsappPixUrl && (
                  <a
                    href={whatsappPixUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    📱 Cobrar PIX
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-foreground/60 pt-1 border-t border-emerald-500/15">
              <span>Configure sua chave PIX no perfil para cobrança rápida.</span>
              <button
                type="button"
                onClick={onConfigurePix}
                className="text-primary font-bold hover:underline shrink-0 ml-2"
              >
                Configurar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ações de Comunicação e Documentos */}
      <div className="flex flex-col gap-3 w-full max-w-md px-4">
        {whatsappSummaryUrl && (
          <a
            href={whatsappSummaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs sm:text-sm font-black shadow-sm flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.073.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.124.554 4.119 1.523 5.861l-1.616 5.908 6.06-1.59c1.674.912 3.593 1.421 5.633 1.421 6.627 0 12-5.373 12-12s-5.373-12-12-12z" />
            </svg>
            📱 Enviar Resumo no WhatsApp do Tutor
          </a>
        )}

        <Button
          variant="primary"
          onClick={onDownloadRelatorioPDF}
          className="w-full py-3.5 text-xs sm:text-sm font-black shadow-sm flex items-center justify-center gap-2"
        >
          📄 Baixar Relatório de Atendimento (PDF)
        </Button>

        <Button
          variant="primary"
          onClick={onDownloadReceituarioPDF}
          className="w-full py-3.5 text-xs sm:text-sm font-black bg-secondary! hover:bg-secondary/90! text-white shadow-sm flex items-center justify-center gap-2"
        >
          💊 Baixar Receituário Veterinário (PDF)
          {prescriptionsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-black">
              {prescriptionsCount}
            </span>
          )}
        </Button>

        <Button
          variant="secondary"
          onClick={onGoHome}
          className="w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 mt-1"
        >
          Voltar ao Início
        </Button>
      </div>
    </Card>
  );
}
