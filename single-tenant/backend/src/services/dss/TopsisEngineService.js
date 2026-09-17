/*
 * TopsisEngineService.js
 * Domain Service for TOPSIS Zone Recommendation Engine (DSS-BWM-TOPSIS-CONTRACT-v1.0)
 * References: Hwang, C.L. & Yoon, K. (1981). Multiple Attribute Decision Making.
 * Optimized with Pure Matrix Math, Static Imports & Parallel Spatial Evaluations.
 */

import { pool } from "../../config/database.js";
import { topsisRepository } from "../../repositories/topsisRepository.js";
import { bwmRepository } from "../../repositories/bwmRepository.js";
import { rawCriteriaEvaluationService } from "./RawCriteriaEvaluationService.js";
import { bwmWeightService } from "./BwmWeightService.js";
import { RecommendationContractFormatter } from "./RecommendationContractFormatter.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";

const DEFAULT_EQUAL_WEIGHT = 1 / 6;

export class TopsisEngineService {
  static instance = null;

  constructor(repo = topsisRepository) {
    if (TopsisEngineService.instance && repo === topsisRepository) {
      return TopsisEngineService.instance;
    }
    this.repo = repo;
    if (repo === topsisRepository) {
      TopsisEngineService.instance = this;
    }
  }

  static getInstance() {
    if (!TopsisEngineService.instance) {
      TopsisEngineService.instance = new TopsisEngineService();
    }
    return TopsisEngineService.instance;
  }

  /**
   * Calculate TOPSIS Zone Recommendations across all 6 Criteria (C1-C6)
   * 
   * @param {Object} options
   * @param {string} options.timeSlot - Operational time slot ('pagi', 'siang', 'sore', 'malam')
   * @param {number} options.riderLat - Optional dynamic rider latitude
   * @param {number} options.riderLon - Optional dynamic rider longitude
   * @param {string} options.riderId - Optional rider user ID for saving recommendations
   * @param {Object} options.customWeights - Optional custom weights override for simulations
   */
  async calculateTopsisRecommendations(options = {}) {
    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(new Date());
    const { riderLat = null, riderLon = null, riderId = null } = options;

    console.log("\n================================================================================");
    console.log("🚀 [TOPSIS ENGINE] MEMULAI REKOMENDASI LOKASI DSS ZONA (TOPSIS PIPELINE)");
    console.log("================================================================================");
    console.log(`📌 Time Slot Operasional : ${activeSlot.toUpperCase()} (BERDASARKAN WAKTU AKTUAL SAAT INI)`);
    console.log(`📌 Lokasi Asal Evaluasi  : ${riderLat && riderLon ? `LIVE RIDER (${riderLat}, ${riderLon})` : "DEFAULT HUB UTAMA SIDOARJO"}`);
    console.log("--------------------------------------------------------------------------------");

    // --- STEP 0: FETCH ACTIVE BWM WEIGHTS & ACTIVE ZONES ---
    const [activeBwmConfig, activeZones] = await Promise.all([
      bwmRepository.findActiveConfig(),
      this.repo.findAllActiveZones(),
    ]);

    if (!activeZones || activeZones.length === 0) {
      const error = new Error("Tidak ada data Zona Operasional yang aktif di database.");
      error.statusCode = 404;
      throw error;
    }

    // Determine criteria weights (Priority: 1. customWeights preview, 2. Active BWM DB Config, 3. Equal fallback)
    let weights = {
      C1: DEFAULT_EQUAL_WEIGHT, C2: DEFAULT_EQUAL_WEIGHT, C3: DEFAULT_EQUAL_WEIGHT,
      C4: DEFAULT_EQUAL_WEIGHT, C5: DEFAULT_EQUAL_WEIGHT, C6: DEFAULT_EQUAL_WEIGHT,
    };

    if (options.customWeights && typeof options.customWeights === "object") {
      const cw = options.customWeights;
      const { rows: dbCriteria } = await pool.query("SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;");
      
      dbCriteria.forEach((c, idx) => {
        const code = `C${idx + 1}`;
        if (cw[code] !== undefined) {
          weights[code] = parseFloat(cw[code]);
        } else if (cw[c.id] !== undefined) {
          weights[code] = parseFloat(cw[c.id]);
        }
      });
      console.log(`🔍 [SIMULASI PREVIEW] Menggunakan Custom Weights untuk Simulasi Impact BWM:`, weights);
    } else if (activeBwmConfig && activeBwmConfig.best_to_others && activeBwmConfig.worst_to_others) {
      const { rows: dbCriteria } = await pool.query("SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;");
      const formattedCriteria = dbCriteria.map((c, idx) => ({ ...c, code: `C${idx + 1}` }));

      const bwmRes = bwmWeightService.calculateBwmWeights({
        best_criteria_id: activeBwmConfig.best_criteria_id,
        worst_criteria_id: activeBwmConfig.worst_criteria_id,
        best_to_others: activeBwmConfig.best_to_others,
        worst_to_others: activeBwmConfig.worst_to_others,
        criteria_list: formattedCriteria,
      });

      dbCriteria.forEach((c, idx) => {
        const code = `C${idx + 1}`;
        if (bwmRes.weights[c.id] !== undefined) {
          weights[code] = bwmRes.weights[c.id];
        }
      });
      console.log(`✅ Menggunakan Bobot BWM Optimal dari Database Config: "${activeBwmConfig.name}" (CR = ${bwmRes.consistency_ratio.toFixed(4)})`);
    } else {
      console.log("ℹ️ Belum ada konfigurasi BWM aktif. Menggunakan Bobot Equal Fallback (1/6 = 16.67%).");
    }

    // Criteria Metadata Specification (C1-C6)
    const criteriaSpecs = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: weights.C1 ?? DEFAULT_EQUAL_WEIGHT },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: weights.C2 ?? DEFAULT_EQUAL_WEIGHT },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: weights.C3 ?? DEFAULT_EQUAL_WEIGHT },
      { code: "C4", name: "Kondisi Cuaca (Hujan)", type: "COST", weight: weights.C4 ?? DEFAULT_EQUAL_WEIGHT },
      { code: "C5", name: "Jarak Boundary (KM)", type: "COST", weight: weights.C5 ?? DEFAULT_EQUAL_WEIGHT },
      { code: "C6", name: "Dampak Kompetitor", type: "COST", weight: weights.C6 ?? DEFAULT_EQUAL_WEIGHT },
    ];

    // --- STEP 1: PARALLEL RAW CRITERIA EVALUATIONS & CONSTRUCT DECISION MATRIX (X_m x 6) ---
    console.log("\n📋 [LANGKAH 1] MENYUSUN MATRIKS KEPUTUSAN (X_m x 6) SPASIAL POSTGIS:");
    console.log("--------------------------------------------------------------------------------");

    const rawEvaluations = await Promise.all(
      activeZones.map((zone) =>
        rawCriteriaEvaluationService.evaluateZoneRawCriteria(zone.id, {
          timeSlot: activeSlot,
          riderLat,
          riderLon,
        })
      )
    );

    const rawMatrix = rawEvaluations.map((rawEval, idx) => {
      const c1Val = rawEval.criteria.C1.value ?? rawEval.criteria.C1.raw_value;
      const c2Val = rawEval.criteria.C2.value ?? rawEval.criteria.C2.raw_value;
      const c3Val = rawEval.criteria.C3.value ?? rawEval.criteria.C3.raw_value;
      const c4Val = rawEval.criteria.C4.value ?? rawEval.criteria.C4.raw_value;
      const c5Val = rawEval.criteria.C5.value ?? rawEval.criteria.C5.raw_value;
      const c6Val = rawEval.criteria.C6.value ?? rawEval.criteria.C6.raw_value;

      console.log(
        `   • [Zona ${idx + 1}] ${rawEval.zone_name.padEnd(28)} | C1:${String(c1Val).padStart(3)} | C2:${String(c2Val).padStart(3)} | C3:${Number(c3Val).toFixed(1).padStart(5)} | C4:${Number(c4Val).toFixed(0).padStart(3)}% | C5:${Number(c5Val).toFixed(2).padStart(5)}km | C6:${String(c6Val).padStart(3)}`
      );

      return {
        id: rawEval.zone_id,
        name: rawEval.zone_name,
        scores: {
          C1: c1Val,
          C2: c2Val,
          C3: c3Val,
          C4: c4Val,
          C5: c5Val,
          C6: c6Val,
        },
      };
    });

    // --- STEP 2-6: PURE MATHEMATICAL TOPSIS EVALUATION ---
    const calculation = this.calculateTopsisForMatrix(rawMatrix, criteriaSpecs);

    const weightSource = activeBwmConfig ? "BWM" : "EQUAL_FALLBACK";
    const bwmMetadata = {
      id: activeBwmConfig?.id || "DEFAULT_EQUAL_WEIGHTS",
      name: activeBwmConfig?.name || "Equal Weights Fallback (1/6)",
      weight_source: weightSource,
      consistency_ratio: activeBwmConfig?.consistency_ratio || 0,
      weights,
    };

    // --- STEP 7: BUILD B-08 RECOMMENDATION CONTRACT RESPONSE ---
    const responsePayload = RecommendationContractFormatter.buildRecommendationResponse({
      calculation,
      rawEvaluations,
      timeSlot: activeSlot,
      weightSource,
      bwmMetadata,
      criteriaSpecs,
    });

    // Save Complete Execution History to Database
    await this.repo.saveExecutionHistory({
      rider_id: riderId,
      consistency_ratio: activeBwmConfig?.consistency_ratio || 0,
      status: "COMPLETED",
      details: responsePayload,
      rankings: responsePayload.rankings,
    });

    return responsePayload;
  }

  /**
   * Pure TOPSIS Engine Matrix Evaluation (Reusable for Zone or Candidate Matrix)
   * Standard: Hwang & Yoon (1981), DSS-BWM-TOPSIS-CONTRACT-v1.0
   * 
   * @param {Array<Object>} rawMatrix - Array of objects [{ id/zone_id, name/zone_name, scores: { C1, C2, C3, C4, C5, C6 } }]
   * @param {Array<Object>} criteriaSpecs - Array of objects [{ code: 'C1', type: 'BENEFIT'|'COST', weight: number }]
   */
  calculateTopsisForMatrix(rawMatrix = [], criteriaSpecs = []) {
    const m = rawMatrix.length;
    const n = criteriaSpecs.length;

    if (m === 0) {
      return {
        total_alternatives: 0,
        decision_matrix: [],
        normalized_matrix: [],
        weighted_matrix: [],
        ideal_positive: {},
        ideal_negative: {},
        distances: [],
        rankings: [],
      };
    }

    // Step 1: Decision Matrix X
    const formattedRawMatrix = rawMatrix.map((item) => ({
      id: item.id || item.zone_id,
      name: item.name || item.zone_name,
      scores: { ...(item.scores || item.raw_scores || {}) },
    }));

    // Step 2: Calculate sum of squares & zero-variance discriminating metadata per column j
    const sumSquares = {};
    const columnMetadata = {};

    criteriaSpecs.forEach((crit) => {
      let sumSq = 0;
      const colValues = [];

      for (let i = 0; i < m; i++) {
        const val = parseFloat(formattedRawMatrix[i].scores[crit.code] || 0);
        colValues.push(val);
        sumSq += val * val;
      }

      const mean = colValues.reduce((acc, curr) => acc + curr, 0) / (m || 1);
      const variance = colValues.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / (m || 1);

      sumSquares[crit.code] = Math.sqrt(sumSq);
      columnMetadata[crit.code] = {
        code: crit.code,
        name: crit.name || crit.code,
        type: crit.type,
        weight: crit.weight || 0,
        variance,
        discriminating: variance > 1e-9, // False if all raw values in column are identical
        sum_squares: sumSq,
      };
    });

    // Step 3: Euclidean Vector Normalization (Matrix R)
    const normalizedMatrix = [];
    for (let i = 0; i < m; i++) {
      const normRow = { id: formattedRawMatrix[i].id, name: formattedRawMatrix[i].name, r: {} };
      criteriaSpecs.forEach((crit) => {
        const denom = sumSquares[crit.code];
        const rawVal = parseFloat(formattedRawMatrix[i].scores[crit.code] || 0);
        normRow.r[crit.code] = denom > 0 ? rawVal / denom : 0;
      });
      normalizedMatrix.push(normRow);
    }

    // Step 4: Weighted Normalization Matrix (Matrix V)
    const weightedMatrix = [];
    for (let i = 0; i < m; i++) {
      const weightRow = { id: normalizedMatrix[i].id, name: normalizedMatrix[i].name, y: {} };
      criteriaSpecs.forEach((crit) => {
        const rVal = normRowValue(normalizedMatrix[i].r[crit.code]);
        const wVal = parseFloat(crit.weight || (1 / (n || 1)));
        weightRow.y[crit.code] = rVal * wVal;
      });
      weightedMatrix.push(weightRow);
    }

    // Step 5: Positive Ideal (A+) and Negative Ideal (A-) Solutions
    const idealPositive = {};
    const idealNegative = {};

    criteriaSpecs.forEach((crit) => {
      const colValues = weightedMatrix.map((row) => row.y[crit.code]);
      const maxVal = Math.max(...colValues);
      const minVal = Math.min(...colValues);

      if (crit.type === "BENEFIT") {
        idealPositive[crit.code] = maxVal;
        idealNegative[crit.code] = minVal;
      } else {
        // COST Criteria
        idealPositive[crit.code] = minVal;
        idealNegative[crit.code] = maxVal;
      }
    });

    // Step 6: Euclidean Distances (D+ & D-)
    const distanceResults = [];
    for (let i = 0; i < m; i++) {
      let sumSqPos = 0;
      let sumSqNeg = 0;

      criteriaSpecs.forEach((crit) => {
        const yVal = weightedMatrix[i].y[crit.code];
        const diffPos = yVal - idealPositive[crit.code];
        const diffNeg = yVal - idealNegative[crit.code];

        sumSqPos += diffPos * diffPos;
        sumSqNeg += diffNeg * diffNeg;
      });

      const dPos = Math.sqrt(sumSqPos);
      const dNeg = Math.sqrt(sumSqNeg);

      distanceResults.push({
        id: weightedMatrix[i].id,
        name: weightedMatrix[i].name,
        d_pos: dPos,
        d_neg: dNeg,
      });
    }

    // Step 7: Preference Score (C_i = D- / (D+ + D-)) & Deterministic Ranking
    const finalRankings = distanceResults.map((item) => {
      let preferenceScore = 0;
      if (m === 1) {
        // Single zone edge case: deterministically preference score = 1.0000
        preferenceScore = 1.0;
      } else {
        const denom = item.d_pos + item.d_neg;
        preferenceScore = denom > 0 ? item.d_neg / denom : 0;
      }

      return {
        id: item.id,
        name: item.name,
        preference_score: parseFloat(preferenceScore.toFixed(4)),
        preference_score_full: preferenceScore,
        d_pos: parseFloat(item.d_pos.toFixed(4)),
        d_neg: parseFloat(item.d_neg.toFixed(4)),
        d_pos_full: item.d_pos,
        d_neg_full: item.d_neg,
      };
    });

    // Deterministic sort: preference_score DESC, then id ASC
    finalRankings.sort((a, b) => {
      if (Math.abs(b.preference_score_full - a.preference_score_full) > 1e-9) {
        return b.preference_score_full - a.preference_score_full;
      }
      return String(a.id).localeCompare(String(b.id));
    });

    finalRankings.forEach((item, index) => {
      item.rank = index + 1;
    });

    return {
      total_alternatives: m,
      column_metadata: columnMetadata,
      decision_matrix: formattedRawMatrix,
      normalized_matrix: normalizedMatrix,
      weighted_matrix: weightedMatrix,
      ideal_positive: idealPositive,
      ideal_negative: idealNegative,
      distances: distanceResults,
      rankings: finalRankings,
    };
  }
}

function normRowValue(val) {
  return isNaN(val) ? 0 : val;
}

export const topsisEngineService = TopsisEngineService.getInstance();

