/*
 * RecommendationContractFormatter.js
 * Domain Utility for B-08 — DSS Decision Matrix & Recommendation Contract
 * Standardizes recommendation response payloads, worst-case quality aggregation,
 * provenance conservation, and deterministic reasoning explainability.
 */

export class RecommendationContractFormatter {
  static EVALUATION_VERSION = "DSS-CRITERIA-v1.0";
  static MODEL_VERSION = "BWM-TOPSIS-v1.0";

  /**
   * Aggregate data quality using worst-case rule:
   * Any DEGRADED -> DEGRADED
   * Any BASELINE (and none DEGRADED) -> BASELINE
   * Otherwise -> VALID
   */
  static aggregateQuality(qualities = []) {
    const list = qualities.filter(Boolean).map((q) => String(q).toUpperCase());
    if (list.includes("DEGRADED")) return "DEGRADED";
    if (list.includes("BASELINE")) return "BASELINE";
    return "VALID";
  }

  /**
   * Extract raw numeric scores strictly
   */
  static extractRawScores(criteriaObj = {}) {
    const res = {};
    for (const code of ["C1", "C2", "C3", "C4", "C5", "C6"]) {
      const item = criteriaObj[code] || {};
      res[code] = typeof item.value === "number" ? item.value : (typeof item.raw_value === "number" ? item.raw_value : 0);
    }
    return res;
  }

  /**
   * Extract provenance map directly from B-07 criteria output
   */
  static extractProvenance(criteriaObj = {}) {
    const res = {};
    for (const code of ["C1", "C2", "C3", "C4", "C5", "C6"]) {
      const item = criteriaObj[code] || {};
      res[code] = {
        source: item.source || "UNKNOWN",
        quality: item.quality || "VALID",
        methodology: item.methodology || "STANDARD",
      };
    }
    return res;
  }

  /**
   * Aggregate warnings from all criteria
   */
  static extractWarnings(criteriaObj = {}) {
    const warnings = [];
    for (const code of ["C1", "C2", "C3", "C4", "C5", "C6"]) {
      const item = criteriaObj[code] || {};
      if (item.warning) warnings.push(item.warning);
      if (Array.isArray(item.warnings)) {
        item.warnings.forEach((w) => {
          if (w && !warnings.includes(w)) warnings.push(w);
        });
      }
    }
    return [...new Set(warnings)];
  }

  /**
   * Generate deterministic reasoning summary based on Benefit vs Cost comparison to matrix average
   */
  static generateReasoning(rawScores = {}, matrixAvg = {}, rank = 1, preferenceScore = 0, zoneName = "Zona") {
    const strongFactors = [];
    const weakFactors = [];

    // Benefit criteria: >= avg is strong
    if ((rawScores.C1 || 0) >= (matrixAvg.C1 || 0)) strongFactors.push("Densitas POI (C1) Tinggi");
    else weakFactors.push("Densitas POI (C1) Rendah");

    if ((rawScores.C2 || 0) >= (matrixAvg.C2 || 0)) strongFactors.push("Diversitas POI (C2) Bervariasi");
    else weakFactors.push("Diversitas POI (C2) Terbatas");

    if ((rawScores.C3 || 0) >= (matrixAvg.C3 || 0)) strongFactors.push("Keramaian Waktu (C3) Kuat");
    else weakFactors.push("Keramaian Waktu (C3) Rendah");

    // Cost criteria: <= avg is strong (lower cost is better)
    if ((rawScores.C4 || 0) <= (matrixAvg.C4 || 100)) strongFactors.push("Risiko Cuaca (C4) Terkendali");
    else weakFactors.push("Risiko Cuaca (C4) Tinggi");

    if ((rawScores.C5 || 0) <= (matrixAvg.C5 || 999)) strongFactors.push("Jarak Geografis (C5) Dekat");
    else weakFactors.push("Jarak Geografis (C5) Jauh");

    if ((rawScores.C6 || 0) <= (matrixAvg.C6 || 999)) strongFactors.push("Tingkat Persaingan (C6) Rendah");
    else weakFactors.push("Tingkat Persaingan (C6) Tinggi");

    const scorePct = (Number(preferenceScore || 0) * 100).toFixed(2);
    const summary = `${zoneName} berada di Peringkat #${rank} dengan skor preferensi TOPSIS ${Number(preferenceScore || 0).toFixed(4)} (${scorePct}%). Faktor unggulan: ${strongFactors.slice(0, 3).join(", ")}.`;

    return {
      strong_factors: strongFactors,
      weak_factors: weakFactors,
      summary,
    };
  }

  /**
   * Build complete formatted recommendation response (B-08 Contract)
   */
  static buildRecommendationResponse({
    calculation,
    rawEvaluations = [],
    timeSlot = "pagi",
    weightSource = "BWM",
    bwmMetadata = null,
    criteriaSpecs = [],
  }) {
    const rankings = calculation.rankings || [];
    const m = rawEvaluations.length;

    // Calculate matrix averages for explainability reasoning
    const matrixAvg = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
    if (m > 0) {
      for (const ev of rawEvaluations) {
        const raw = this.extractRawScores(ev.criteria);
        for (const code of Object.keys(matrixAvg)) {
          matrixAvg[code] += (raw[code] || 0) / m;
        }
      }
    }

    const allZoneQualities = [];
    const allZoneWarnings = [];

    const formattedRankings = rankings.map((item) => {
      const zoneRawEval = rawEvaluations.find((ev) => ev.zone_id === (item.id || item.zone_id));
      const criteriaObj = zoneRawEval ? zoneRawEval.criteria : {};
      const rawScores = this.extractRawScores(criteriaObj);
      const provenance = this.extractProvenance(criteriaObj);
      const zoneWarnings = this.extractWarnings(criteriaObj);

      const zoneQualities = Object.values(provenance).map((p) => p.quality);
      const zoneQuality = this.aggregateQuality(zoneQualities);

      allZoneQualities.push(zoneQuality);
      zoneWarnings.forEach((w) => {
        if (!allZoneWarnings.includes(w)) allZoneWarnings.push(w);
      });

      const reasoning = this.generateReasoning(
        rawScores,
        matrixAvg,
        item.rank,
        item.preference_score,
        item.name || item.zone_name || zoneRawEval?.zone_name || "Zona"
      );

      return {
        zone_id: item.id || item.zone_id,
        zone_name: item.name || item.zone_name || zoneRawEval?.zone_name || "Zona",
        rank: item.rank,
        preference_score: item.preference_score,
        preference_score_pct: `${(item.preference_score * 100).toFixed(2)}%`,
        d_pos: item.d_pos,
        d_neg: item.d_neg,
        model: {
          evaluation_version: this.EVALUATION_VERSION,
          model_version: this.MODEL_VERSION,
          weight_source: weightSource,
        },
        data_quality: zoneQuality,
        warnings: zoneWarnings,
        raw_scores: rawScores,
        provenance,
        reasoning,
      };
    });

    const overallQuality = this.aggregateQuality(allZoneQualities);

    return {
      status: "success",
      evaluation_version: this.EVALUATION_VERSION,
      model_version: this.MODEL_VERSION,
      evaluated_at: new Date().toISOString(),
      time_slot: timeSlot,
      weight_source: weightSource,
      total_evaluated_zones: m,
      data_status: "COMPLETE",
      data_quality: overallQuality,
      warnings: allZoneWarnings,
      bwm_config: bwmMetadata,
      criteria_specs: criteriaSpecs,
      ideal_positive: calculation.ideal_positive || {},
      ideal_negative: calculation.ideal_negative || {},
      rankings: formattedRankings,
    };
  }
}

