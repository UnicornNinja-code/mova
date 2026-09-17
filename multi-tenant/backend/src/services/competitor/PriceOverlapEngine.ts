/*
 * PriceOverlapEngine.ts
 * Pure Mathematical Calculation Engine for Competitor Price Overlap & Prior Benchmarks
 */

export const CATEGORY_PRICE_PRIORS_VERSION = "v1";

/**
 * Category-Tiered Price Prior Benchmarks (Version 1)
 * Used as authoritative fallback for Global OSM POIs lacking explicit price tags.
 */
export const CATEGORY_PRICE_PRIORS_V1: Record<string, { min: number; max: number }> = {
  WARUNG_KOPI: { min: 5000, max: 15000 },
  GIRAS: { min: 5000, max: 15000 },
  STREET_VENDOR: { min: 5000, max: 15000 },
  KOPI_KELILING: { min: 8000, max: 18000 },
  BOOTH: { min: 8000, max: 18000 },
  MINUMAN: { min: 8000, max: 18000 },
  FAST_FOOD: { min: 15000, max: 35000 },
  BAKERY: { min: 15000, max: 35000 },
  FOOD_COURT: { min: 15000, max: 35000 },
  CAFE: { min: 25000, max: 70000 },
  RESTAURANT: { min: 30000, max: 100000 },
  SPECIALTY_COFFEE: { min: 30000, max: 80000 },
};

/**
 * Pure function: Menghitung skor irisan rentang harga (Price Overlap Score: 0.0 - 1.0)
 * Formula: S_price = max(0, min(T_max, C_max) - max(T_min, C_min)) / (T_max - T_min)
 */
export function calculatePriceOverlap(
  tenantMin: number,
  tenantMax: number,
  compMin: number,
  compMax: number
): number {
  // Input validation guards
  if (
    typeof tenantMin !== "number" ||
    typeof tenantMax !== "number" ||
    typeof compMin !== "number" ||
    typeof compMax !== "number" ||
    tenantMin < 0 ||
    tenantMax < 0 ||
    compMin < 0 ||
    compMax < 0 ||
    tenantMin > tenantMax ||
    compMin > compMax
  ) {
    throw new Error("INVALID_PRICE_RANGE: Nilai rentang harga harus berupa angka non-negatif dengan min <= max.");
  }

  // Edge case: Single-price tenant (T_max == T_min)
  if (tenantMax === tenantMin) {
    return tenantMin >= compMin && tenantMin <= compMax ? 1.0 : 0.0;
  }

  const overlapStart = Math.max(tenantMin, compMin);
  const overlapEnd = Math.min(tenantMax, compMax);
  const overlapLength = Math.max(0, overlapEnd - overlapStart);
  const tenantSpan = tenantMax - tenantMin;

  const score = overlapLength / tenantSpan;
  return Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));
}

/**
 * Helper: Mengambil estimasi rentang harga berdasarkan kategori POI (Category Price Prior V1)
 */
export function resolveCategoryPricePrior(category: string): { min: number; max: number } | null {
  const normCategory = category.toUpperCase().replace(/\s+/g, "_");
  return CATEGORY_PRICE_PRIORS_V1[normCategory] || null;
}
