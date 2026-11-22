export interface DoseCalculationParams {
  weightKg: number;
  doseMgPerKg: number;
  concentrationMgPerMl: number;
}

export function calculateDose(params: DoseCalculationParams): number {
  const { weightKg, doseMgPerKg, concentrationMgPerMl } = params;

  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(doseMgPerKg) ||
    !Number.isFinite(concentrationMgPerMl) ||
    weightKg <= 0 ||
    doseMgPerKg <= 0 ||
    concentrationMgPerMl <= 0
  ) {
    return 0;
  }

  const totalMg = weightKg * doseMgPerKg;
  const rawVolume = totalMg / concentrationMgPerMl;

  if (!Number.isFinite(rawVolume) || rawVolume <= 0) {
    return 0;
  }

  if (rawVolume < 0.001) {
    return Number(rawVolume.toFixed(4));
  }

  if (rawVolume < 0.1) {
    return Number(rawVolume.toFixed(3));
  }

  // Arredonda para 2 casas decimais para volumes >= 0.1 mL
  return Math.round(rawVolume * 100) / 100;
}
