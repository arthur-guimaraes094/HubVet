import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateDose } from '../../src/core/use-cases/calculateDose';
import { formatPatientAge, calculateYearsAndMonths } from '../../src/core/utils/age';
import { calculateVaccineSchedule } from '../../src/core/use-cases/vaccine-protocols';
import { generatePixPayload, generatePixQrCodeSvg } from '../../src/core/utils/pix';

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
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString().split('T')[0];
  const ageStr = formatPatientAge(twoYearsAgo);
  assert.match(ageStr, /2 anos/);
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
