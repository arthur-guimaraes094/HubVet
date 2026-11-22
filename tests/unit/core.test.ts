import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateDose } from '../../src/core/use-cases/calculateDose';
import { formatPatientAge, calculateYearsAndMonths } from '../../src/core/utils/age';
import { calculateVaccineSchedule } from '../../src/core/use-cases/vaccine-protocols';
import { generatePixPayload, generatePixQrCodeSvg } from '../../src/core/utils/pix';
import { validateImageUpload } from '../../src/core/utils/upload-validation';
import { getBrazilDateString, getBrazilDayBoundsUtc } from '../../src/core/utils/timezone';

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

  const validGif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], 'foto.gif', {
    type: 'image/gif',
  });
  const gifRes = await validateImageUpload(validGif);
  assert.deepEqual(gifRes, { valid: true, extension: 'gif', contentType: 'image/gif' });

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
