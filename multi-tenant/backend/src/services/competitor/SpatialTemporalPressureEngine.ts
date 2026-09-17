/*
 * SpatialTemporalPressureEngine.ts
 * Pure Mathematical Calculation Engine for Spatial Decay, Overnight Temporal Windows, and Pressure
 */

/**
 * Pure function: Menghitung faktor peluruhan jarak (Spatial Decay: 0.0 - 1.0)
 * Formula: 1 - (distance / radius) jika distance <= radius, sebaliknya 0.0
 */
export function calculateSpatialDecay(distanceMeters: number, radiusMeters: number): number {
  if (radiusMeters <= 0) {
    throw new Error("INVALID_RADIUS: Radius pencarian harus lebih besar dari 0 meter.");
  }
  if (distanceMeters < 0) {
    throw new Error("INVALID_DISTANCE: Jarak spasial tidak boleh negatif.");
  }

  if (distanceMeters > radiusMeters) {
    return 0.0;
  }

  const decay = 1.0 - distanceMeters / radiusMeters;
  return Math.min(1.0, Math.max(0.0, Number(decay.toFixed(4))));
}

/**
 * Pure function: Menghitung faktor keselarasan jam operasional (Temporal Factor: 0.2 - 1.0)
 * Mendukung jendela operasional normal (contoh: 06:00 - 22:00)
 * dan jendela operasional lintas malam / overnight (contoh: 20:00 - 04:00).
 */
export function calculateTemporalFactor(
  operatingStart?: string | null,
  operatingEnd?: string | null,
  targetTime?: string | null
): number {
  // Jika data jam operasional tidak disediakan, gunakan baseline medium factor (0.7)
  if (!operatingStart || !operatingEnd || !targetTime) {
    return 0.7;
  }

  const toMinutes = (timeStr: string): number => {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  const startMin = toMinutes(operatingStart);
  const endMin = toMinutes(operatingEnd);
  const targetMin = toMinutes(targetTime);

  let isActive = false;

  if (startMin <= endMin) {
    // Normal single-day window (e.g., 06:00 to 22:00)
    isActive = targetMin >= startMin && targetMin <= endMin;
  } else {
    // Overnight window crossing midnight (e.g., 20:00 to 04:00)
    isActive = targetMin >= startMin || targetMin <= endMin;
  }

  return isActive ? 1.0 : 0.2;
}

/**
 * Pure function: Menghitung tekanan kompetitif individual (P_i)
 * Formula: P_i = R_i * spatialDecay * temporalFactor * confidence
 */
export function calculateCompetitivePressure(
  relevanceScore: number,
  spatialDecay: number,
  temporalFactor: number,
  confidence: number
): number {
  if (confidence < 0.5 || confidence > 1.0) {
    throw new Error("INVALID_CONFIDENCE: Nilai keyakinan observasi harus berada dalam rentang [0.5, 1.0].");
  }

  const r = Math.min(1.0, Math.max(0.0, relevanceScore));
  const s = Math.min(1.0, Math.max(0.0, spatialDecay));
  const t = Math.min(1.0, Math.max(0.2, temporalFactor));
  const c = confidence;

  const pressure = r * s * t * c;
  return Number(pressure.toFixed(4));
}
