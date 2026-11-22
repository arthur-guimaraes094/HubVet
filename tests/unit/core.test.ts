import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateDose } from '../../src/core/use-cases/calculateDose';
import {
  formatPatientAge,
  calculateYearsAndMonths,
  estimateBirthDateFromAge,
} from '../../src/core/utils/age';
import {
  calculateVaccineSchedule,
  buildWhatsAppVaccineReminderUrl,
} from '../../src/core/use-cases/vaccine-protocols';
import { generatePixPayload, generatePixQrCodeSvg } from '../../src/core/utils/pix';
import { validateImageUpload, stripImageMetadata } from '../../src/core/utils/upload-validation';
import {
  getBrazilDateString,
  getBrazilDayBoundsUtc,
  getBrazilTimeString,
  formatBrazilDate,
} from '../../src/core/utils/timezone';
import {
  cleanPhoneNumber,
  buildWhatsAppConsultationSummaryUrl,
} from '../../src/core/utils/whatsapp';
import { sanitizePdfText, sanitizeFilenamePart } from '../../src/core/use-cases/generate-pdf';
import {
  getCatalogOptionLabels,
  findCatalogItemByLabel,
} from '../../src/core/data/vet-supplies-catalog';
import {
  parseStorageRef,
  isAllowedStorageRef,
  normalizeStorageRef,
} from '../../src/infrastructure/storage/media';
import { isTrustedPushEndpoint } from '../../src/core/utils/push-endpoint';

test('calculateDose - calcula corretamente o volume em mL', () => {
  // Cão de 10kg, dose 5mg/kg, concentração 50mg/mL -> 1mL
  const dose = calculateDose({
    weightKg: 10,
    doseMgPerKg: 5,
    concentrationMgPerMl: 50,
  });
  assert.equal(dose, 1);

  // Cão de 4.5kg, dose 2.5mg/kg, concentração 20mg/mL -> 0.56mL
  const doseDecimal = calculateDose({
    weightKg: 4.5,
    doseMgPerKg: 2.5,
    concentrationMgPerMl: 20,
  });
  assert.equal(doseDecimal, 0.56);

  // Valores inválidos retornam 0
  assert.equal(calculateDose({ weightKg: 0, doseMgPerKg: 5, concentrationMgPerMl: 50 }), 0);
  assert.equal(calculateDose({ weightKg: 10, doseMgPerKg: 5, concentrationMgPerMl: 0 }), 0);
});

test('formatPatientAge - calcula anos e meses de forma amigável', () => {
  assert.equal(formatPatientAge(null), '');
  assert.equal(formatPatientAge(undefined), '');
  assert.equal(formatPatientAge('data-invalida'), '');

  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const formatLocalYmd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const ageStr = formatPatientAge(formatLocalYmd(twoYearsAgo));
  assert.match(ageStr, /2 anos/);

  // Garante interpretação em horário local (sem recuo de dia em UTC-3)
  assert.deepEqual(calculateYearsAndMonths(formatLocalYmd(twoYearsAgo)), { years: 2, months: 0 });
  const twoYearsMinusOneDay = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate() + 1);
  assert.deepEqual(calculateYearsAndMonths(formatLocalYmd(twoYearsMinusOneDay)), {
    years: 1,
    months: 11,
  });
});

test('calculateVaccineSchedule - aplica regra de 21 dias para V10 e 365 dias para reforço anual', () => {
  // Dose 1 de V10 Vanguard
  const dose1 = calculateVaccineSchedule({
    protocolCode: 'V10_VANGUARD',
    doseStage: 'dose_1',
    appliedDate: '2026-05-01',
  });
  assert.equal(dose1.doseNumber, 1);
  assert.equal(dose1.nextDueDate, '2026-05-22'); // +21 dias
  assert.equal(dose1.isAnnualBooster, false);

  // Reforço anual
  const annual = calculateVaccineSchedule({
    protocolCode: 'V10_VANGUARD',
    doseStage: 'annual',
    appliedDate: '2026-05-01',
  });
  assert.equal(annual.isAnnualBooster, true);
  assert.equal(annual.nextDueDate, '2027-05-01'); // +365 dias
});

test('generatePixPayload - gera payload no padrão EMVCo do Banco Central com checksum CRC16', () => {
  const payload = generatePixPayload({
    key: '12345678900',
    name: 'Dra Gabriela Soares',
    city: 'Natal',
    amount: 150.0,
  });

  // O payload deve iniciar com o formato padrão EMVCo
  assert.ok(payload.startsWith('00020126330014br.gov.bcb.pix011112345678900'));
  // Deve conter valor formatado
  assert.ok(payload.includes('5406150.00'));
  // Deve conter moeda BRL (986) e país BR
  assert.ok(payload.includes('5303986'));
  assert.ok(payload.includes('5802BR'));
  // Deve terminar com o indicador 6304 seguido de 4 caracteres hexadecimais (CRC16)
  assert.match(payload, /6304[0-9A-F]{4}$/);

  // SVG vetorial deve ser gerado sem erros
  const svg = generatePixQrCodeSvg(payload);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('</svg>'));
});

test('generatePixPayload - normaliza chave Telefone (+55), CPF formatado e caracteres ASCII', () => {
  const phonePlain = generatePixPayload({
    key: '84986365455',
    keyType: 'Telefone',
    name: 'Dra. Gabriela Soares',
    city: 'Natal - RN',
    amount: 95.5,
  });
  assert.ok(phonePlain.includes('0014br.gov.bcb.pix0114+5584986365455'));
  assert.ok(phonePlain.includes('5919Dra Gabriela Soares'));
  assert.ok(phonePlain.includes('6008Natal RN'));
  assert.match(phonePlain, /6304[0-9A-F]{4}$/);

  const phoneFormatted = generatePixPayload({
    key: '(84) 98636-5455',
    keyType: 'Telefone',
  });
  assert.ok(phoneFormatted.includes('0014br.gov.bcb.pix0114+5584986365455'));

  const cpfFormatted = generatePixPayload({
    key: '123.456.789-00',
    keyType: 'CPF',
  });
  assert.ok(cpfFormatted.includes('0014br.gov.bcb.pix011112345678900'));
});

test('validateImageUpload - valida MIME, tamanho e magic bytes reais', async () => {
  const validJpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])], 'foto.jpg', {
    type: 'image/jpeg',
  });
  const jpegRes = await validateImageUpload(validJpeg);
  assert.deepEqual(jpegRes, { valid: true, extension: 'jpg', contentType: 'image/jpeg' });

  const validPng = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    'foto.png',
    { type: 'image/png' }
  );
  const pngRes = await validateImageUpload(validPng);
  assert.deepEqual(pngRes, { valid: true, extension: 'png', contentType: 'image/png' });

  const validWebp = new File(
    [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])],
    'foto.webp',
    { type: 'image/webp' }
  );
  const webpRes = await validateImageUpload(validWebp);
  assert.deepEqual(webpRes, { valid: true, extension: 'webp', contentType: 'image/webp' });

  const rejectedGif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], 'foto.gif', {
    type: 'image/gif',
  });
  const gifRes = await validateImageUpload(rejectedGif);
  assert.equal(gifRes.valid, false);

  // HTML disfarçado com MIME de JPEG deve ser rejeitado
  const fakeJpg = new File([new TextEncoder().encode('<html><script>alert(1)</script></html>')], 'evil.jpg', {
    type: 'image/jpeg',
  });
  const fakeRes = await validateImageUpload(fakeJpg);
  assert.equal(fakeRes.valid, false);

  // SVG não é permitido
  const svgFile = new File([new TextEncoder().encode('<svg></svg>')], 'icon.svg', {
    type: 'image/svg+xml',
  });
  const svgRes = await validateImageUpload(svgFile);
  assert.equal(svgRes.valid, false);

  // Arquivo acima do limite de tamanho
  const oversized = new File([new Uint8Array(1024 * 1024 * 5)], 'big.jpg', {
    type: 'image/jpeg',
  });
  const sizeRes = await validateImageUpload(oversized, 4 * 1024 * 1024);
  assert.equal(sizeRes.valid, false);

  // Arquivo vazio
  const empty = new File([], 'empty.jpg', { type: 'image/jpeg' });
  const emptyRes = await validateImageUpload(empty);
  assert.equal(emptyRes.valid, false);
});

test('timezone BRT - calcula corretamente a data e os limites UTC para America/Fortaleza', () => {
  // 2026-11-22T01:30:00Z corresponde a 21/11/2026 22:30 em BRT (UTC-3)
  const lateNightUtc = new Date('2026-11-22T01:30:00.000Z');
  const bounds = getBrazilDayBoundsUtc(lateNightUtc);

  assert.equal(bounds.dateStr, '2026-11-21');
  assert.equal(bounds.startOfDayUtc, '2026-11-21T03:00:00.000Z');
  assert.equal(bounds.endOfDayUtc, '2026-11-22T02:59:59.999Z');
  assert.equal(getBrazilDateString(lateNightUtc, 7), '2026-11-28');
});

function hasByteSequence(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc, false);
  return chunk;
}

test('stripImageMetadata - remove metadados EXIF/tEXt/eXIf preservando estrutura JPEG, PNG e WebP', () => {
  // JPEG com SOI + APP0 (JFIF) + APP1 (EXIF) + COM + SOS + EOI
  const jpegBytes = Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0 JFIF
    0xff, 0xe1, 0x00, 0x0e, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x31, 0x32, 0x33, // APP1 Exif + GPS123
    0xff, 0xfe, 0x00, 0x08, 0x4e, 0x6f, 0x74, 0x65, 0x31, 0x32, // COM Note12
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // SOS header
    0x11, 0x22, 0x33, // entropy stream
    0xff, 0xd9, // EOI
  ]);
  const strippedJpeg = stripImageMetadata(jpegBytes, 'image/jpeg');
  assert.equal(strippedJpeg[0], 0xff);
  assert.equal(strippedJpeg[1], 0xd8);
  assert.equal(strippedJpeg[2], 0xff);
  assert.equal(strippedJpeg[strippedJpeg.length - 2], 0xff);
  assert.equal(strippedJpeg[strippedJpeg.length - 1], 0xd9);
  assert.ok(strippedJpeg.length < jpegBytes.length);
  assert.equal(hasByteSequence(strippedJpeg, Uint8Array.of(0xff, 0xe1)), false);
  assert.equal(hasByteSequence(strippedJpeg, new TextEncoder().encode('GPS123')), false);
  assert.equal(hasByteSequence(strippedJpeg, Uint8Array.of(0xff, 0xfe)), false);
  assert.equal(hasByteSequence(strippedJpeg, Uint8Array.of(0xff, 0xda)), true);

  // PNG com assinatura + IHDR + eXIf + tEXt + IDAT + IEND
  const pngSig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = makePngChunk(
    'IHDR',
    Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])
  );
  const exif = makePngChunk('eXIf', new TextEncoder().encode('MM\0*\0\0\0\x08'));
  const text = makePngChunk('tEXt', new TextEncoder().encode('Comment\0GPS-Loc'));
  const idat = makePngChunk('IDAT', Uint8Array.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]));
  const iend = makePngChunk('IEND', new Uint8Array(0));
  const pngBytes = new Uint8Array(
    pngSig.length + ihdr.length + exif.length + text.length + idat.length + iend.length
  );
  let offset = 0;
  for (const part of [pngSig, ihdr, exif, text, idat, iend]) {
    pngBytes.set(part, offset);
    offset += part.length;
  }

  const strippedPng = stripImageMetadata(pngBytes, 'image/png');
  assert.deepEqual(strippedPng.subarray(0, 8), pngSig);
  assert.equal(hasByteSequence(strippedPng, new TextEncoder().encode('IHDR')), true);
  assert.equal(hasByteSequence(strippedPng, new TextEncoder().encode('IDAT')), true);
  assert.equal(hasByteSequence(strippedPng, new TextEncoder().encode('IEND')), true);
  assert.equal(hasByteSequence(strippedPng, new TextEncoder().encode('eXIf')), false);
  assert.equal(hasByteSequence(strippedPng, new TextEncoder().encode('tEXt')), false);
  assert.equal(hasByteSequence(strippedPng, new TextEncoder().encode('GPS-Loc')), false);
  assert.deepEqual(strippedPng.subarray(strippedPng.length - iend.length), iend);

  // WebP com VP8X (flags EXIF/XMP), VP8, EXIF e XMP
  const vp8xPayload = Uint8Array.from([0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const webpSubchunks = [
    new TextEncoder().encode('VP8X'), Uint8Array.from([10, 0, 0, 0]), vp8xPayload,
    new TextEncoder().encode('VP8 '), Uint8Array.from([4, 0, 0, 0]), Uint8Array.from([1, 2, 3, 4]),
    new TextEncoder().encode('EXIF'), Uint8Array.from([4, 0, 0, 0]), new TextEncoder().encode('GPS!'),
    new TextEncoder().encode('XMP '), Uint8Array.from([4, 0, 0, 0]), new TextEncoder().encode('<x/>'),
  ];
  const subLen = webpSubchunks.reduce((sum, c) => sum + c.length, 0);
  const webpBytes = new Uint8Array(12 + subLen);
  webpBytes.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(webpBytes.buffer).setUint32(4, 4 + subLen, true);
  webpBytes.set(new TextEncoder().encode('WEBP'), 8);
  let wOff = 12;
  for (const part of webpSubchunks) {
    webpBytes.set(part, wOff);
    wOff += part.length;
  }

  const strippedWebp = stripImageMetadata(webpBytes, 'image/webp');
  assert.equal(new TextDecoder().decode(strippedWebp.subarray(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(strippedWebp.subarray(8, 12)), 'WEBP');
  assert.equal(new DataView(strippedWebp.buffer, strippedWebp.byteOffset).getUint32(4, true), strippedWebp.length - 8);
  assert.equal(strippedWebp[20] & 0x0c, 0);
  assert.equal(hasByteSequence(strippedWebp, new TextEncoder().encode('EXIF')), false);
  assert.equal(hasByteSequence(strippedWebp, new TextEncoder().encode('XMP ')), false);
});

test('storage media refs - valida, faz parse e normaliza referências de Storage com segurança', () => {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let supabaseHost = 'afggyuhfcbwocfcgxgkl.supabase.co';
  if (configuredUrl) {
    try {
      supabaseHost = new URL(configuredUrl).hostname.toLowerCase();
    } catch {
      supabaseHost = 'afggyuhfcbwocfcgxgkl.supabase.co';
    }
  }

  assert.deepEqual(parseStorageRef('storage://patients/abc.jpg'), {
    bucket: 'patients',
    path: 'abc.jpg',
  });
  assert.equal(isAllowedStorageRef('storage://patients/abc.jpg'), true);
  assert.equal(normalizeStorageRef('storage://patients/abc.jpg'), 'storage://patients/abc.jpg');

  const publicUrl = `https://${supabaseHost}/storage/v1/object/public/patients/user-1/pet.png`;
  assert.deepEqual(parseStorageRef(publicUrl), {
    bucket: 'patients',
    path: 'user-1/pet.png',
  });
  assert.equal(normalizeStorageRef(publicUrl), 'storage://patients/user-1/pet.png');

  const signedUrl = `https://${supabaseHost}/storage/v1/object/sign/consultations/u1-photo.webp?token=jwt.payload.sig&t=2026`;
  assert.deepEqual(parseStorageRef(signedUrl), {
    bucket: 'consultations',
    path: 'u1-photo.webp',
  });
  assert.equal(isAllowedStorageRef(signedUrl), true);
  assert.equal(normalizeStorageRef(signedUrl), 'storage://consultations/u1-photo.webp');

  // Rejeita traversal, data URLs e domínios externos
  assert.equal(parseStorageRef('storage://patients/../avatars/secret.jpg'), null);
  assert.equal(isAllowedStorageRef('storage://patients/../avatars/secret.jpg'), false);
  assert.equal(normalizeStorageRef('storage://patients/../avatars/secret.jpg'), null);

  assert.equal(parseStorageRef('data:image/png;base64,iVBORw0KGgo='), null);
  assert.equal(isAllowedStorageRef('data:image/png;base64,iVBORw0KGgo='), false);

  assert.equal(
    parseStorageRef('https://evil.com/storage/v1/object/public/patients/abc.jpg'),
    null
  );
  assert.equal(
    isAllowedStorageRef('https://evil.com/storage/v1/object/public/patients/abc.jpg'),
    false
  );
  assert.equal(
    normalizeStorageRef('https://evil.com/storage/v1/object/public/patients/abc.jpg'),
    null
  );
});

test('isTrustedPushEndpoint - aceita endpoints HTTPS confiáveis e bloqueia SSRF/credenciais', () => {
  assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/token-123'), true);
  assert.equal(isTrustedPushEndpoint('https://android.googleapis.com/gcm/send/token-123'), true);
  assert.equal(
    isTrustedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/token-123'),
    true
  );
  assert.equal(
    isTrustedPushEndpoint('https://updates-autopush.stage.mozaws.net/wpush/v2/token-123'),
    true
  );
  assert.equal(isTrustedPushEndpoint('https://wns2-bl2p.notify.windows.com/w/?token=abc'), true);
  assert.equal(isTrustedPushEndpoint('https://web.push.apple.com/Q123456'), true);
  assert.equal(isTrustedPushEndpoint('https://sg2p.push.apple.com/3/device/abc'), true);

  assert.equal(isTrustedPushEndpoint('http://fcm.googleapis.com/fcm/send/token-123'), false);
  assert.equal(isTrustedPushEndpoint('https://127.0.0.1/push'), false);
  assert.equal(isTrustedPushEndpoint('https://evil.com/push'), false);
  assert.equal(
    isTrustedPushEndpoint('https://user:pass@fcm.googleapis.com/fcm/send/token-123'),
    false
  );
  assert.equal(isTrustedPushEndpoint('https://evilnotify.windows.com/w/?token=abc'), false);
  assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com:8443/fcm/send/token-123'), false);
});

function computeCrc16CcittUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseEmvTlv(payload: string): Array<{ tag: string; byteLength: number; value: string }> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const bytes = encoder.encode(payload);
  const fields: Array<{ tag: string; byteLength: number; value: string }> = [];
  let pos = 0;
  while (pos < bytes.length) {
    assert.ok(pos + 4 <= bytes.length, `Cabeçalho TLV truncado no byte ${pos}`);
    const tag = decoder.decode(bytes.subarray(pos, pos + 2));
    const lenStr = decoder.decode(bytes.subarray(pos + 2, pos + 4));
    assert.match(lenStr, /^\d{2}$/, `Tamanho TLV inválido "${lenStr}" para tag ${tag}`);
    const byteLength = Number(lenStr);
    const valueStart = pos + 4;
    const valueEnd = valueStart + byteLength;
    assert.ok(valueEnd <= bytes.length, `Tag ${tag} excede tamanho do payload`);
    const value = decoder.decode(bytes.subarray(valueStart, valueEnd));
    fields.push({ tag, byteLength, value });
    pos = valueEnd;
  }
  return fields;
}

test('calculateDose - suporta microdoses e rejeita entradas não finitas ou negativas', () => {
  // Microdoses < 0.1 mL preservam 3 casas decimais
  assert.equal(
    calculateDose({ weightKg: 3, doseMgPerKg: 0.05, concentrationMgPerMl: 50 }),
    0.003
  );
  assert.equal(
    calculateDose({ weightKg: 0.5, doseMgPerKg: 0.1, concentrationMgPerMl: 10 }),
    0.005
  );
  assert.equal(
    calculateDose({ weightKg: 3, doseMgPerKg: 0.15, concentrationMgPerMl: 10 }),
    0.045
  );

  // Doses muito pequenas < 0.001 mL preservam 4 casas decimais
  assert.equal(
    calculateDose({ weightKg: 0.2, doseMgPerKg: 0.1, concentrationMgPerMl: 50 }),
    0.0004
  );

  // Entradas inválidas (NaN, Infinity, -Infinity, <= 0) retornam 0
  assert.equal(
    calculateDose({ weightKg: Number.NaN, doseMgPerKg: 5, concentrationMgPerMl: 50 }),
    0
  );
  assert.equal(
    calculateDose({ weightKg: 10, doseMgPerKg: Number.POSITIVE_INFINITY, concentrationMgPerMl: 50 }),
    0
  );
  assert.equal(
    calculateDose({ weightKg: 10, doseMgPerKg: 5, concentrationMgPerMl: Number.NEGATIVE_INFINITY }),
    0
  );
  assert.equal(
    calculateDose({ weightKg: -1, doseMgPerKg: 5, concentrationMgPerMl: 50 }),
    0
  );
  assert.equal(
    calculateDose({ weightKg: 10, doseMgPerKg: -1, concentrationMgPerMl: 50 }),
    0
  );
  assert.equal(
    calculateDose({ weightKg: 10, doseMgPerKg: 5, concentrationMgPerMl: -1 }),
    0
  );
});

test('generatePixPayload - normaliza telefone com zero de tronco, omite tag 54 inválida, sanitiza txId e valida UTF-8 + CRC16', () => {
  // Telefone com zero de tronco (084) -> +5584986365455
  const trunkPhonePayload = generatePixPayload({
    key: '(084) 98636-5455',
    keyType: 'Telefone',
    amount: 120.5,
  });
  const trunkTags = parseEmvTlv(trunkPhonePayload);
  const tag26Trunk = parseEmvTlv(trunkTags.find((f) => f.tag === '26')?.value ?? '');
  assert.equal(tag26Trunk.find((f) => f.tag === '01')?.value, '+5584986365455');
  assert.equal(trunkTags.find((f) => f.tag === '54')?.value, '120.50');
  assert.equal(
    trunkPhonePayload.slice(-4),
    computeCrc16CcittUtf8(trunkPhonePayload.slice(0, -4))
  );

  // Valores inválidos ou < 0.01 omitem completamente a tag 54 (nunca emitem 54040.00)
  for (const invalidAmount of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, 0.004]) {
    const p = generatePixPayload({
      key: '12345678900',
      keyType: 'CPF',
      amount: invalidAmount,
    });
    assert.equal(p.includes('54040.00'), false);
    const parsed = parseEmvTlv(p);
    assert.equal(parsed.find((f) => f.tag === '54'), undefined);
    assert.equal(p.slice(-4), computeCrc16CcittUtf8(p.slice(0, -4)));
  }

  // Sanitização de txId: remove caracteres especiais, limita a 25 chars e cai para '***' se vazio
  const sanitizedTxPayload = generatePixPayload({
    key: '12345678900',
    txId: 'Hub-Vet #2026/01!',
  });
  const tag62Sanitized = parseEmvTlv(
    parseEmvTlv(sanitizedTxPayload).find((f) => f.tag === '62')?.value ?? ''
  );
  assert.equal(tag62Sanitized.find((f) => f.tag === '05')?.value, 'HubVet202601');

  const longTxPayload = generatePixPayload({
    key: '12345678900',
    txId: 'A12345678901234567890123456789',
  });
  const tag62Long = parseEmvTlv(
    parseEmvTlv(longTxPayload).find((f) => f.tag === '62')?.value ?? ''
  );
  const txValue = tag62Long.find((f) => f.tag === '05')?.value ?? '';
  assert.equal(txValue.length, 25);
  assert.equal(txValue, 'A123456789012345678901234');

  for (const emptyTx of ['', '   ', '---!@#']) {
    const fallbackTxPayload = generatePixPayload({
      key: '12345678900',
      txId: emptyTx,
    });
    const tag62Fallback = parseEmvTlv(
      parseEmvTlv(fallbackTxPayload).find((f) => f.tag === '62')?.value ?? ''
    );
    assert.equal(tag62Fallback.find((f) => f.tag === '05')?.value, '***');
  }

  // Comprimentos em bytes UTF-8 (multibyte) e cálculo CRC16-CCITT sobre bytes UTF-8
  const utf8Payload = generatePixPayload({
    key: 'Ação Café',
    name: 'Ação Café Veterinária',
    city: 'São José',
    amount: 75,
    txId: 'CAFÉ#01',
  });
  const utf8Tags = parseEmvTlv(utf8Payload);
  const tag26Utf8 = utf8Tags.find((f) => f.tag === '26');
  assert.ok(tag26Utf8);
  const sub26Utf8 = parseEmvTlv(tag26Utf8.value);
  const subKey = sub26Utf8.find((f) => f.tag === '01');
  assert.equal(subKey?.value, 'Ação Café');
  assert.equal(subKey?.byteLength, new TextEncoder().encode('Ação Café').length);
  assert.equal(subKey?.byteLength, 12);
  assert.equal(utf8Tags.find((f) => f.tag === '59')?.value, 'Acao Cafe Veterinaria');
  assert.equal(utf8Tags.find((f) => f.tag === '60')?.value, 'Sao Jose');
  assert.equal(
    utf8Tags.find((f) => f.tag === '63')?.value,
    computeCrc16CcittUtf8(utf8Payload.slice(0, -4))
  );

  // Chave UTF-8 longa (> 77 bytes) não deve partir caracteres multibyte
  const longUtf8Payload = generatePixPayload({
    key: 'ação'.repeat(20),
  });
  const longUtf8Tags = parseEmvTlv(longUtf8Payload);
  const longSubKey = parseEmvTlv(longUtf8Tags.find((f) => f.tag === '26')?.value ?? '').find(
    (f) => f.tag === '01'
  );
  assert.ok(longSubKey);
  assert.ok(longSubKey.byteLength <= 77);
  assert.equal(
    longUtf8Payload.slice(-4),
    computeCrc16CcittUtf8(longUtf8Payload.slice(0, -4))
  );
});

test('calculateVaccineSchedule - trata ano bissexto, dose_1 vs annual, data inválida e intervalo customizado', () => {
  // 2024-02-29 + 1 ano calendário -> 2025-02-28
  const leapAnnualV10 = calculateVaccineSchedule({
    protocolCode: 'V10_VANGUARD',
    doseStage: 'annual',
    appliedDate: '2024-02-29',
  });
  assert.equal(leapAnnualV10.nextDueDate, '2025-02-28');
  assert.equal(leapAnnualV10.isAnnualBooster, true);

  const leapRabies = calculateVaccineSchedule({
    protocolCode: 'ANTIRRABICA',
    doseStage: 'dose_1',
    appliedDate: '2024-02-29',
  });
  assert.equal(leapRabies.nextDueDate, '2025-02-28');

  // ANTIRRABICA e GRIPE_ORAL: dose_1 vs annual
  const rabiesDose1 = calculateVaccineSchedule({
    protocolCode: 'ANTIRRABICA',
    doseStage: 'dose_1',
    appliedDate: '2026-05-01',
  });
  assert.equal(rabiesDose1.isAnnualBooster, false);
  assert.equal(rabiesDose1.currentDoseLabel, 'Dose Única');
  assert.equal(rabiesDose1.nextDueDate, '2027-05-01');

  const rabiesAnnual = calculateVaccineSchedule({
    protocolCode: 'ANTIRRABICA',
    doseStage: 'annual',
    appliedDate: '2026-05-01',
  });
  assert.equal(rabiesAnnual.isAnnualBooster, true);
  assert.equal(rabiesAnnual.currentDoseLabel, 'Reforço Anual');
  assert.equal(rabiesAnnual.nextDueDate, '2027-05-01');

  const fluDose1 = calculateVaccineSchedule({
    protocolCode: 'GRIPE_ORAL',
    doseStage: 'dose_1',
    appliedDate: '2026-05-01',
  });
  assert.equal(fluDose1.isAnnualBooster, false);
  assert.equal(fluDose1.currentDoseLabel, 'Dose Única');
  assert.equal(fluDose1.nextDueDate, '2027-05-01');

  const fluAnnual = calculateVaccineSchedule({
    protocolCode: 'GRIPE_ORAL',
    doseStage: 'annual',
    appliedDate: '2026-05-01',
  });
  assert.equal(fluAnnual.isAnnualBooster, true);
  assert.equal(fluAnnual.currentDoseLabel, 'Reforço Anual');
  assert.equal(fluAnnual.nextDueDate, '2027-05-01');

  // Data inválida cai com segurança para YYYY-MM-DD válido em BRT
  for (const invalidDate of ['data-invalida', '2025-02-29', '']) {
    const fallback = calculateVaccineSchedule({
      protocolCode: 'V10_VANGUARD',
      doseStage: 'dose_1',
      appliedDate: invalidDate,
    });
    assert.match(fallback.appliedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(fallback.nextDueDate, /^\d{4}-\d{2}-\d{2}$/);
    const diffDays =
      (new Date(`${fallback.nextDueDate}T00:00:00Z`).getTime() -
        new Date(`${fallback.appliedDate}T00:00:00Z`).getTime()) /
      86_400_000;
    assert.equal(diffDays, 21);
  }

  // customIntervalDays limitado ao intervalo 1..3650
  const minInterval = calculateVaccineSchedule({
    protocolCode: 'CUSTOM',
    customVaccineName: 'Leishmaniose',
    doseStage: 'dose_1',
    appliedDate: '2026-05-01',
    customIntervalDays: 0,
  });
  assert.equal(minInterval.nextDueDate, '2026-05-02');
  assert.equal(minInterval.isAnnualBooster, false);

  const maxInterval = calculateVaccineSchedule({
    protocolCode: 'CUSTOM',
    customVaccineName: 'Reforço Longo',
    doseStage: 'dose_1',
    appliedDate: '2026-05-01',
    customIntervalDays: 99999,
  });
  assert.equal(maxInterval.nextDueDate, '2036-04-28');
  assert.equal(maxInterval.isAnnualBooster, true);
});

test('age - rejeita datas de nascimento futuras e estima nascimento válido em YYYY-MM-DD', () => {
  const futureYmd = getBrazilDateString(new Date(), 5);
  assert.equal(calculateYearsAndMonths(futureYmd), null);
  assert.equal(formatPatientAge(futureYmd), '');
  assert.equal(calculateYearsAndMonths('2099-01-15'), null);
  assert.equal(formatPatientAge('2099-01-15'), '');
  assert.equal(calculateYearsAndMonths('2025-02-29'), null);
  assert.equal(formatPatientAge('2025-02-29'), '');

  const estimated = estimateBirthDateFromAge(2, 3);
  assert.match(estimated, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(calculateYearsAndMonths(estimated), { years: 2, months: 3 });

  const estimatedZero = estimateBirthDateFromAge(0, 0);
  assert.match(estimatedZero, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(calculateYearsAndMonths(estimatedZero), null);

  const estimatedInvalid = estimateBirthDateFromAge(-2, Number.NaN);
  assert.match(estimatedInvalid, /^\d{4}-\d{2}-\d{2}$/);
});

test('whatsapp - normaliza DDD 55, tronco 0, telefone vazio, receitas combinadas e valor inválido', () => {
  assert.equal(cleanPhoneNumber('55999998888'), '5555999998888');
  assert.equal(cleanPhoneNumber('(55) 9999-8888'), '555599998888');
  assert.equal(cleanPhoneNumber('(084) 98636-5455'), '5584986365455');
  assert.equal(cleanPhoneNumber('+55 (084) 98636-5455'), '5584986365455');
  assert.equal(cleanPhoneNumber(''), '');
  assert.equal(cleanPhoneNumber(null), '');
  assert.equal(cleanPhoneNumber('() -'), '');

  // Lembrete vacinal retorna '' quando telefone está vazio
  assert.equal(
    buildWhatsAppVaccineReminderUrl({
      tutorPhone: '',
      tutorName: 'Ana',
      patientName: 'Thor',
      vaccineName: 'V10 Vanguard',
      nextDoseLabel: '2ª Dose',
      nextDueDate: '2026-06-01',
    }),
    ''
  );
  const vaccineUrl = buildWhatsAppVaccineReminderUrl({
    tutorPhone: '(084) 98636-5455',
    tutorName: 'Ana',
    patientName: 'Thor',
    vaccineName: 'V10 Vanguard',
    nextDoseLabel: '2ª Dose',
    nextDueDate: '2026-06-01',
  });
  assert.ok(vaccineUrl.startsWith('https://wa.me/5584986365455?text='));
  assert.ok(decodeURIComponent(vaccineUrl).includes('01/06/2026'));

  // Resumo da consulta renderiza prescriptionText + prescriptions juntos e omite totalValue não finito
  const summaryUrl = buildWhatsAppConsultationSummaryUrl({
    phone: '55999998888',
    tutorName: 'Carlos',
    patientName: 'Mel',
    prescriptionText: 'USO ORAL:\n1. Dipirona gotas 1x ao dia',
    prescriptions: [
      {
        id: 'rx-1',
        medicationName: 'Meloxicam (Maxicam)',
        concentration: '0.5mg',
        route: 'Uso Oral',
        dosage: '1 comprimido',
        frequency: 'A cada 24 horas',
        duration: '5 dias',
        instructions: 'Administrar após alimentação',
      },
    ],
    totalValue: Number.NaN,
  });
  assert.ok(summaryUrl.startsWith('https://wa.me/5555999998888?text='));
  const decodedSummary = new URL(summaryUrl).searchParams.get('text') ?? '';
  assert.ok(decodedSummary.includes('Dipirona gotas 1x ao dia'));
  assert.ok(decodedSummary.includes('Meloxicam (Maxicam)'));
  assert.ok(decodedSummary.includes('(0.5mg)'));
  assert.ok(decodedSummary.includes('Administrar após alimentação'));
  assert.equal(decodedSummary.includes('Valor Total'), false);
  assert.equal(decodedSummary.includes('NaN'), false);

  const emptyPhoneSummary = buildWhatsAppConsultationSummaryUrl({
    phone: '',
    tutorName: 'Carlos',
    patientName: 'Mel',
    totalValue: Number.POSITIVE_INFINITY,
  });
  assert.ok(emptyPhoneSummary.startsWith('https://wa.me/?text='));
  const decodedEmptySummary = new URL(emptyPhoneSummary).searchParams.get('text') ?? '';
  assert.equal(decodedEmptySummary.includes('Valor Total'), false);
});

test('generate-pdf - sanitiza texto para WinAnsi e gera parte segura de nome de arquivo', () => {
  const input = 'Dose ≥ 5mg/kg e ≤ 10mg/kg → 2x/dia ✓ • Obs — atenção… áçõãé 🐾👨‍⚕️';
  const sanitized = sanitizePdfText(input);
  assert.equal(
    sanitized,
    'Dose >= 5mg/kg e <= 10mg/kg -> 2x/dia [OK] • Obs — atenção… áçõãé '
  );
  assert.equal(sanitized.includes('→'), false);
  assert.equal(sanitized.includes('≥'), false);
  assert.equal(sanitized.includes('≤'), false);
  assert.equal(sanitized.includes('✓'), false);
  assert.equal(sanitized.includes('\u200D'), false);
  assert.equal(sanitized.includes('🐾'), false);

  const safePart = sanitizeFilenamePart('Rex Jr. / Cão #1');
  assert.match(safePart, /^[A-Za-z0-9_-]+$/);
  assert.equal(safePart, 'Rex_Jr_Cao_1');
  assert.equal(sanitizeFilenamePart('///🐾'), 'paciente');
});

test('vet-supplies-catalog - expõe concentrações distintas e resolve item exato pelo rótulo', () => {
  const labels = getCatalogOptionLabels();
  const expectedLabels = [
    'Meloxicam (Maxicam) — 0.5mg',
    'Meloxicam (Maxicam) — 2.0mg',
    'Amoxicilina + Clavulanato de Potássio (Agemoxi CL) — 50mg',
    'Amoxicilina + Clavulanato de Potássio (Agemoxi CL) — 250mg',
    'Prednisolona (Prediderm) — 5mg',
    'Prednisolona (Prediderm) — 20mg',
  ];

  for (const label of expectedLabels) {
    assert.ok(labels.includes(label), `Rótulo ausente no catálogo: ${label}`);
  }

  const maxicam05 = findCatalogItemByLabel('Meloxicam (Maxicam) — 0.5mg');
  assert.equal(maxicam05?.name, 'Meloxicam (Maxicam)');
  assert.equal(maxicam05?.concentration, '0.5mg');

  const maxicam20 = findCatalogItemByLabel('Meloxicam (Maxicam) — 2.0mg');
  assert.equal(maxicam20?.name, 'Meloxicam (Maxicam)');
  assert.equal(maxicam20?.concentration, '2.0mg');

  const agemoxi50 = findCatalogItemByLabel('Amoxicilina + Clavulanato de Potássio (Agemoxi CL) — 50mg');
  assert.equal(agemoxi50?.concentration, '50mg');

  const agemoxi250 = findCatalogItemByLabel('Amoxicilina + Clavulanato de Potássio (Agemoxi CL) — 250mg');
  assert.equal(agemoxi250?.concentration, '250mg');

  const pred5 = findCatalogItemByLabel('Prednisolona (Prediderm) — 5mg');
  assert.equal(pred5?.concentration, '5mg');

  const pred20 = findCatalogItemByLabel('Prednisolona (Prediderm) — 20mg');
  assert.equal(pred20?.concentration, '20mg');

  assert.equal(findCatalogItemByLabel(''), undefined);
  assert.equal(findCatalogItemByLabel('Inexistente'), undefined);
});

test('timezone BRT - formata data calendário sem recuo UTC e extrai HH:mm em Fortaleza', () => {
  assert.equal(formatBrazilDate('2026-11-21'), '21/11/2026');
  assert.equal(formatBrazilDate('2026-11-22T01:30:00.000Z'), '21/11/2026');
  assert.equal(formatBrazilDate('2025-02-29'), '');
  assert.equal(formatBrazilDate('invalid'), '');

  assert.equal(getBrazilTimeString(new Date('2026-11-22T01:30:00.000Z')), '22:30');
  assert.equal(getBrazilTimeString(new Date('2026-11-22T03:05:00.000Z')), '00:05');
  assert.equal(getBrazilTimeString(new Date('invalid')), '');
});
