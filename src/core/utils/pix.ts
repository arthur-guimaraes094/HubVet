import QRCode from 'qrcode';

interface PixPayloadParams {
  key: string;
  name?: string;
  city?: string;
  amount?: number;
  txId?: string;
}

function formatField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * conforme a especificação do Banco Central do Brasil para o padrão EMVCo do PIX.
 */
function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
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
  name = 'Dra Gabriela Soares',
  city = 'Natal',
  amount,
  txId = '***',
}: PixPayloadParams): string {
  const cleanKey = key.trim();
  if (!cleanKey) return '';

  const sub26 = formatField('00', 'br.gov.bcb.pix') + formatField('01', cleanKey);

  let payload =
    formatField('00', '01') +
    formatField('26', sub26) +
    formatField('52', '0000') +
    formatField('53', '986');

  if (amount && amount > 0) {
    payload += formatField('54', amount.toFixed(2));
  }

  const normName =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .slice(0, 25)
      .trim() || 'VETERINARIO';

  const normCity =
    city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .slice(0, 15)
      .trim() || 'NATAL';

  payload += formatField('58', 'BR');
  payload += formatField('59', normName);
  payload += formatField('60', normCity);

  const sub62 = formatField('05', txId || '***');
  payload += formatField('62', sub62);

  payload += '6304';
  const checksum = crc16Ccitt(payload);
  return `${payload}${checksum}`;
}

/**
 * Gera um Data URL (base64 image/png) com o QR Code a partir do payload PIX.
 */
export async function generatePixQrCodeDataUrl(
  pixPayload: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  if (!pixPayload) return '';
  return QRCode.toDataURL(pixPayload, {
    width: options?.width || 260,
    margin: options?.margin ?? 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}
