import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateDose } from '../../src/core/use-cases/calculateDose';
import { formatPatientAge, calculateYearsAndMonths } from '../../src/core/utils/age';
import { calculateVaccineSchedule } from '../../src/core/use-cases/vaccine-protocols';
import { generatePixPayload, generatePixQrCodeSvg } from '../../src/core/utils/pix';
import { validateImageUpload, stripImageMetadata } from '../../src/core/utils/upload-validation';
import { getBrazilDateString, getBrazilDayBoundsUtc } from '../../src/core/utils/timezone';
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
