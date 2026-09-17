/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   dssController.js (HTTP Controller for BWM Engine & TOPSIS Recommendation Engine)
 */

import { bwmWeightService } from "../services/dss/BwmWeightService.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { rawCriteriaEvaluationService } from "../services/dss/RawCriteriaEvaluationService.js";
import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";
import { bwmRepository } from "../repositories/bwmRepository.js";
import { TimeSlotEvaluator } from "../utils/TimeSlotEvaluator.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const calculateBwmWeights = async (req, res) => {
  try {
    const { name, best_criteria_id, worst_criteria_id, best_to_others, worst_to_others } = req.body;

    // 1. Fetch active criteria list from database via repository
    const criteriaList = await bwmRepository.findActiveCriterias();

    if (criteriaList.length === 0) {
      return sendError(res, "Tabel kriteria (criterias) belum terisi.", 404);
    }

    // Assign code (C1..Cn) dynamically if not present
    const formattedCriteria = criteriaList.map((c, idx) => ({
      ...c,
      code: `C${idx + 1}`,
    }));

    // 2. Compute BWM Optimal Weights & Consistency Check
    const result = bwmWeightService.calculateBwmWeights({
      best_criteria_id,
      worst_criteria_id,
      best_to_others,
      worst_to_others,
      criteria_list: formattedCriteria,
    });

    if (!result.is_consistent) {
      return res.status(400).json({
        success: false,
        status: "error",
        statusCode: 400,
        msg: `Penilaian preferensi BWM tidak konsisten (CR = ${result.consistency_ratio.toFixed(4)} > 0.10). Harap tinjau ulang preferensi perbandingan di UI.`,
        message: `Penilaian preferensi BWM tidak konsisten (CR = ${result.consistency_ratio.toFixed(4)} > 0.10). Harap tinjau ulang preferensi perbandingan di UI.`,
        result,
      });
    }

    // 3. Save BWM configuration to PostgreSQL
    const savedConfig = await bwmRepository.saveBwmConfig({
      name: name || "Konfigurasi Bobot BWM Sidoarjo",
      best_criteria_id,
      worst_criteria_id,
      best_to_others,
      worst_to_others,
      calculated_weights: result.weights,
      consistency_ratio: result.consistency_ratio,
    });

    return sendSuccess(
      res,
      {
        config: savedConfig,
        bwm_result: result,
      },
      "Komputasi bobot BWM optimal berhasil dan konsisten (CR <= 0.10).",
      200,
      {
        config: savedConfig,
        bwm_result: result,
      }
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getActiveDssConfig = async (req, res) => {
  try {
    const activeConfig = await bwmRepository.findActiveConfig();
    if (!activeConfig) {
      return sendError(res, "Belum ada konfigurasi BWM aktif yang tersimpan.", 404);
    }
    return sendSuccess(res, { config: activeConfig }, "Konfigurasi BWM aktif berhasil dimuat.", 200, {
      config: activeConfig,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getAllBwmConfigs = async (req, res) => {
  try {
    const configs = await bwmRepository.findAllConfigs();
    return sendSuccess(res, { configs }, "Daftar konfigurasi BWM berhasil dimuat.", 200, {
      configs,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const activateBwmConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const activated = await bwmRepository.activateConfig(id);
    return sendSuccess(
      res,
      { config: activated },
      "Konfigurasi BWM berhasil diaktifkan.",
      200,
      { config: activated }
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const previewBwmImpact = async (req, res) => {
  try {
    const { weights, best_criteria_id, worst_criteria_id, best_to_others, worst_to_others, time_slot } = req.body;
    const slot = time_slot ? TimeSlotEvaluator.getSlot(time_slot) : TimeSlotEvaluator.getSlot(new Date());

    let customWeights = weights || null;

    // Jika user mengirimkan perbandingan BWM langsung untuk di-preview sebelum disimpan
    if (!customWeights && best_criteria_id && worst_criteria_id && best_to_others && worst_to_others) {
      const criteriaList = await bwmRepository.findActiveCriterias();
      const formattedCriteria = criteriaList.map((c, idx) => ({ ...c, code: `C${idx + 1}` }));
      
      const bwmRes = bwmWeightService.calculateBwmWeights({
        best_criteria_id,
        worst_criteria_id,
        best_to_others,
        worst_to_others,
        criteria_list: formattedCriteria,
      });
      customWeights = bwmRes.weights;
    }

    const result = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: slot,
      customWeights,
    });

    return sendSuccess(
      res,
      {
        time_slot: slot,
        rankings: result.rankings || [],
        total_zones: result.total_evaluated_zones || result.rankings?.length || 0,
      },
      "Simulasi rekomendasi BWM-TOPSIS berhasil dihitung.",
      200,
      {
        time_slot: slot,
        rankings: result.rankings || [],
        total_zones: result.total_evaluated_zones || result.rankings?.length || 0,
      }
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getZoneRawEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { time, lat, lon } = req.query;
    const slot = time ? TimeSlotEvaluator.getSlot(time) : TimeSlotEvaluator.getSlot(new Date());

    const result = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(id, {
      timeSlot: slot,
      riderLat: lat ? parseFloat(lat) : null,
      riderLon: lon ? parseFloat(lon) : null,
    });

    return sendSuccess(res, result, "Evaluasi mentah kriteria zona berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const evaluateHybridBwmTopsis = async (req, res) => {
  try {
    const { zone_ids, time_slot, lat, lon, bwm_config_id } = req.body;
    const slot = time_slot ? TimeSlotEvaluator.getSlot(time_slot) : TimeSlotEvaluator.getSlot(new Date());

    const result = await hybridBwmTopsisService.evaluateZonesHybrid({
      zone_ids: zone_ids || null,
      time_slot: slot,
      rider_lat: lat ? parseFloat(lat) : null,
      rider_lon: lon ? parseFloat(lon) : null,
      bwm_config_id: bwm_config_id || null,
      save_snapshot: true,
    });

    return sendSuccess(res, result, "Evaluasi hybrid BWM-TOPSIS berhasil dijalankan.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getDssSnapshots = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const snapshots = await hybridBwmTopsisService.getSnapshots(limit);
    return sendSuccess(res, snapshots, "Daftar snapshot DSS berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getDssSnapshotById = async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await hybridBwmTopsisService.getSnapshotById(id);
    return sendSuccess(res, snapshot, "Detail snapshot DSS berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getTopsisRecommendations = async (req, res) => {
  try {
    const { time, lat, lon } = req.query;
    const riderId = req.user?.id || req.user?.userId || null;
    const slot = time ? TimeSlotEvaluator.getSlot(time) : TimeSlotEvaluator.getSlot(new Date());

    const result = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: slot,
      riderLat: lat ? parseFloat(lat) : null,
      riderLon: lon ? parseFloat(lon) : null,
      riderId,
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};
