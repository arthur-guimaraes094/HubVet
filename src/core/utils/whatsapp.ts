/**
 * Utilitários para formatação e envio de mensagens pelo WhatsApp e links de navegação GPS.
 */

export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Se começar com DDD brasileiro (ex: 84999998888 com 10 ou 11 dígitos), adiciona 55
  if (digits.length >= 10 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppConsultationSummaryUrl(params: {
  phone?: string | null;
  tutorName?: string | null;
  patientName?: string | null;
  vetName?: string | null;
  notes?: string | null;
  prescriptionText?: string | null;
  totalValue?: number | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixCopiaECola?: string | null;
}): string {
  const {
    phone,
    tutorName = 'Tutor(a)',
    patientName = 'Paciente',
    vetName = 'Dra. Gabriela Soares',
    notes,
    prescriptionText,
    totalValue,
    pixKey,
    pixKeyType,
    pixCopiaECola,
  } = params;

  if (!phone) return '';

  const greeting = `Olá, *${tutorName}*! Tudo bem? 🐾\nAqui é a *${vetName}*.\n\nSeguem as orientações e o resumo do atendimento do(a) *${patientName}* realizado hoje:`;

  const sections: string[] = [greeting];

  if (notes && notes.trim()) {
    sections.push(`📋 *Diagnóstico / Observações Clínicas:*\n${notes.trim()}`);
  }

  if (prescriptionText && prescriptionText.trim()) {
    sections.push(`💊 *Prescrição e Orientações:*\n${prescriptionText.trim()}`);
  }

  if (totalValue && totalValue > 0) {
    let financeText = `💰 *Valor Total do Atendimento:* R$ ${totalValue.toFixed(2)}`;
    if (pixKey && pixKey.trim()) {
      financeText += `\n*Chave PIX (${pixKeyType || 'PIX'}):* \`${pixKey.trim()}\``;
      if (pixCopiaECola) {
        financeText += `\n\n*Código PIX Copia e Cola:*\n\`${pixCopiaECola}\``;
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
  const {
    phone,
    tutorName = 'Tutor(a)',
    patientName = 'Paciente',
    address,
    vetName = 'Dra. Gabriela Soares',
  } = params;

  if (!phone) return '';

  const text = `Olá, *${tutorName}*! 🚗 Aqui é a *${vetName}*.\n\nJá estou a caminho para o atendimento domiciliar do(a) *${patientName}*${
    address ? ` no endereço:\n📍 ${address}` : '.'
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
  const {
    phone,
    tutorName = 'Tutor(a)',
    patientName = 'Paciente',
    totalValue,
    pixKey,
    pixKeyType,
    pixCopiaECola,
  } = params;

  if (!phone) return '';

  let text = `Olá, *${tutorName}*! Seguem os dados para acerto da consulta do(a) *${patientName}*:\n\n💰 *Valor:* R$ ${totalValue.toFixed(
    2
  )}\n🔑 *Chave PIX (${pixKeyType || 'PIX'}):* \`${pixKey.trim()}\``;

  if (pixCopiaECola) {
    text += `\n\n📋 *Código PIX Copia e Cola:*\n\`${pixCopiaECola}\``;
  }

  text += `\n\nMuito obrigada pela confiança no cuidado do seu pet! ❤️`;

  return buildWhatsAppUrl(phone, text);
}

export function buildWazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
