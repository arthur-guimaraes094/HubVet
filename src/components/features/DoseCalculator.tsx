"use client";

import React, { useState } from 'react';
import { calculateDose } from '@/core/use-cases/calculateDose';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface DoseCalculationResult {
  volumeMl: number;
  totalMg: number;
}

function parsePositiveDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function DoseCalculator() {
  const [weight, setWeight] = useState<string>('');
  const [dose, setDose] = useState<string>('');
  const [concentration, setConcentration] = useState<string>('');
  const [result, setResult] = useState<DoseCalculationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const w = parsePositiveDecimal(weight);
    const d = parsePositiveDecimal(dose);
    const c = parsePositiveDecimal(concentration);

    if (w === null || d === null || c === null) {
      setResult(null);
      if (w === null && !weight.trim() && d === null && !dose.trim() && c === null && !concentration.trim()) {
        setErrorMessage('Preencha peso, dose recomendada e concentração com valores maiores que zero.');
      } else if (w === null) {
        setErrorMessage('Informe um peso válido maior que zero (kg).');
      } else if (d === null) {
        setErrorMessage('Informe uma dose recomendada válida maior que zero (mg/kg).');
      } else {
        setErrorMessage('Informe uma concentração válida maior que zero (mg/ml).');
      }
      return;
    }

    const rawTotalMg = w * d;
    const volumeMl = calculateDose({ weightKg: w, doseMgPerKg: d, concentrationMgPerMl: c });
    if (!Number.isFinite(rawTotalMg) || rawTotalMg <= 0 || !Number.isFinite(volumeMl) || volumeMl <= 0) {
      setResult(null);
      setErrorMessage('Os valores informados resultam em um volume inválido ou fora da faixa mensurável.');
      return;
    }

    setErrorMessage(null);
    setResult({
      volumeMl,
      totalMg: Number(rawTotalMg.toFixed(4)),
    });
  };

  return (
    <Card className="flex flex-col gap-4 w-full max-w-md mx-auto">
      <h2 className="text-xl font-extrabold text-primary mb-2">Calculadora Rápida</h2>

      <form onSubmit={handleCalculate} noValidate className="flex flex-col gap-4">
        <Input
          label="Peso do Animal (kg)"
          type="text"
          inputMode="decimal"
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Ex: 5,2"
          aria-invalid={Boolean(errorMessage)}
        />

        <Input
          label="Dose Recomendada (mg/kg)"
          type="text"
          inputMode="decimal"
          value={dose}
          onChange={(e) => {
            setDose(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Ex: 2,0"
          aria-invalid={Boolean(errorMessage)}
        />

        <Input
          label="Concentração (mg/ml)"
          type="text"
          inputMode="decimal"
          value={concentration}
          onChange={(e) => {
            setConcentration(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Ex: 10"
          aria-invalid={Boolean(errorMessage)}
        />

        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-error/10 border border-error/30 text-sm font-bold text-red-700 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <Button type="submit" variant="primary" className="mt-2">
          Calcular Volume
        </Button>
      </form>

      {result !== null && !errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-success/10 border border-success/30 shadow-inner flex flex-col items-center justify-center gap-1">
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            Volume a Administrar
          </span>
          <span className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            {result.volumeMl} ml
          </span>
          <span className="text-sm font-bold text-emerald-700/90 dark:text-emerald-300/90 mt-1">
            Dose total: {result.totalMg} mg
          </span>
        </div>
      )}
    </Card>
  );
}
