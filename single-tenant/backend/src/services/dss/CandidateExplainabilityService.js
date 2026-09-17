/*
 * CandidateExplainabilityService.js
 * Deterministic Explainability & Decision Reasoning Generator for Candidate Selling Location DSS Evaluation
 */

export class CandidateExplainabilityService {
  /**
   * Deterministic Recommendation Level Classification
   */
  getRecommendationLevel(score = 0) {
    const val = Number(score || 0);
    if (val >= 0.75) {
      return { level: "VERY_HIGH", label: "Sangat Direkomendasikan" };
    }
    if (val >= 0.50) {
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
  generateCriteriaBreakdown(scores = {}) {
    const c1 = Number(scores.C1 || 0);
    const c2 = Number(scores.C2 || 0);
    const c3 = Number(scores.C3 || 0);
    const c4 = Number(scores.C4 || 0);
    const c5 = Number(scores.C5 || 0);
    const c6 = Number(scores.C6 || 0);

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
        explanation: `C3 Time Crowd = ${c3.toFixed ? c3.toFixed(2) : c3}. Potensi keramaian pengunjung berdasarkan slot waktu operasional.`,
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
  generateDecisionReasoning(candScores = {}, matrixAvg = {}, rank = 1, preferenceScore = 0, candidateName = "Kandidat") {
    const strongFactors = [];
    const weakFactors = [];

    // Benefit criteria: >= avg is strong
    if ((candScores.C1 || 0) >= (matrixAvg.C1 || 0)) strongFactors.push("Densitas POI (C1) Tinggi");
    else weakFactors.push("Densitas POI (C1) Rendah");

    if ((candScores.C2 || 0) >= (matrixAvg.C2 || 0)) strongFactors.push("Diversitas POI (C2) Bervariasi");
    else weakFactors.push("Diversitas POI (C2) Terbatas");

    if ((candScores.C3 || 0) >= (matrixAvg.C3 || 0)) strongFactors.push("Keramaian Waktu (C3) Kuat");
    else weakFactors.push("Keramaian Waktu (C3) Rendah");

    // Cost criteria: <= avg is strong (lower cost is better)
    if ((candScores.C4 || 0) <= (matrixAvg.C4 || 100)) strongFactors.push("Risiko Cuaca (C4) Terkendali");
    else weakFactors.push("Risiko Cuaca (C4) Tinggi");

    if ((candScores.C5 || 0) <= (matrixAvg.C5 || 999)) strongFactors.push("Jarak Geografis (C5) Dekat");
    else weakFactors.push("Jarak Geografis (C5) Jauh");

    if ((candScores.C6 || 0) <= (matrixAvg.C6 || 999)) strongFactors.push("Kepadatan Kompetitor (C6) Rendah");
    else weakFactors.push("Kepadatan Kompetitor (C6) Tinggi");

    const recClass = this.getRecommendationLevel(preferenceScore);
    const summary = `${candidateName} berada di Peringkat #${rank} dengan skor preferensi TOPSIS ${Number(preferenceScore || 0).toFixed(4)} (${recClass.label}). Faktor unggulan: ${strongFactors.slice(0, 3).join(", ")}.`;

    return {
      strong_factors: strongFactors,
      weak_factors: weakFactors,
      summary,
    };
  }

  /**
   * Full Candidate Explanation Payload Generator
   */
  generateCandidateExplanation(candidate = {}, scores = {}, rankInfo = {}, matrixAvg = {}) {
    const rank = rankInfo.rank || 1;
    const score = Number(rankInfo.preference_score || 0);
    const recClass = this.getRecommendationLevel(score);
    const criteria = this.generateCriteriaBreakdown(scores);
    const reasoning = this.generateDecisionReasoning(scores, matrixAvg, rank, score, candidate.name || rankInfo.name || "Kandidat");

    return {
      candidate_id: candidate.id || rankInfo.id,
      candidate_name: candidate.name || rankInfo.name || "Kandidat",
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

