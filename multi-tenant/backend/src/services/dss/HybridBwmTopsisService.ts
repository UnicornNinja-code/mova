/*
 * HybridBwmTopsisService.ts
 * Domain Service for DSS Phase 2C — Hybrid BWM-TOPSIS Integration Engine (DSS-HYBRID-BWM-TOPSIS-v1.0) in TypeScript
 * Orchestrates: RawCriteriaEvaluationService -> BWM Weight Service -> TOPSIS Engine Service.
 */

import { ZoneModel } from "../../models/zoneModel.js";
import { rawCriteriaEvaluationService } from "./RawCriteriaEvaluationService.js";
import { topsisEngineService } from "./TopsisEngineService.js";
import { bwmRepository } from "../../repositories/bwmRepository.js";
import { topsisRepository } from "../../repositories/topsisRepository.js";
import { pool } from "../../config/database.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";
import { bwmWeightService } from "./BwmWeightService.js";

export class HybridBwmTopsisService {
  private static instance: HybridBwmTopsisService | null = null;

  constructor() {
    if (HybridBwmTopsisService.instance) {
      return HybridBwmTopsisService.instance;
    }
    HybridBwmTopsisService.instance = this;
  }

  public static getInstance(): HybridBwmTopsisService {
    if (!HybridBwmTopsisService.instance) {
      HybridBwmTopsisService.instance = new HybridBwmTopsisService();
    }
    return HybridBwmTopsisService.instance;
  }

  /**
   * Execute Hybrid BWM-TOPSIS Zone Evaluation for user-selected zone IDs
   */
  public async evaluate(options: {
    zone_ids?: string[] | null;
    time_slot?: string | null;
    rider_lat?: number | null;
    rider_lon?: number | null;
    bwm_config_id?: string | null;
    save_snapshot?: boolean;
  } = {}): Promise<any> {
    return this.evaluateZonesHybrid(options);
  }

  /**
   * Execute Hybrid BWM-TOPSIS Zone Evaluation for user-selected zone IDs
   */
  public async evaluateZonesHybrid(options: {
    zone_ids?: string[] | null;
    time_slot?: string | null;
    rider_lat?: number | null;
    rider_lon?: number | null;
    bwm_config_id?: string | null;
    save_snapshot?: boolean;
  } = {}): Promise<any> {
    const evaluatedAt = new Date();
    const activeSlot = options.time_slot || TimeSlotEvaluator.getSlot(evaluatedAt);
    const { zone_ids = null, rider_lat = null, rider_lon = null, bwm_config_id = null } = options;

    let targetZoneIds: any[] = [];
    if (Array.isArray(zone_ids) && zone_ids.length > 0) {
      targetZoneIds = zone_ids;
    } else {
      const activeZones = await ZoneModel.findAll({ status: "ACTIVE" });
      targetZoneIds = activeZones.map((z: any) => z.id);
    }

    const rawEvaluations: any[] = [];
    const excludedZones: any[] = [];

    for (const zid of targetZoneIds) {
      const zone = await ZoneModel.findById(zid);
      if (!zone) continue;

      if (zone.status === "RESTRICTED" || zone.status === "INACTIVE") {
        excludedZones.push({
          zone_id: zone.id,
          zone_name: zone.name,
          status: zone.status,
          reason: `Zona tidak dapat digunakan sebagai alternatif DSS karena berstatus '${zone.status}'.`,
        });
        continue;
      }

      const evalRes = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(zid, {
        timeSlot: activeSlot,
        riderLat: rider_lat,
        riderLon: rider_lon,
      });
      rawEvaluations.push(evalRes);
    }

    if (rawEvaluations.length === 0) {
      const error: any = new Error("Tidak ada data Zona Operasional AKTIF yang dapat dievaluasi (semua zona terdekat berstatus RESTRICTED/INACTIVE).");
      error.statusCode = 422;
      throw error;
    }

    let bwmConfig = null;
    if (bwm_config_id) {
      bwmConfig = await bwmRepository.findConfigById(bwm_config_id);
    }
    if (!bwmConfig) {
      bwmConfig = await bwmRepository.findActiveConfig();
    }

    let weights: Record<string, number> = {
      C1: 1 / 6, C2: 1 / 6, C3: 1 / 6,
      C4: 1 / 6, C5: 1 / 6, C6: 1 / 6,
    };

    const bwmMetadata: any = {
      id: bwmConfig?.id || "DEFAULT_EQUAL_WEIGHTS",
      name: bwmConfig?.name || "Equal Weights Fallback (1/6)",
      weight_source: bwmConfig ? "BWM" : "EQUAL_FALLBACK",
      best_criteria_id: bwmConfig?.best_criteria_id || null,
      worst_criteria_id: bwmConfig?.worst_criteria_id || null,
      consistency_ratio: bwmConfig?.consistency_ratio || 0,
      is_consistent: bwmConfig ? (bwmConfig.consistency_ratio <= 0.10) : true,
      weights,
    };

    if (bwmConfig && bwmConfig.best_to_others && bwmConfig.worst_to_others) {
      const { rows: dbCriteria } = await pool.query("SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;");
      const formattedCriteria = dbCriteria.map((c: any, idx: number) => ({ ...c, code: `C${idx + 1}` }));

      const bwmRes = bwmWeightService.calculateBwmWeights({
        best_criteria_id: bwmConfig.best_criteria_id,
        worst_criteria_id: bwmConfig.worst_criteria_id,
        best_to_others: bwmConfig.best_to_others,
        worst_to_others: bwmConfig.worst_to_others,
        criteria_list: formattedCriteria,
      });

      dbCriteria.forEach((c: any, idx: number) => {
        const code = `C${idx + 1}`;
        if (bwmRes.weights[c.id] !== undefined) {
          weights[code] = bwmRes.weights[c.id];
        }
      });

      bwmMetadata.weights = weights;
      bwmMetadata.consistency_ratio = bwmRes.consistency_ratio;
      bwmMetadata.is_consistent = bwmRes.is_consistent;
    }

    const criteriaSpecs = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: weights.C1 || (1 / 6) },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: weights.C2 || (1 / 6) },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: weights.C3 || (1 / 6) },
      { code: "C4", name: "Risiko Cuaca", type: "COST", weight: weights.C4 || (1 / 6) },
      { code: "C5", name: "Jarak Aksesibilitas Centroid", type: "COST", weight: weights.C5 || (1 / 6) },
      { code: "C6", name: "Indeks Persaingan Pasar", type: "COST", weight: weights.C6 || (1 / 6) },
    ];

    const rawMatrix = rawEvaluations.map((ev) => ({
      id: ev.zone_id,
      name: ev.zone_name,
      scores: {
        C1: ev.criteria.C1.raw_value,
        C2: ev.criteria.C2.raw_value,
        C3: ev.criteria.C3.raw_value,
        C4: ev.criteria.C4.raw_value,
        C5: ev.criteria.C5.raw_value,
        C6: ev.criteria.C6.raw_value,
      },
    }));

    const topsisRes = topsisEngineService.calculateTopsisForMatrix(rawMatrix, criteriaSpecs);

    const traceableRankings = topsisRes.rankings.map((rk: any) => {
      const rawObj = rawEvaluations.find((ev) => ev.zone_id === rk.id);
      const normRow = topsisRes.normalized_matrix.find((n: any) => n.id === rk.id);
      const weightRow = topsisRes.weighted_matrix.find((w: any) => w.id === rk.id);

      return {
        rank: rk.rank,
        zone_id: rk.id,
        zone_name: rk.name,
        preference_score: rk.preference_score,
        preference_score_full: rk.preference_score_full,
        d_pos: rk.d_pos,
        d_neg: rk.d_neg,
        traceability: {
          raw_criteria: rawObj ? rawObj.criteria : {},
          normalized_r: normRow ? normRow.r : {},
          weighted_v: weightRow ? weightRow.y : {},
        },
      };
    });

    const evaluationResult: any = {
      evaluation_version: "DSS-HYBRID-BWM-TOPSIS-v1.1",
      evaluated_at: evaluatedAt.toISOString(),
      time_slot: activeSlot,
      total_evaluated_zones: rawEvaluations.length,
      excluded_zones: excludedZones,
      bwm_config: bwmMetadata,
      criteria_specs: criteriaSpecs,
      topsis_summary: {
        ideal_positive: topsisRes.ideal_positive,
        ideal_negative: topsisRes.ideal_negative,
        column_metadata: topsisRes.column_metadata,
        rankings: traceableRankings,
      },
    };

    if (options.save_snapshot !== false) {
      try {
        const savedHistory = await topsisRepository.saveExecutionHistory({
          consistency_ratio: bwmMetadata.consistency_ratio,
          status: "COMPLETED",
          details: evaluationResult,
          rankings: traceableRankings,
        });
        evaluationResult.snapshot_id = savedHistory.history?.id || null;
      } catch (saveErr: any) {
        console.warn("⚠️ Warning: Gagal menyimpan snapshot evaluasi ke database:", saveErr.message);
      }
    }

    return evaluationResult;
  }

  /**
   * Fetch recent Evaluation Snapshots from Database
   */
  public async getSnapshots(limit: number = 20): Promise<any[]> {
    const histories = await topsisRepository.findHistories(limit);
    return histories.map((h: any) => {
      let detailsObj = h.details;
      if (typeof detailsObj === "string") {
        try { detailsObj = JSON.parse(detailsObj); } catch (e) {}
      }
      return {
        id: h.id,
        created_at: h.created_at,
        consistency_ratio: h.consistency_ratio,
        status: h.status,
        evaluation_version: detailsObj?.evaluation_version || "DSS-HYBRID-BWM-TOPSIS-v1.1",
        time_slot: detailsObj?.time_slot || "unknown",
        total_evaluated_zones: detailsObj?.total_evaluated_zones || 0,
        bwm_config_name: detailsObj?.bwm_config?.name || "Standard Profile",
        top_ranking_zone: detailsObj?.topsis_summary?.rankings?.[0]?.zone_name || "N/A",
        details: detailsObj,
      };
    });
  }

  /**
   * Fetch single Evaluation Snapshot by ID from Database
   */
  public async getSnapshotById(id: number | string): Promise<any> {
    const history = await topsisRepository.findHistoryById(id);
    if (!history) {
      const error: any = new Error(`Snapshot evaluasi dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    let detailsObj = history.details;
    if (typeof detailsObj === "string") {
      try { detailsObj = JSON.parse(detailsObj); } catch (e) {}
    }

    return {
      id: history.id,
      created_at: history.created_at,
      consistency_ratio: history.consistency_ratio,
      status: history.status,
      snapshot_data: detailsObj,
    };
  }
}

export const hybridBwmTopsisService = HybridBwmTopsisService.getInstance();
