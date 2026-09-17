/*
 * dssExplainability.ts
 * S7-04: Mathematically Honest DSS Explainability Engine
 * Decomposes frozen Stage 3B TOPSIS/BWM outputs without altering any mathematical kernels.
 * Computes exact criterion Euclidean distance contributions, closeness indexes, and drivers/risks.
 */

export interface CriterionExplanation {
  code: string;
  name: string;
  type: "BENEFIT" | "COST";
  weight: number;
  weightPercentage: number;
  rawValue: number | string;
  rawUnit: string;
  weightedV: number;
  idealPositiveV: number;
  idealNegativeV: number;
  deltaPosSq: number; // (v_ij - v_j^+)^2
  deltaNegSq: number; // (v_ij - v_j^-)^2
  proximityPercent: number; // Distance closeness on this criterion: d_neg / (d_pos + d_neg)
  isDriver: boolean; // Close to ideal positive
  isRisk: boolean; // Far from ideal positive / close to ideal negative
  assessmentText: string;
}

export interface ZoneExplainabilityReport {
  zoneId: string;
  zoneName: string;
  rank: number;
  preferenceScore: number; // C_i
  dPos: number; // D_i^+
  dNeg: number; // D_i^-
  timeSlot: string;
  criteriaBreakdown: CriterionExplanation[];
  keyDrivers: CriterionExplanation[];
  keyRisks: CriterionExplanation[];
  narrativeSummary: {
    headline: string;
    whyRecommended: string[];
    riskFactors: string[];
    mathematicalVerdict: string;
  };
}

const CRITERIA_UNITS: Record<string, string> = {
  C1: "POI",
  C2: "Kategori",
  C3: "Skor (1-10)",
  C4: "% Presipitasi",
  C5: "KM",
  C6: "Pesaing Relevan",
};

/**
 * Generate a mathematically honest explainability report for a TOPSIS alternative
 */
export function explainTopsisZone(
  rankingItem: any,
  topsisSummary: {
    ideal_positive?: Record<string, number>;
    ideal_negative?: Record<string, number>;
  },
  criteriaSpecs: Array<{ code: string; name: string; type: string; weight: number }> = [],
  timeSlot: string = "sore"
): ZoneExplainabilityReport {
  const zoneId = rankingItem.zone_id || "";
  const zoneName = rankingItem.zone_name || `Zona ${zoneId}`;
  const rank = rankingItem.rank || 1;
  const preferenceScore = rankingItem.preference_score ?? rankingItem.closeness_score ?? 0;
  const dPos = rankingItem.d_pos ?? 0;
  const dNeg = rankingItem.d_neg ?? 0;

  const rawCriteria = rankingItem.traceability?.raw_criteria || {};
  const weightedV = rankingItem.traceability?.weighted_v || {};
  const idealPos = topsisSummary.ideal_positive || {};
  const idealNeg = topsisSummary.ideal_negative || {};

  // Standard 6 criteria fallback if specs omitted
  const specs = criteriaSpecs.length > 0 ? criteriaSpecs : [
    { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: 0.30 },
    { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: 0.20 },
    { code: "C3", name: "Keramaian Waktu Slot", type: "BENEFIT", weight: 0.15 },
    { code: "C4", name: "Risiko Presipitasi Cuaca", type: "COST", weight: 0.10 },
    { code: "C5", name: "Jarak Aksesibilitas Hub", type: "COST", weight: 0.10 },
    { code: "C6", name: "Dampak Kompetitor Relevan", type: "COST", weight: 0.15 },
  ];

  const breakdown: CriterionExplanation[] = [];

  for (const spec of specs) {
    const code = spec.code;
    const rawEntry = rawCriteria[code];
    const rawVal = typeof rawEntry === "object" && rawEntry !== null
      ? (rawEntry.raw_value ?? rawEntry.value ?? 0)
      : (rawEntry ?? 0);

    const v_ij = weightedV[code] ?? 0;
    const v_pos = idealPos[code] ?? v_ij;
    const v_neg = idealNeg[code] ?? v_ij;

    const deltaPosSq = Math.pow(v_ij - v_pos, 2);
    const deltaNegSq = Math.pow(v_ij - v_neg, 2);

    const distPos = Math.sqrt(deltaPosSq);
    const distNeg = Math.sqrt(deltaNegSq);
    const distSum = distPos + distNeg;

    // Relative proximity index to ideal best on single criterion scale (0% = at nadir A-, 100% = at ideal A+)
    const proximityPercent = distSum > 1e-9
      ? Math.min(100, Math.max(0, (distNeg / distSum) * 100))
      : 50.0;

    const isDriver = proximityPercent >= 65.0;
    const isRisk = proximityPercent <= 35.0;

    let assessmentText = "Cukup Seimbang";
    if (proximityPercent >= 80.0) assessmentText = "Sangat Unggul (Mendekati Ideal A+)";
    else if (proximityPercent >= 60.0) assessmentText = "Baik / Kompetitif";
    else if (proximityPercent <= 25.0) assessmentText = "Penalti Signifikan (Mendekati Nadir A-)";
    else if (proximityPercent <= 40.0) assessmentText = "Perlu Perhatian";

    breakdown.push({
      code,
      name: spec.name,
      type: spec.type.toUpperCase() as "BENEFIT" | "COST",
      weight: spec.weight,
      weightPercentage: Math.round(spec.weight * 100),
      rawValue: rawVal,
      rawUnit: CRITERIA_UNITS[code] || "",
      weightedV: v_ij,
      idealPositiveV: v_pos,
      idealNegativeV: v_neg,
      deltaPosSq,
      deltaNegSq,
      proximityPercent,
      isDriver,
      isRisk,
      assessmentText,
    });
  }

  // Sort drivers (highest proximity) and risks (lowest proximity)
  const keyDrivers = [...breakdown]
    .filter((c) => c.proximityPercent >= 55.0)
    .sort((a, b) => b.proximityPercent - a.proximityPercent);

  const keyRisks = [...breakdown]
    .filter((c) => c.proximityPercent < 55.0)
    .sort((a, b) => a.proximityPercent - b.proximityPercent);

  // Formulate human narrative without mathematical falsehoods
  const whyRecommended: string[] = [];
  for (const d of keyDrivers.slice(0, 3)) {
    if (d.type === "BENEFIT") {
      whyRecommended.push(`Unggul pada kriteria benefit ${d.name} (${d.code}) dengan nilai aktual ${d.rawValue} ${d.rawUnit} (Indeks kedekatan ideal: ${d.proximityPercent.toFixed(1)}%).`);
    } else {
      whyRecommended.push(`Terkendali pada kriteria cost ${d.name} (${d.code}) dengan penalti rendah sebesar ${d.rawValue} ${d.rawUnit} (Indeks kedekatan ideal: ${d.proximityPercent.toFixed(1)}%).`);
    }
  }

  const riskFactors: string[] = [];
  for (const r of keyRisks.slice(0, 2)) {
    if (r.type === "COST") {
      riskFactors.push(`Terdapat eksposur biaya pada ${r.name} (${r.code}) dengan nilai ${r.rawValue} ${r.rawUnit} yang memberi jarak deviasi dari solusi ideal.`);
    } else {
      riskFactors.push(`Nilai ${r.name} (${r.code}) sebesar ${r.rawValue} ${r.rawUnit} berada di bawah potensi optimal alternatif lain.`);
    }
  }

  if (whyRecommended.length === 0) {
    whyRecommended.push(`Memiliki profil kriteria yang moderat dan seimbang di seluruh dimensi evaluasi.`);
  }

  const headline = rank === 1
    ? `Rekomendasi Utama: ${zoneName} menduduki Peringkat #1 dengan Closeness Coefficient ${preferenceScore.toFixed(4)}.`
    : `${zoneName} menempati Peringkat #${rank} dengan Closeness Coefficient ${preferenceScore.toFixed(4)}.`;

  const mathematicalVerdict = `Skor kedekatan relatif C* = ${preferenceScore.toFixed(4)} diturunkan secara matematis dari rasio jarak Euclidean: D- (${dNeg.toFixed(4)}) / [D+ (${dPos.toFixed(4)}) + D- (${dNeg.toFixed(4)})] terhadap matriks berbobot BWM Rezaei (2016).`;

  return {
    zoneId,
    zoneName,
    rank,
    preferenceScore,
    dPos,
    dNeg,
    timeSlot,
    criteriaBreakdown: breakdown,
    keyDrivers,
    keyRisks,
    narrativeSummary: {
      headline,
      whyRecommended,
      riskFactors,
      mathematicalVerdict,
    },
  };
}
