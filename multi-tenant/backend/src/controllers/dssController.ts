/*
 * dssController.ts
 * HTTP Controller for BWM Engine & TOPSIS Recommendation Engine in TypeScript
 */

import type { Request, Response } from "express";
import { pool } from "../config/database.js";
import { bwmWeightService } from "../services/dss/BwmWeightService.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { rawCriteriaEvaluationService } from "../services/dss/RawCriteriaEvaluationService.js";
import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";
import { bwmRepository } from "../repositories/bwmRepository.js";

export const calculateBwmWeights = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, best_criteria_id, worst_criteria_id, best_to_others, worst_to_others } = req.body;

    let { rows: criteriaList } = await pool.query("SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;");

    if (criteriaList.length === 0) {
      const defaultCriterias = [
        { name: "C1 - Densitas POI", type: "BENEFIT", weight: 0.32 },
        { name: "C2 - Diversitas POI", type: "BENEFIT", weight: 0.24 },
        { name: "C3 - Skor Keramaian Waktu", type: "BENEFIT", weight: 0.20 },
        { name: "C4 - Kondisi Cuaca", type: "COST", weight: 0.12 },
        { name: "C5 - Jarak Rider dari Hub ke Zona", type: "COST", weight: 0.08 },
        { name: "C6 - Jumlah Kompetitor di Zona", type: "COST", weight: 0.04 },
      ];
      for (const c of defaultCriterias) {
        await pool.query(
          `INSERT INTO criterias (name, type, is_active, weight) VALUES ($1::text, $2::"CriteriaType", true, $3::float) ON CONFLICT (name) DO NOTHING;`,
          [c.name, c.type, c.weight]
        );
      }
      const refreshed = await pool.query("SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;");
      criteriaList = refreshed.rows;
    }

    const formattedCriteria = criteriaList.map((c: any, idx: number) => ({
      ...c,
      id: String(c.id),
      code: `C${idx + 1}`,
      alias_id: String(idx + 1),
    }));

    // Robustly resolve best & worst criteria
    const bestCriteria = formattedCriteria.find(
      (c) => c.id === String(best_criteria_id) || c.code === String(best_criteria_id) || c.alias_id === String(best_criteria_id)
    ) || formattedCriteria[0];

    const worstCriteria = formattedCriteria.find(
      (c) => c.id === String(worst_criteria_id) || c.code === String(worst_criteria_id) || c.alias_id === String(worst_criteria_id)
    ) || formattedCriteria[formattedCriteria.length - 1];

    // Normalize vectors so they index by resolved criteria id
    const mappedBestToOthers: Record<string, number> = {};
    const mappedWorstToOthers: Record<string, number> = {};

    formattedCriteria.forEach((c) => {
      const bVal =
        best_to_others?.[c.id] ??
        best_to_others?.[c.code] ??
        best_to_others?.[c.alias_id] ??
        1;
      mappedBestToOthers[c.id] = parseFloat(String(bVal)) || 1;

      const wVal =
        worst_to_others?.[c.id] ??
        worst_to_others?.[c.code] ??
        worst_to_others?.[c.alias_id] ??
        1;
      mappedWorstToOthers[c.id] = parseFloat(String(wVal)) || 1;
    });

    const result = bwmWeightService.calculateBwmWeights({
      best_criteria_id: bestCriteria.id,
      worst_criteria_id: worstCriteria.id,
      best_to_others: mappedBestToOthers,
      worst_to_others: mappedWorstToOthers,
      criteria_list: formattedCriteria,
    });

    // Enrich weights to include codes (C1-C6) and alias indices (1-6)
    const enrichedWeights: Record<string, number> = { ...result.weights };
    formattedCriteria.forEach((c) => {
      const w = result.weights[c.id] ?? 0;
      enrichedWeights[c.code] = w;
      enrichedWeights[c.alias_id] = w;
    });
    result.weights = enrichedWeights;

    let savedConfig: any = null;
    if (result.is_consistent) {
      const user = (req as any).user;
      const created_by = user?.id || null;
      const created_by_name = user?.name || "Super Admin System";

      savedConfig = await bwmRepository.saveBwmConfig({
        name: name || "Konfigurasi BWM Onboarding",
        best_criteria_id: bestCriteria.id,
        worst_criteria_id: worstCriteria.id,
        best_to_others: mappedBestToOthers,
        worst_to_others: mappedWorstToOthers,
        created_by,
        created_by_name,
      });
    }

    return res.status(200).json({
      msg: result.is_consistent
        ? "Komputasi bobot BWM berhasil diselesaikan."
        : `Penilaian preferensi BWM tidak konsisten (CR = ${result.consistency_ratio.toFixed(4)} > 0.10). Harap sesuaikan kembali nilai perbandingan.`,
      bwm_result: result,
      config: savedConfig,
      is_consistent: result.is_consistent,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getActiveDssConfig = async (req: Request, res: Response): Promise<any> => {
  try {
    const config = await bwmRepository.findActiveConfig();
    return res.status(200).json({ config });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getAllDssConfigs = async (req: Request, res: Response): Promise<any> => {
  try {
    const configs = await bwmRepository.findAllConfigs();
    return res.status(200).json({ configs });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneRawEvaluation = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { time, lat, lon } = req.query as { time?: string; lat?: string; lon?: string };

    const result = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(id, {
      timeSlot: time || undefined,
      riderLat: lat ? parseFloat(lat) : null,
      riderLon: lon ? parseFloat(lon) : null,
    });

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const evaluateHybridBwmTopsis = async (req: Request, res: Response): Promise<any> => {
  try {
    const { zone_ids, time_slot, lat, lon, bwm_config_id } = req.body;

    const result = await hybridBwmTopsisService.evaluateZonesHybrid({
      zone_ids: zone_ids || null,
      time_slot: time_slot || null,
      rider_lat: lat ? parseFloat(lat) : null,
      rider_lon: lon ? parseFloat(lon) : null,
      bwm_config_id: bwm_config_id || null,
      save_snapshot: true,
    });

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getDssSnapshots = async (req: Request, res: Response): Promise<any> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const snapshots = await hybridBwmTopsisService.getSnapshots(limit);
    return res.status(200).json({
      status: "success",
      data: snapshots,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getDssSnapshotById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const snapshot = await hybridBwmTopsisService.getSnapshotById(id);
    return res.status(200).json({
      status: "success",
      data: snapshot,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const previewBwmImpact = async (req: Request, res: Response): Promise<any> => {
  try {
    const { weights, time_slot } = req.body;
    const slot = time_slot || "pagi";

    const result = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: slot,
      customWeights: weights || null,
    });

    return res.status(200).json({
      status: "success",
      time_slot: slot,
      rankings: result.rankings?.slice(0, 5) || [],
      total_zones: result.total_evaluated_zones || result.rankings?.length || 0,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const activateBwmConfig = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const activated = await bwmRepository.activateConfig(id);
    if (!activated) {
      return res.status(404).json({ msg: "Konfigurasi BWM tidak ditemukan." });
    }
    return res.status(200).json({
      msg: "Konfigurasi bobot BWM berhasil diaktifkan.",
      config: activated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getTopsisRecommendations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { time, lat, lon } = req.query as { time?: string; lat?: string; lon?: string };
    const riderId = req.user?.id || (req.user as any)?.userId || null;

    const result = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: time || "pagi",
      riderLat: lat ? parseFloat(lat) : null,
      riderLon: lon ? parseFloat(lon) : null,
      riderId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
