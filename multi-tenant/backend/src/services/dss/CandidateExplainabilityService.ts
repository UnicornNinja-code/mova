/*
 * CandidateExplainabilityService.ts
 * Deterministic Explainability & Decision Reasoning Generator for Candidate Selling Location DSS Evaluation in TypeScript
 */

export class CandidateExplainabilityService {
  /**
   * Deterministic Recommendation Level Classification
   */
  public getRecommendationLevel(score: number = 0): { level: string; label: string } {
    const val = Number(score);
    if (val >= 0.75) {
      return { level: "VERY_HIGH", label: "Sangat Direkomendasikan" };
    }
    if (val >= 0.5) {
      return { level: "HIGH", label: "Direkomendasikan" };
    }
    if (val >= 0.25) {
      return { level: "MEDIUM", label: "Pertimbangan Sedang" };
    }
    return { level: "LOW", label: "Prioritas Rendah" };
  }

  /**
   * Human-Readable Criteria Explanation Breakdown
   */
  public generateCriteriaBreakdown(scores: Record<string, number> = {}): Record<string, any> {
    const c1 = scores.C1 || 0;
    const c2 = scores.C2 || 0;
    const c3 = scores.C3 || 0;
    const c4 = scores.C4 || 0;
    const c5 = scores.C5 || 0;
    const c6 = scores.C6 || 0;

    return {
      C1: {
        value: c1,
        direction: "BENEFIT",
        explanation: `C1 Density = ${c1} logical POIs. Merupakan jumlah entitas POI terverifikasi di area zona.`,
      },
      C2: {
        value: c2,
        direction: "BENEFIT",
        explanation: `C2 Diversity = ${c2} kategori. Merupakan jumlah variasi kategori POI aktif di zona.`,
      },
      C3: {
        value: c3,
        direction: "BENEFIT",
        explanation: `C3 Time Crowd = ${typeof c3 === "number" && c3.toFixed ? c3.toFixed(2) : c3}. Potensi keramaian pengunjung berdasarkan slot waktu operasional.`,
      },
      C4: {
        value: c4,
        direction: "COST",
        explanation: `C4 Weather = ${c4}%. Tingkat risiko presipitasi cuaca hujan yang dapat mempengaruhi penjualan.`,
      },
      C5: {
        value: c5,
        direction: "COST",
        explanation: `C5 Distance = ${c5} km. Jarak geografis dari koordinat kandidat menuju titik asal referensi.`,
      },
      C6: {
        value: c6,
        direction: "COST",
        explanation: `C6 Competitor = ${c6} kompetitor. Jumlah entitas kompetitor kopi keliling / kedai kopi di zona.`,
      },
    };
  }

  /**
   * Deterministic Rule-Based Decision Reason Generation
   */
  public generateDecisionReasoning(
    candScores: Record<string, number> = {},
    matrixAvg: Record<string, number> = {},
    rank: number = 1,
    preferenceScore: number = 0,
    candidateName: string = "Kandidat"
  ): {
    strong_factors: string[];
    weak_factors: string[];
    summary: string;
  } {
    const strongFactors: string[] = [];
    const weakFactors: string[] = [];

    if (candScores.C1 >= (matrixAvg.C1 || 0)) strongFactors.push("Densitas POI (C1) Tinggi");
    else weakFactors.push("Densitas POI (C1) Rendah");

    if (candScores.C2 >= (matrixAvg.C2 || 0)) strongFactors.push("Diversitas POI (C2) Bervariasi");
    else weakFactors.push("Diversitas POI (C2) Terbatas");

    if (candScores.C3 >= (matrixAvg.C3 || 0)) strongFactors.push("Keramaian Waktu (C3) Kuat");
    else weakFactors.push("Keramaian Waktu (C3) Rendah");

    if (candScores.C4 <= (matrixAvg.C4 || 100)) strongFactors.push("Risiko Cuaca (C4) Terkendali");
    else weakFactors.push("Risiko Cuaca (C4) Tinggi");

    if (candScores.C5 <= (matrixAvg.C5 || 999)) strongFactors.push("Jarak Geografis (C5) Dekat");
    else weakFactors.push("Jarak Geografis (C5) Jauh");

    if (candScores.C6 <= (matrixAvg.C6 || 999)) strongFactors.push("Kepadatan Kompetitor (C6) Rendah");
    else weakFactors.push("Kepadatan Kompetitor (C6) Tinggi");

    const recClass = this.getRecommendationLevel(preferenceScore);
    const summary = `${candidateName} berada di Peringkat #${rank} dengan skor preferensi TOPSIS ${preferenceScore} (${recClass.label}). Faktor unggulan: ${strongFactors.slice(0, 3).join(", ")}.`;

    return {
      strong_factors: strongFactors,
      weak_factors: weakFactors,
      summary,
    };
  }

  /**
   * Full Candidate Explanation Payload Generator
   */
  public generateCandidateExplanation(
    candidate: any = {},
    scores: Record<string, number> = {},
    rankInfo: any = {},
    matrixAvg: Record<string, number> = {}
  ): any {
    const rank = rankInfo.rank || 1;
    const score = rankInfo.preference_score || 0;
    const recClass = this.getRecommendationLevel(score);
    const criteria = this.generateCriteriaBreakdown(scores);
    const reasoning = this.generateDecisionReasoning(scores, matrixAvg, rank, score, candidate.name || candidate.name);

    return {
      candidate_id: candidate.id || rankInfo.id,
      candidate_name: candidate.name || rankInfo.name,
      validation_status: candidate.validation_status || "ALLOWED",
      recommendation: {
        rank,
        preference_score: score,
        recommendation_level: recClass.level,
        recommendation_label: recClass.label,
      },
      criteria,
      eligibility: {
        status: candidate.validation_status || "ALLOWED",
        zone_valid: true,
        protocol_road_valid: true,
        poi_anchor_valid: true,
      },
      reasoning,
    };
  }
}

export const candidateExplainabilityService = new CandidateExplainabilityService();
