import { qrcodegen } from './qrcodegen';

interface PixPayloadParams {
  key: string;
  keyType?: string;
  name?: string;
  city?: string;
  amount?: number;
  txId?: string;
}

const utf8Encoder = new TextEncoder();

/**
 * Trunca uma string para no máximo `maxBytes` bytes UTF-8 sem partir caracteres multibyte.
 */
function capUtf8Bytes(value: string, maxBytes: number): { text: string; byteLength: number } {
  const encoded = utf8Encoder.encode(value);
  if (encoded.length <= maxBytes) {
    return { text: value, byteLength: encoded.length };
  }

  let text = '';
  let byteLength = 0;
  for (const char of value) {
    const charByteLength = utf8Encoder.encode(char).length;
    if (byteLength + charByteLength > maxBytes) {
      break;
    }
    text += char;
    byteLength += charByteLength;
  }

  return { text, byteLength: utf8Encoder.encode(text).length };
}

/**
 * Normaliza a chave PIX conforme o padrão DICT/EMVCo do Banco Central:
 * - CPF/CNPJ: apenas dígitos
 * - Telefone: formato E.164 com +55 (ex: +5584986365455), removendo zero de tronco
 * - E-mail: minúsculas
 */
function normalizePixKey(key: string, keyType?: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';

  const type = (keyType || '').trim().toLowerCase();

  if (type === 'cpf' || type === 'cnpj') {
    return trimmed.replace(/\D/g, '');
  }

  if (type === 'telefone' || type === 'phone') {
    if (trimmed.startsWith('+')) {
      const intlDigits = trimmed.slice(1).replace(/\D/g, '');
      return intlDigits ? `+${intlDigits}` : '';
    }
    const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) return '';
    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      return `+${digits}`;
    }
    return trimmed;
  }

  if (type === 'email' || type === 'e-mail') {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function normalizeTxId(txId?: string): string {
  const trimmed = (txId ?? '').trim();
  if (!trimmed || trimmed === '***') return '***';
  const sanitized = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  return sanitized || '***';
}

function formatField(id: string, value: string): string {
  const { text, byteLength } = capUtf8Bytes(value, 99);
  const len = String(byteLength).padStart(2, '0');
  return `${id}${len}${text}`;
}

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * sobre os bytes UTF-8 conforme a especificação do Banco Central do Brasil para o padrão EMVCo do PIX.
 */
function crc16Ccitt(str: string): string {
  const bytes = utf8Encoder.encode(str);
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera a string no formato oficial do Banco Central (EMVCo BR Code / PIX Copia e Cola).
 */
export function generatePixPayload({
  key,
  keyType,
  name = 'Dra Gabriela Soares',
  city = 'Natal',
  amount,
  txId = '***',
}: PixPayloadParams): string {
  const cleanKey = normalizePixKey(key, keyType);
  if (!cleanKey) return '';

  // Tag 26 comporta até 99 bytes: '0014br.gov.bcb.pix' (18) + '01LL' (4) = 22 bytes fixos -> até 77 bytes para a chave
  const { text: safeKey } = capUtf8Bytes(cleanKey, 77);
  const sub26 = formatField('00', 'br.gov.bcb.pix') + formatField('01', safeKey);

  let payload =
    formatField('00', '01') +
    formatField('26', sub26) +
    formatField('52', '0000') +
    formatField('53', '986');

  if (
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount >= 0.01 &&
    amount <= 99999999.99
  ) {
    payload += formatField('54', amount.toFixed(2));
  }

  const normName =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 25)
      .trim() || 'VETERINARIO';

  const normCity =
    city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15)
      .trim() || 'NATAL';

  payload += formatField('58', 'BR');
  payload += formatField('59', normName);
  payload += formatField('60', normCity);

  const sub62 = formatField('05', normalizeTxId(txId));
  payload += formatField('62', sub62);

  payload += '6304';
  const checksum = crc16Ccitt(payload);
  return `${payload}${checksum}`;
}

/**
 * Gera o SVG vetorial do QR Code PIX (compatível 100% com o leitor de qualquer app bancário).
 * Utiliza o gerador QR Code puro em TypeScript (zero dependências externas).
 */
export function generatePixQrCodeSvg(pixPayload: string, border: number = 2): string {
  if (!pixPayload) return '';
  const qr = qrcodegen.QrCode.encodeText(pixPayload, qrcodegen.QrCode.Ecc.MEDIUM);
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) {
        parts.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }
  }
  const viewSize = qr.size + border * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" stroke="none" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <path d="${parts.join(' ')}" fill="#000000"/>
</svg>`;
}

/**
 * Gera um Data URL (image/svg+xml) com o QR Code a partir do payload PIX.
 */
export async function generatePixQrCodeDataUrl(
  pixPayload: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  if (!pixPayload) return '';
  const margin = options?.margin ?? 2;
  const svg = generatePixQrCodeSvg(pixPayload, margin);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
