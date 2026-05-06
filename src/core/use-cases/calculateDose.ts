export interface DoseCalculationParams {
  weightKg: number;
  doseMgPerKg: number;
  concentrationMgPerMl: number;
}

export function calculateDose(params: DoseCalculationParams): number {
  if (params.concentrationMgPerMl <= 0) return 0;
  if (params.weightKg <= 0 || params.doseMgPerKg <= 0) return 0;

  const totalMg = params.weightKg * params.doseMgPerKg;
  const volumeMl = totalMg / params.concentrationMgPerMl;

  // Arredonda para 2 casas decimais
  return Math.round(volumeMl * 100) / 100;
}
