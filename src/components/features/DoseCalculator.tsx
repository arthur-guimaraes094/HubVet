"use client";

import React, { useState } from 'react';
import { calculateDose } from '@/core/use-cases/calculateDose';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function DoseCalculator() {
  const [weight, setWeight] = useState<string>('');
  const [dose, setDose] = useState<string>('');
  const [concentration, setConcentration] = useState<string>('');
  const [result, setResult] = useState<number | null>(null);

  const handleCalculate = () => {
    const w = parseFloat(weight);
    const d = parseFloat(dose);
    const c = parseFloat(concentration);

    if (!isNaN(w) && !isNaN(d) && !isNaN(c)) {
      setResult(calculateDose({ weightKg: w, doseMgPerKg: d, concentrationMgPerMl: c }));
    } else {
      setResult(null);
    }
  };

  return (
    <Card className="flex flex-col gap-4 w-full max-w-md mx-auto">
      <h3 className="text-xl font-extrabold text-primary mb-2">Calculadora Rápida</h3>
      
      <Input 
        label="Peso do Animal (kg)" 
        type="number" 
        step="0.1"
        value={weight} 
        onChange={(e) => setWeight(e.target.value)} 
        placeholder="Ex: 5.2" 
      />
      
      <Input 
        label="Dose Recomendada (mg/kg)" 
        type="number" 
        step="0.1"
        value={dose} 
        onChange={(e) => setDose(e.target.value)} 
        placeholder="Ex: 2.0" 
      />
      
      <Input 
        label="Concentração (mg/ml)" 
        type="number" 
        step="0.1"
        value={concentration} 
        onChange={(e) => setConcentration(e.target.value)} 
        placeholder="Ex: 10" 
      />

      <Button variant="primary" className="mt-4" onClick={handleCalculate}>
        Calcular Volume
      </Button>

      {result !== null && (
        <div className="mt-4 p-4 rounded-xl bg-success/10 border border-success/20 shadow-neu-pressed flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-success">Volume a Administrar</span>
          <span className="text-4xl font-extrabold text-success mt-1">{result} ml</span>
        </div>
      )}
    </Card>
  );
}
