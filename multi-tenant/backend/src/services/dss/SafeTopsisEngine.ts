/*
 * SafeTopsisEngine.ts
 * Pure Mathematical Decision Engine for Safe TOPSIS (Technique for Order Preference by Similarity to Ideal Solution)
 * References: Hwang, C.L. & Yoon, K. (1981). Multiple Attribute Decision Making.
 * 
 * Fitur Keamanan Matematis:
 * 1. Zero-Variance / Zero-Sum Division Guard (menangani kasus kriteria bernilai 0 pada semua alternatif)
 * 2. Zero-Distance Guard (menangani kasus D+ + D- = 0 ketika semua alternatif identik)
 * 3. Pemisahan ketat kriteria BENEFIT (C1-C3) dan COST (C4-C6)
 * 4. Deterministic Ranking & Transparan (menyediakan seluruh matriks kalkulasi untuk audit skripsi & verifikasi)
 */

export type CriterionType = "BENEFIT" | "COST";

export interface CriterionDefinition {
  code: string; // e.g. "C1", "C2", "C3", "C4", "C5", "C6"
  name: string;
  type: CriterionType;
  weight: number; // Optimal weight from BWM (Σ w_j = 1.0)
}

export interface CandidateAlternative {
  id: string | number;
  name: string;
  scores: Record<string, number>; // { C1: raw_val, C2: raw_val, ..., C6: raw_val }
  metadata?: Record<string, any>;
}

export interface TopsisCalculationOutput {
  decision_matrix: Array<{
    id: string | number;
    name: string;
    scores: Record<string, number>;
  }>;
  normalized_matrix: Array<{
    id: string | number;
    name: string;
    r: Record<string, number>;
  }>;
  weighted_matrix: Array<{
    id: string | number;
    name: string;
    v: Record<string, number>;
  }>;
  ideal_solutions: {
    positive: Record<string, number>; // A+
    negative: Record<string, number>; // A-
  };
  rankings: Array<{
    rank: number;
    id: string | number;
    name: string;
    score: number; // Relative Closeness Coefficient (R_i: 0.0 - 1.0)
    d_positive: number; // D+
    d_negative: number; // D-
    raw_scores: Record<string, number>;
    metadata?: Record<string, any>;
  }>;
}

export class SafeTopsisEngine {
  private static instance: SafeTopsisEngine | null = null;

  public static getInstance(): SafeTopsisEngine {
    if (!SafeTopsisEngine.instance) {
      SafeTopsisEngine.instance = new SafeTopsisEngine();
    }
    return SafeTopsisEngine.instance;
  }

  /**
   * Pure Function: Menghitung Ranking Rekomendasi TOPSIS secara Aman dan Deterministik
   */
  public execute(
    alternatives: CandidateAlternative[],
    criteria: CriterionDefinition[]
  ): TopsisCalculationOutput {
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      throw new Error("EMPTY_ALTERNATIVES: Tidak ada alternatif/kandidat lokasi untuk dievaluasi.");
    }
    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw new Error("EMPTY_CRITERIA: Himpunan kriteria evaluasi tidak boleh kosong.");
    }

    const m = alternatives.length;
    const n = criteria.length;

    // Normalisasi bobot jika total bobot belum tepat 1.0
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    const normalizedCriteria = criteria.map((c) => ({
      ...c,
      weight: totalWeight > 0 ? c.weight / totalWeight : 1 / n,
    }));

    // ─────────────────────────────────────────────────────────────────────────
    // LANGKAH 1: Matriks Keputusan Mentah (Decision Matrix X)
    // ─────────────────────────────────────────────────────────────────────────
    const decisionMatrix = alternatives.map((alt) => {
      const scores: Record<string, number> = {};
      normalizedCriteria.forEach((crit) => {
        const val = alt.scores[crit.code];
        scores[crit.code] = typeof val === "number" && !isNaN(val) ? val : 0;
      });
      return {
        id: alt.id,
        name: alt.name,
        scores,
        metadata: alt.metadata,
      };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LANGKAH 2: Normalisasi Vektor (Normalized Matrix R)
    // r_ij = x_ij / sqrt(Σ x_kj^2)
    // ─────────────────────────────────────────────────────────────────────────
    const sumSquares: Record<string, number> = {};
    normalizedCriteria.forEach((crit) => {
      let sumSq = 0;
      for (let i = 0; i < m; i++) {
        const val = decisionMatrix[i].scores[crit.code];
        sumSq += val * val;
      }
      sumSquares[crit.code] = Math.sqrt(sumSq);
    });

    const normalizedMatrix = decisionMatrix.map((row) => {
      const r: Record<string, number> = {};
      normalizedCriteria.forEach((crit) => {
        const denom = sumSquares[crit.code];
        // Zero-variance guard: jika semua alternatif bernilai 0, r_ij = 0
        r[crit.code] = denom > 0 ? Number((row.scores[crit.code] / denom).toFixed(6)) : 0;
      });
      return {
        id: row.id,
        name: row.name,
        r,
      };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LANGKAH 3: Matriks Ternormalisasi Terbobot (Weighted Normalized Matrix V)
    // v_ij = w_j * r_ij
    // ─────────────────────────────────────────────────────────────────────────
    const weightedMatrix = normalizedMatrix.map((row) => {
      const v: Record<string, number> = {};
      normalizedCriteria.forEach((crit) => {
        v[crit.code] = Number((row.r[crit.code] * crit.weight).toFixed(6));
      });
      return {
        id: row.id,
        name: row.name,
        v,
      };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LANGKAH 4: Solusi Ideal Positif (A+) dan Solusi Ideal Negatif (A-)
    // Benefit: A+ = max(v_ij), A- = min(v_ij)
    // Cost   : A+ = min(v_ij), A- = max(v_ij)
    // ─────────────────────────────────────────────────────────────────────────
    const idealPositive: Record<string, number> = {};
    const idealNegative: Record<string, number> = {};

    normalizedCriteria.forEach((crit) => {
      const colValues = weightedMatrix.map((row) => row.v[crit.code]);
      const maxVal = Math.max(...colValues);
      const minVal = Math.min(...colValues);

      if (crit.type === "BENEFIT") {
        idealPositive[crit.code] = maxVal;
        idealNegative[crit.code] = minVal;
      } else {
        // Cost Criteria (C4, C5, C6)
        idealPositive[crit.code] = minVal;
        idealNegative[crit.code] = maxVal;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LANGKAH 5: Jarak Euclidean ke Solusi Ideal (D+ & D-)
    // D_i+ = sqrt(Σ (v_ij - A_j+)^2)
    // D_i- = sqrt(Σ (v_ij - A_j-)^2)
    // ─────────────────────────────────────────────────────────────────────────
    const distances = weightedMatrix.map((row, idx) => {
      let sumSqPos = 0;
      let sumSqNeg = 0;

      normalizedCriteria.forEach((crit) => {
        const val = row.v[crit.code];
        const diffPos = val - idealPositive[crit.code];
        const diffNeg = val - idealNegative[crit.code];

        sumSqPos += diffPos * diffPos;
        sumSqNeg += diffNeg * diffNeg;
      });

      const dPos = Number(Math.sqrt(sumSqPos).toFixed(6));
      const dNeg = Number(Math.sqrt(sumSqNeg).toFixed(6));

      // ───────────────────────────────────────────────────────────────────────
      // LANGKAH 6: Nilai Preferensi Kedekatan Relatif (R_i)
      // R_i = D_i- / (D_i+ + D_i-)
      // ───────────────────────────────────────────────────────────────────────
      const denom = dPos + dNeg;
      // Zero-distance guard: jika D+ + D- = 0 (semua alternatif identik), R_i = 0.5
      const preferenceScore = denom > 0 ? Number((dNeg / denom).toFixed(4)) : 0.50;

      return {
        id: row.id,
        name: row.name,
        score: preferenceScore,
        d_positive: dPos,
        d_negative: dNeg,
        raw_scores: decisionMatrix[idx].scores,
        metadata: decisionMatrix[idx].metadata,
      };
    });

    // Urutkan alternatif berdasarkan Skor Preferensi Tertinggi (Descending)
    const sorted = [...distances].sort((a, b) => b.score - a.score);
    const rankings = sorted.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    return {
      decision_matrix: decisionMatrix.map((d) => ({ id: d.id, name: d.name, scores: d.scores })),
      normalized_matrix: normalizedMatrix,
      weighted_matrix: weightedMatrix,
      ideal_solutions: {
        positive: idealPositive,
        negative: idealNegative,
      },
      rankings,
    };
  }
}

export const safeTopsisEngine = SafeTopsisEngine.getInstance();
