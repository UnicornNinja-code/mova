/*
 * TopsisEngineService.ts
 * Clean Architecture Singleton Engine for TOPSIS Zone Recommendation in TypeScript
 * References: Hwang, C.L. & Yoon, K. (1981). Multiple Attribute Decision Making.
 */

import { topsisRepository, TopsisRepository } from "../../repositories/topsisRepository.js";
import { bwmRepository } from "../../repositories/bwmRepository.js";
import { poiRepository } from "../../repositories/poiRepository.js";
import { poiTimeCrowdService } from "../poi/POITimeCrowdService.js";
import { poiWeatherService } from "../poi/POIWeatherService.js";
import { poiDistanceService } from "../poi/POIDistanceService.js";
import { poiCompetitorService } from "../poi/POICompetitorService.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";
import { pool } from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { bwmWeightService } from "./BwmWeightService.js";

function normRowValue(val: any): number {
  return isNaN(val) ? 0 : Number(val);
}

export class TopsisEngineService {
  private static instance: TopsisEngineService | null = null;
  private repo: TopsisRepository;

  constructor(repo: TopsisRepository = topsisRepository) {
    if (TopsisEngineService.instance && repo === topsisRepository) {
      return TopsisEngineService.instance;
    }
    this.repo = repo;
    if (repo === topsisRepository) {
      TopsisEngineService.instance = this;
    }
  }

  public static getInstance(): TopsisEngineService {
    if (!TopsisEngineService.instance) {
      TopsisEngineService.instance = new TopsisEngineService();
    }
    return TopsisEngineService.instance;
  }

  /**
   * Calculate TOPSIS Zone Recommendations across all 6 Criteria (C1-C6)
   */
  public async calculateTopsisRecommendations(options: {
    timeSlot?: string;
    riderLat?: number | string | null;
    riderLon?: number | string | null;
    riderId?: number | string | null;
    customWeights?: Record<string, number> | null;
  } = {}): Promise<any> {
    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(new Date());
    const { riderLat = null, riderLon = null, riderId = null, customWeights = null } = options;

    const cacheKey = !riderLat && !riderLon && !customWeights
      ? `dss:topsis:${activeSlot.toLowerCase()}`
      : null;

    if (cacheKey) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {}
    }

    console.log("\n================================================================================");
    console.log("🚀 [TOPSIS ENGINE] MEMULAI REKOMENDASI LOKASI DSS ZONA (TOPSIS PIPELINE)");
    console.log("================================================================================");
    console.log(`📌 Time Slot Operasional : ${activeSlot.toUpperCase()} (BERDASARKAN WAKTU AKTUAL SAAT INI)`);
    console.log(`📌 Lokasi Asal Evaluasi  : ${riderLat && riderLon ? `LIVE RIDER (${riderLat}, ${riderLon})` : 'CENTRAL OPERATIONAL HUB'}`);
    console.log("--------------------------------------------------------------------------------");

    // --- STEP 0: FETCH ACTIVE BWM WEIGHTS & ACTIVE ZONES ---
    const activeBwmConfig = await bwmRepository.findActiveConfig();
    const activeZones = await this.repo.findAllActiveZones();

    if (!activeZones || activeZones.length === 0) {
      const error: any = new Error("Tidak ada data Zona Operasional yang aktif di database.");
      error.statusCode = 404;
      throw error;
    }

    let weights: Record<string, number> = {
      C1: 0.1667, C2: 0.1667, C3: 0.1667,
      C4: 0.1667, C5: 0.1667, C6: 0.1667,
    };

    if (customWeights && Object.keys(customWeights).length > 0) {
      weights = { ...weights, ...customWeights };
      console.log("✅ Menggunakan Custom Draft Weights untuk Simulasi Preview");
    } else if (activeBwmConfig && activeBwmConfig.best_to_others && activeBwmConfig.worst_to_others) {
      const { rows: dbCriteria } = await pool.query("SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;");
      const formattedCriteria = dbCriteria.map((c: any, idx: number) => ({ ...c, code: `C${idx + 1}` }));

      const bwmRes = bwmWeightService.calculateBwmWeights({
        best_criteria_id: activeBwmConfig.best_criteria_id,
        worst_criteria_id: activeBwmConfig.worst_criteria_id,
        best_to_others: activeBwmConfig.best_to_others,
        worst_to_others: activeBwmConfig.worst_to_others,
        criteria_list: formattedCriteria,
      });

      dbCriteria.forEach((c: any, idx: number) => {
        const code = `C${idx + 1}`;
        if (bwmRes.weights[c.id] !== undefined) {
          weights[code] = bwmRes.weights[c.id];
        }
      });
      console.log(`✅ Menggunakan Bobot BWM Optimal dari Database Config: "${activeBwmConfig.name}" (CR = ${bwmRes.consistency_ratio.toFixed(4)})`);
    } else {
      console.log("ℹ️ Belum ada konfigurasi BWM aktif. Menggunakan Bobot Equal Fallback (1/6 = 16.67%).");
    }

    const criteriaSpecs = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: weights.C1 || weights["c1-id"] || 0.1667 },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: weights.C2 || weights["c2-id"] || 0.1667 },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: weights.C3 || weights["c3-id"] || 0.1667 },
      { code: "C4", name: "Kondisi Cuaca (Hujan)", type: "COST", weight: weights.C4 || weights["c4-id"] || 0.1667 },
      { code: "C5", name: "Jarak Boundary (KM)", type: "COST", weight: weights.C5 || weights["c5-id"] || 0.1667 },
      { code: "C6", name: "Dampak Kompetitor", type: "COST", weight: weights.C6 || weights["c6-id"] || 0.1667 },
    ];

    // --- STEP 1: CONSTRUCT DECISION MATRIX (X_m x 6) ---
    console.log("\n📋 [LANGKAH 1] MENYUSUN MATRIKS KEPUTUSAN (X_m x 6) SPASIAL POSTGIS:");
    console.log("--------------------------------------------------------------------------------");

    const m = activeZones.length;
    const rawMatrix: any[] = [];

    for (let i = 0; i < m; i++) {
      const zone = activeZones[i];
      const tenantId = (options as any).tenantId || (zone as any).tenant_id || "thesis-default";

      const c1c2Res = await poiRepository.getDensitasDanDiversitasByZonePolygon(zone.polygon);
      const c1Val = c1c2Res?.skor_c1 || 0;
      const c2Val = c1c2Res?.skor_c2 || 0;

      const c3Res = await poiTimeCrowdService.calculateZoneC3Score(zone.polygon, activeSlot);
      const c3Val = c3Res?.total_c3_score || 0;

      const c4Res = await poiWeatherService.calculateZoneC4Score(zone.id, activeSlot);
      const c4Val = c4Res?.skor_c4 ?? c4Res?.max_precipitation_probability ?? 0;

      const c5Res = await poiDistanceService.calculateZoneC5Score(zone.id, riderLat, riderLon);
      const c5Val = c5Res?.skor_c5 ?? c5Res?.distance_km ?? 0;
      const centroid = c5Res?.centroid || { latitude: -7.4478, longitude: 112.7183 };

      // C6: Relevant Competitor Impact Score from Stage 3A Engine (COST)
      const c6Res = await competitorRelevanceService.evaluateC6ForCoordinate(
        tenantId,
        centroid.latitude,
        centroid.longitude,
        new Date().toTimeString().split(" ")[0]
      );
      const c6Val = c6Res.value;

      const zoneRow = {
        id: zone.id,
        name: zone.name,
        scores: {
          C1: c1Val,
          C2: c2Val,
          C3: c3Val,
          C4: c4Val,
          C5: c5Val,
          C6: c6Val,
        },
      };

      rawMatrix.push(zoneRow);
      console.log(`   • [Zona ${i + 1}] ${zone.name.padEnd(28)} | C1:${c1Val.toString().padStart(3)} | C2:${c2Val.toString().padStart(3)} | C3:${c3Val.toFixed(1).padStart(5)} | C4:${c4Val.toFixed(0).padStart(3)}% | C5:${c5Val.toFixed(2).padStart(5)}km | C6:${c6Val.toFixed(2).padStart(5)}`);
    }

    // --- STEP 2 to 6: SAFE TOPSIS EXECUTION (Pure Mathematical Engine) ---
    const topsisResult = safeTopsisEngine.execute(rawMatrix, criteriaSpecs as any);

    const normalizedMatrix = topsisResult.normalized_matrix;
    const weightedMatrix = topsisResult.weighted_matrix;
    const idealPositive = topsisResult.ideal_solutions.positive;
    const idealNegative = topsisResult.ideal_solutions.negative;

    const finalRankings = topsisResult.rankings.map((item) => ({
      zone_id: item.id,
      zone_name: item.name,
      preference_score: item.score,
      score: item.score,
      d_pos: item.d_positive,
      d_neg: item.d_negative,
      rank: item.rank,
    }));

    finalRankings.forEach((item: any, index: number) => {
      item.rank = index + 1;
    });

    const weightSource = activeBwmConfig ? "BWM" : "EQUAL_FALLBACK";

    await this.repo.saveExecutionHistory({
      rider_id: riderId,
      consistency_ratio: activeBwmConfig?.consistency_ratio || 0,
      status: "COMPLETED",
      details: {
        time_slot: activeSlot,
        weight_source: weightSource,
        weights,
        criteria_specs: criteriaSpecs,
        decision_matrix: rawMatrix,
        ideal_positive: idealPositive,
        ideal_negative: idealNegative,
      },
      rankings: finalRankings,
    });

    const output = {
      message: "Proses Komputasi TOPSIS Rekomendasi Lokasi Berhasil Selesai.",
      time_slot: activeSlot,
      weight_source: weightSource,
      total_evaluated_zones: m,
      ideal_positive: idealPositive,
      ideal_negative: idealNegative,
      rankings: finalRankings,
    };

    if (cacheKey) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(output), { EX: 60 });
      } catch {}
    }

    return output;
  }

  /**
   * Pure TOPSIS Engine Matrix Evaluation (Reusable for Zone or Candidate Matrix)
   */
  public calculateTopsisForMatrix(rawMatrix: any[] = [], criteriaSpecs: any[] = []): any {
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

    const formattedRawMatrix = rawMatrix.map((item) => ({
      id: item.id || item.zone_id,
      name: item.name || item.zone_name,
      scores: { ...(item.scores || item.raw_scores || {}) },
    }));

    const sumSquares: Record<string, number> = {};
    const columnMetadata: Record<string, any> = {};

    criteriaSpecs.forEach((crit) => {
      let sumSq = 0;
      const colValues: number[] = [];

      for (let i = 0; i < m; i++) {
        const val = parseFloat(String(formattedRawMatrix[i].scores[crit.code] || 0));
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
        discriminating: variance > 1e-9,
        sum_squares: sumSq,
      };
    });

    const normalizedMatrix: any[] = [];
    for (let i = 0; i < m; i++) {
      const normRow: any = { id: formattedRawMatrix[i].id, name: formattedRawMatrix[i].name, r: {} };
      criteriaSpecs.forEach((crit) => {
        const denom = sumSquares[crit.code];
        const rawVal = parseFloat(String(formattedRawMatrix[i].scores[crit.code] || 0));
        normRow.r[crit.code] = denom > 0 ? rawVal / denom : 0;
      });
      normalizedMatrix.push(normRow);
    }

    const weightedMatrix: any[] = [];
    for (let i = 0; i < m; i++) {
      const weightRow: any = { id: normalizedMatrix[i].id, name: normalizedMatrix[i].name, y: {} };
      criteriaSpecs.forEach((crit) => {
        const rVal = normRowValue(normalizedMatrix[i].r[crit.code]);
        const wVal = parseFloat(String(crit.weight || (1 / (n || 1))));
        weightRow.y[crit.code] = rVal * wVal;
      });
      weightedMatrix.push(weightRow);
    }

    const idealPositive: Record<string, number> = {};
    const idealNegative: Record<string, number> = {};

    criteriaSpecs.forEach((crit) => {
      const colValues = weightedMatrix.map((row) => row.y[crit.code]);
      const maxVal = Math.max(...colValues);
      const minVal = Math.min(...colValues);

      if (crit.type === "BENEFIT") {
        idealPositive[crit.code] = maxVal;
        idealNegative[crit.code] = minVal;
      } else {
        idealPositive[crit.code] = minVal;
        idealNegative[crit.code] = maxVal;
      }
    });

    const distanceResults: any[] = [];
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

    const finalRankings = distanceResults.map((item) => {
      let preferenceScore = 0;
      if (m === 1) {
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

    finalRankings.sort((a, b) => {
      if (Math.abs(b.preference_score_full - a.preference_score_full) > 1e-9) {
        return b.preference_score_full - a.preference_score_full;
      }
      return String(a.id).localeCompare(String(b.id));
    });

    finalRankings.forEach((item: any, index: number) => {
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

export const topsisEngineService = TopsisEngineService.getInstance();
