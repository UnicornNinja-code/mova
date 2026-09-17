/*
 * CandidateSellingLocationService.js
 * Business logic & validation pipeline for candidate selling locations
 */

import { pool } from "../config/database.js";
import { candidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { zoneRepository } from "../repositories/zoneRepository.js";
import { spatialRestrictionService } from "./spatial/SpatialRestrictionService.js";

export class CandidateSellingLocationService {
  /**
   * Validate coordinates helper
   */
  isValidCoordinates(lat, lon) {
    if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (isNaN(numLat) || isNaN(numLon) || !isFinite(numLat) || !isFinite(numLon)) return false;
    if (numLat < -90 || numLat > 90) return false;
    if (numLon < -180 || numLon > 180) return false;
    return true;
  }

  /**
   * Deterministic Validation Pipeline for Candidate Selling Location
   */
  async validateCandidateLocation(input = {}) {
    const { zone_id, poi_id = null, latitude, longitude, name = "Candidate Location", source = "MANUAL" } = input;

    // STEP 1-3: Use SpatialRestrictionService (SSOT for Coordinate, Containment & Road Prohibitions)
    const spatialCheck = await spatialRestrictionService.validateCandidateSpot(latitude, longitude, zone_id);
    if (spatialCheck.validation_status === "REJECTED") {
      return {
        validation_status: "REJECTED",
        rejection_reason: spatialCheck.rejection_reason,
      };
    }

    // STEP 4: POI Anchor Eligibility (If poi_id provided)
    if (poi_id) {
      const poiQuery = `
        SELECT p.id, p.approval_status, p.operational_status, pc.is_active
        FROM pois p
        JOIN poi_categories pc ON p.category = pc.name
        WHERE p.id = $1;
      `;
      const { rows: poiRows } = await pool.query(poiQuery, [poi_id]);
      if (
        poiRows.length === 0 ||
        poiRows[0].approval_status !== "APPROVED" ||
        poiRows[0].operational_status !== "ELIGIBLE" ||
        !poiRows[0].is_active
      ) {
        return {
          validation_status: "REJECTED",
          rejection_reason: "INVALID_POI",
        };
      }
    }

    // STEP 5: Duplicate Candidate Protection (Within 5 meters inside same zone)
    const duplicate = await candidateSellingLocationRepository.findNearbyDuplicateCandidate(latitude, longitude, 5, zone_id);
    if (duplicate) {
      return {
        validation_status: "REJECTED",
        rejection_reason: "DUPLICATE_CANDIDATE",
      };
    }

    // STEP 6: Passed All Rules
    return {
      validation_status: "ALLOWED",
      rejection_reason: null,
    };
  }

  /**
   * Create Candidate Selling Location with Transaction & Validation Pipeline
   */
  async createCandidateSellingLocation(input = {}) {
    const validationResult = await this.validateCandidateLocation(input);

    const candidateRecord = await candidateSellingLocationRepository.createCandidate({
      zone_id: input.zone_id,
      poi_id: input.poi_id || null,
      name: input.name || "Candidate Location",
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source || "MANUAL",
      validation_status: validationResult.validation_status,
      rejection_reason: validationResult.rejection_reason,
    });

    return candidateRecord;
  }

  /**
   * Fetch Candidates for a Zone
   */
  async getCandidatesByZone(zoneId) {
    if (!zoneId) {
      const error = new Error("Zone ID required.");
      error.statusCode = 400;
      throw error;
    }
    return await candidateSellingLocationRepository.findByZoneId(zoneId);
  }

  /**
   * Generate Candidates from Eligible POIs in a Zone (Logical POI Aware)
   */
  async generateCandidatesFromZonePois(zoneId) {
    const zone = await zoneRepository.findById(zoneId);
    if (!zone) {
      const error = new Error(`Zone with ID '${zoneId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Fetch eligible logical POIs inside zone polygon
    const pois = await poiRepository.findByZonePolygon(zone.polygon);
    const generatedCandidates = [];

    for (const poi of pois) {
      const candidateInput = {
        zone_id: zoneId,
        poi_id: poi.id,
        name: `Titik Mangkal - ${poi.name}`,
        latitude: poi.latitude,
        longitude: poi.longitude,
        source: "POI_REFERENCE",
      };

      const result = await this.createCandidateSellingLocation(candidateInput);
      generatedCandidates.push(result);
    }

    return generatedCandidates;
  }

  /**
   * Evaluate Single Candidate Selling Location via Existing DSS & TOPSIS Engine
   */
  async evaluateCandidateSellingLocation(candidateId, options = {}) {
    const candidate = await candidateSellingLocationRepository.findById(candidateId);
    if (!candidate) {
      const error = new Error(`Candidate selling location with ID '${candidateId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // CANDIDATE ELIGIBILITY GATE: Reject if validation_status is not ALLOWED
    if (candidate.validation_status !== "ALLOWED") {
      const error = new Error(`Candidate location '${candidate.name}' is not eligible for DSS evaluation (Status: ${candidate.validation_status}, Reason: ${candidate.rejection_reason || 'N/A'}).`);
      error.statusCode = 400;
      error.code = "CANDIDATE_NOT_ELIGIBLE_FOR_DSS";
      throw error;
    }

    // Re-verify spatial integrity against zone & protocol roads
    const spatialCheck = await this.validateCandidateLocation({
      zone_id: candidate.zone_id,
      poi_id: candidate.poi_id,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      name: candidate.name,
      source: candidate.source,
    });

    if (spatialCheck.validation_status !== "ALLOWED" && spatialCheck.rejection_reason !== "DUPLICATE_CANDIDATE") {
      const error = new Error(`Candidate location failed spatial eligibility re-verification: ${spatialCheck.rejection_reason}.`);
      error.statusCode = 400;
      error.code = "CANDIDATE_NOT_ELIGIBLE_FOR_DSS";
      throw error;
    }

    const zone = await zoneRepository.findById(candidate.zone_id);
    if (!zone) {
      const error = new Error(`Associated Zone with ID '${candidate.zone_id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const { TimeSlotEvaluator } = await import("../utils/TimeSlotEvaluator.js");
    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(new Date());
    const { poiTimeCrowdService } = await import("./poi/POITimeCrowdService.js");
    const { poiWeatherService } = await import("./poi/POIWeatherService.js");
    const { poiDistanceService } = await import("./poi/POIDistanceService.js");
    const { poiCompetitorService } = await import("./poi/POICompetitorService.js");

    // Reuse existing DSS services for C1-C6 in parallel (Prevent waterfall)
    const [c1c2Res, c3Res, c4Res, c5Res, c6Res] = await Promise.all([
      poiRepository.getDensitasDanDiversitasByZonePolygon(zone.polygon),
      poiTimeCrowdService.calculateZoneC3Score(zone.polygon, activeSlot),
      poiWeatherService.calculateZoneC4Score(zone.id, activeSlot),
      poiDistanceService.calculateCandidateC5Score(candidate.latitude, candidate.longitude, options.riderLat, options.riderLon),
      poiCompetitorService.getZoneC6Score(zone.id),
    ]);

    const scores = {
      C1: c1c2Res?.skor_c1 || 0,
      C2: c1c2Res?.skor_c2 || 0,
      C3: c3Res?.total_c3_score || 0,
      C4: c4Res?.skor_c4 ?? c4Res?.max_precipitation_probability ?? 0,
      C5: c5Res?.skor_c5 ?? c5Res?.distance_km ?? 0,
      C6: c6Res?.skor_c6 || 0,
    };

    return {
      candidate_id: candidate.id,
      candidate_name: candidate.name,
      zone_id: candidate.zone_id,
      zone_name: zone.name,
      validation_status: candidate.validation_status,
      time_slot: activeSlot,
      scores,
    };
  }

  /**
   * Evaluate and Rank All ALLOWED Candidates in a Zone via TOPSIS Engine
   */
  async evaluateZoneCandidateSellingLocations(zoneId, options = {}) {
    const candidates = await candidateSellingLocationRepository.findByZoneId(zoneId);
    const allowedCandidates = candidates.filter((c) => c.validation_status === "ALLOWED");

    if (allowedCandidates.length === 0) {
      return {
        message: "Tidak ada candidate selling location dengan status 'ALLOWED' di zona ini.",
        total_evaluated_candidates: 0,
        rankings: [],
      };
    }

    const { topsisEngineService } = await import("./dss/TopsisEngineService.js");
    const { pool } = await import("../config/database.js");
    const { bwmRepository } = await import("../repositories/bwmRepository.js");
    const { bwmWeightService } = await import("./dss/BwmWeightService.js");

    // Fetch active BWM weights or fallback to equal weights
    const activeBwmConfig = await bwmRepository.findActiveConfig();
    let weights = { C1: 0.1667, C2: 0.1667, C3: 0.1667, C4: 0.1667, C5: 0.1667, C6: 0.1667 };

    if (activeBwmConfig && activeBwmConfig.best_to_others && activeBwmConfig.worst_to_others) {
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
        if (bwmRes.weights[c.id] !== undefined) weights[code] = bwmRes.weights[c.id];
      });
    }

    const criteriaSpecs = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: weights.C1 },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: weights.C2 },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: weights.C3 },
      { code: "C4", name: "Kondisi Cuaca (Hujan)", type: "COST", weight: weights.C4 },
      { code: "C5", name: "Jarak Boundary (KM)", type: "COST", weight: weights.C5 },
      { code: "C6", name: "Dampak Kompetitor", type: "COST", weight: weights.C6 },
    ];

    // Parallelize candidate evaluations (Prevent waterfall loop)
    const rawMatrix = await Promise.all(
      allowedCandidates.map(async (cand) => {
        const evalRes = await this.evaluateCandidateSellingLocation(cand.id, options);
        return {
          id: cand.id,
          name: cand.name,
          scores: evalRes.scores,
        };
      })
    );

    // Reuse existing TopsisEngineService for TOPSIS calculation
    const topsisRes = topsisEngineService.calculateTopsisForMatrix(rawMatrix, criteriaSpecs);

    // Phase 8: Calculate Matrix Averages for Decision Reasoning
    const count = rawMatrix.length;
    const matrixAvg = {
      C1: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C1, 0) / count : 0,
      C2: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C2, 0) / count : 0,
      C3: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C3, 0) / count : 0,
      C4: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C4, 0) / count : 0,
      C5: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C5, 0) / count : 0,
      C6: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C6, 0) / count : 0,
    };

    // Generate Candidate Explanations
    const { candidateExplainabilityService } = await import("./dss/CandidateExplainabilityService.js");
    const explanations = topsisRes.rankings.map((rankItem) => {
      const candObj = allowedCandidates.find((c) => c.id === rankItem.id) || { id: rankItem.id, name: rankItem.name, validation_status: "ALLOWED" };
      const rawObj = rawMatrix.find((r) => r.id === rankItem.id) || { scores: {} };
      return candidateExplainabilityService.generateCandidateExplanation(candObj, rawObj.scores, rankItem, matrixAvg);
    });

    // Phase 8: Save Immutable Evaluation Snapshot to dss_histories
    const { topsisRepository } = await import("../repositories/topsisRepository.js");
    const { TimeSlotEvaluator } = await import("../utils/TimeSlotEvaluator.js");
    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(new Date());

    const snapshotRecord = await topsisRepository.saveExecutionHistory({
      consistency_ratio: activeBwmConfig?.consistency_ratio || 0,
      status: "CANDIDATE_EVALUATION",
      details: {
        zone_id: zoneId,
        time_slot: activeSlot,
        candidate_count: allowedCandidates.length,
        eligible_candidate_count: allowedCandidates.length,
        top_candidate_id: topsisRes.rankings[0]?.id,
        top_preference_score: topsisRes.rankings[0]?.preference_score,
        criteria_specs: criteriaSpecs,
        raw_matrix: rawMatrix,
        ideal_positive: topsisRes.ideal_positive,
        ideal_negative: topsisRes.ideal_negative,
        rankings: topsisRes.rankings,
        explanations,
      },
    });

    return {
      message: "Proses Evaluasi & Perankingan Candidate Selling Locations Berhasil Selesai.",
      evaluation_id: snapshotRecord.history.id,
      zone_id: zoneId,
      time_slot: activeSlot,
      total_evaluated_candidates: rawMatrix.length,
      criteria_specs: criteriaSpecs,
      ideal_positive: topsisRes.ideal_positive,
      ideal_negative: topsisRes.ideal_negative,
      rankings: topsisRes.rankings,
      explanations,
      audit: {
        evaluation_id: snapshotRecord.history.id,
        executed_at: snapshotRecord.history.created_at || snapshotRecord.history.execution_date,
        method: "TOPSIS",
        criteria_codes: ["C1", "C2", "C3", "C4", "C5", "C6"],
        weights,
      },
    };
  }

  /**
   * Fetch Evaluation Snapshot & Audit Metadata by ID (Read-Only)
   */
  async getEvaluationSnapshotById(evaluationId) {
    const { topsisRepository } = await import("../repositories/topsisRepository.js");
    const history = await topsisRepository.findHistoryById(evaluationId);

    if (!history) {
      const error = new Error(`Evaluation snapshot with ID '${evaluationId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const details = typeof history.details === "string" ? JSON.parse(history.details) : history.details || {};

    return {
      evaluation_id: history.id,
      executed_at: history.created_at || history.execution_date,
      status: history.status,
      zone_id: details.zone_id,
      time_slot: details.time_slot,
      total_evaluated_candidates: details.candidate_count || 0,
      criteria_specs: details.criteria_specs || [],
      ideal_positive: details.ideal_positive || {},
      ideal_negative: details.ideal_negative || {},
      rankings: details.rankings || [],
      explanations: details.explanations || [],
      audit: {
        evaluation_id: history.id,
        executed_at: history.created_at || history.execution_date,
        method: "TOPSIS",
        consistency_ratio: history.consistency_ratio,
      },
    };
  }
}

export const candidateSellingLocationService = new CandidateSellingLocationService();
