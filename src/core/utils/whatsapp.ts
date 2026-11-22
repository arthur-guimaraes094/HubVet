/**
 * Utilitários para formatação e envio de mensagens pelo WhatsApp e links de navegação GPS.
 */
import type { PrescriptionItem } from '@/core/use-cases/generate-pdf';

export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  // Normaliza DDI 55 seguido de tronco 0 (ex: +55 (084) 98636-5455)
  if (/^550+\d{10,11}$/.test(digits)) {
    digits = `55${digits.slice(2).replace(/^0+/, '')}`;
  }
  // Números nacionais com DDD (10 ou 11 dígitos, inclusive DDD 55): prefixa DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, text: string): string {
  const cleaned = cleanPhoneNumber(phone);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppConsultationSummaryUrl(params: {
  phone?: string | null;
  tutorName?: string | null;
  patientName?: string | null;
  vetName?: string | null;
  notes?: string | null;
  prescriptionText?: string | null;
  prescriptions?: PrescriptionItem[];
  totalValue?: number | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixCopiaECola?: string | null;
}): string {
  const {
    phone,
    tutorName,
    patientName,
    vetName,
    notes,
    prescriptionText,
    prescriptions,
    totalValue,
    pixKey,
    pixKeyType,
    pixCopiaECola,
  } = params;

  const safeTutorName = tutorName?.trim() || 'Tutor(a)';
  const safePatientName = patientName?.trim() || 'Paciente';
  const safeVetName = vetName?.trim() || 'Dra. Gabriela Soares';

  const greeting = `Olá, *${safeTutorName}*! Tudo bem? 🐾\nAqui é a *${safeVetName}*.\n\nSeguem as orientações e o resumo do atendimento do(a) *${safePatientName}* realizado hoje:`;

  const sections: string[] = [greeting];

  if (notes && notes.trim()) {
    sections.push(`📋 *Diagnóstico / Observações Clínicas:*\n${notes.trim()}`);
  }

  const rxBlocks: string[] = [];
  if (prescriptionText && prescriptionText.trim()) {
    rxBlocks.push(prescriptionText.trim());
  }
  if (prescriptions && prescriptions.length > 0) {
    const structuredLines = prescriptions.map((rx, idx) => {
      const medName = rx.medicationName?.trim() || 'Medicamento';
      const conc = rx.concentration?.trim();
      const title = `${idx + 1}. *${medName}*${conc ? ` (${conc})` : ''}`;
      const details = [
        rx.route?.trim() ? `Via: ${rx.route.trim()}` : '',
        rx.dosage?.trim() ? `Dose: ${rx.dosage.trim()}` : '',
        rx.frequency?.trim() ? `Frequência: ${rx.frequency.trim()}` : '',
        rx.duration?.trim() ? `Período: ${rx.duration.trim()}` : '',
      ].filter(Boolean);
      const lines = [title];
      if (details.length > 0) {
        lines.push(`   ${details.join(' • ')}`);
      }
      if (rx.instructions?.trim()) {
        lines.push(`   _Obs: ${rx.instructions.trim()}_`);
      }
      return lines.join('\n');
    });
    rxBlocks.push(structuredLines.join('\n\n'));
  }

  if (rxBlocks.length > 0) {
    sections.push(`💊 *Prescrição e Orientações:*\n${rxBlocks.join('\n\n')}`);
  }

  if (typeof totalValue === 'number' && Number.isFinite(totalValue) && totalValue > 0) {
    let financeText = `💰 *Valor Total do Atendimento:* R$ ${totalValue.toFixed(2)}`;
    if (pixKey && pixKey.trim()) {
      financeText += `\n*Chave PIX (${pixKeyType?.trim() || 'PIX'}):* \`${pixKey.trim()}\``;
      if (pixCopiaECola && pixCopiaECola.trim()) {
        financeText += `\n\n*Código PIX Copia e Cola:*\n\`${pixCopiaECola.trim()}\``;
      }
    }
    sections.push(financeText);
  }

  sections.push(
    `Qualquer alteração no quadro ou dúvida quanto às medicações, pode me chamar por aqui!\nTenham uma ótima recuperação! ❤️🐶🐱`
  );

  return buildWhatsAppUrl(phone, sections.join('\n\n'));
}

export function buildWhatsAppOnMyWayUrl(params: {
  phone?: string | null;
  tutorName?: string | null;
  patientName?: string | null;
  address?: string | null;
  vetName?: string | null;
}): string {
  const { phone, tutorName, patientName, address, vetName } = params;

  const safeTutorName = tutorName?.trim() || 'Tutor(a)';
  const safePatientName = patientName?.trim() || 'Paciente';
  const safeVetName = vetName?.trim() || 'Dra. Gabriela Soares';
  const safeAddress = address?.trim();

  const text = `Olá, *${safeTutorName}*! 🚗 Aqui é a *${safeVetName}*.\n\nJá estou a caminho para o atendimento domiciliar do(a) *${safePatientName}*${
    safeAddress ? ` no endereço:\n📍 ${safeAddress}` : '.'
  }\n\nPrevisão de chegada em breve!`;

  return buildWhatsAppUrl(phone, text);
}

export function buildWhatsAppPixBillingUrl(params: {
  phone?: string | null;
  tutorName?: string | null;
  patientName?: string | null;
  totalValue: number;
  pixKey: string;
  pixKeyType?: string | null;
  pixCopiaECola?: string | null;
}): string {
  const { phone, tutorName, patientName, totalValue, pixKey, pixKeyType, pixCopiaECola } = params;

  if (typeof totalValue !== 'number' || !Number.isFinite(totalValue) || totalValue <= 0) {
    return '';
  }
  if (!pixKey || !pixKey.trim()) {
    return '';
  }

  const safeTutorName = tutorName?.trim() || 'Tutor(a)';
  const safePatientName = patientName?.trim() || 'Paciente';

  let text = `Olá, *${safeTutorName}*! Seguem os dados para acerto da consulta do(a) *${safePatientName}*:\n\n💰 *Valor:* R$ ${totalValue.toFixed(
    2
  )}\n🔑 *Chave PIX (${pixKeyType?.trim() || 'PIX'}):* \`${pixKey.trim()}\``;

  if (pixCopiaECola && pixCopiaECola.trim()) {
    text += `\n\n📋 *Código PIX Copia e Cola:*\n\`${pixCopiaECola.trim()}\``;
  }

  text += `\n\nMuito obrigada pela confiança no cuidado do seu pet! ❤️`;

  return buildWhatsAppUrl(phone, text);
}

export function buildWazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}
