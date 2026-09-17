/*
 * CandidateSellingLocationService.ts
 * Business logic & validation pipeline for candidate selling locations in TypeScript
 */

import { pool } from "../config/database.js";
import { candidateSellingLocationRepository, CandidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";
import { poiRepository, PoiRepository } from "../repositories/poiRepository.js";
import { zoneRepository, ZoneRepository } from "../repositories/zoneRepository.js";
import { TimeSlotEvaluator } from "../utils/TimeSlotEvaluator.js";
import { poiTimeCrowdService } from "./poi/POITimeCrowdService.js";
import { poiWeatherService } from "./poi/POIWeatherService.js";
import { poiDistanceService } from "./poi/POIDistanceService.js";
import { poiCompetitorService } from "./poi/POICompetitorService.js";
import { topsisEngineService } from "./dss/TopsisEngineService.js";
import { bwmRepository } from "../repositories/bwmRepository.js";
import { bwmWeightService } from "./dss/BwmWeightService.js";
import { candidateExplainabilityService } from "./dss/CandidateExplainabilityService.js";
import { topsisRepository } from "../repositories/topsisRepository.js";

export class CandidateSellingLocationService {
  private candRepo: CandidateSellingLocationRepository;
  private poiRepo: PoiRepository;
  private zoneRepo: ZoneRepository;

  constructor(
    candRepo: CandidateSellingLocationRepository = candidateSellingLocationRepository,
    poiRepo: PoiRepository = poiRepository,
    zoneRepo: ZoneRepository = zoneRepository
  ) {
    this.candRepo = candRepo;
    this.poiRepo = poiRepo;
    this.zoneRepo = zoneRepo;
  }

  /**
   * Validate coordinates helper
   */
  public isValidCoordinates(lat: any, lon: any): boolean {
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
  public async validateCandidateLocation(input: any = {}): Promise<{
    validation_status: "ALLOWED" | "REJECTED";
    rejection_reason: string | null;
  }> {
    const { zone_id, poi_id = null, latitude, longitude } = input;

    // STEP 1: Coordinate Validation
    if (!this.isValidCoordinates(latitude, longitude)) {
      return {
        validation_status: "REJECTED",
        rejection_reason: "INVALID_COORDINATES",
      };
    }

    // STEP 2: Zone Containment Check via PostGIS ST_Contains
    if (!zone_id) {
      return {
        validation_status: "REJECTED",
        rejection_reason: "OUTSIDE_ZONE",
      };
    }

    const zoneQuery = `
      SELECT id, name 
      FROM zones 
      WHERE id = $1 
        AND ST_Contains(
          CASE 
            WHEN json_typeof(polygon::json) = 'object' THEN ST_GeomFromGeoJSON(polygon::text)
            ELSE ST_GeomFromGeoJSON(polygon::text)
          END,
          ST_SetSRID(ST_MakePoint($3, $2), 4326)
        );
    `;

    const { rows: zoneRows } = await pool.query(zoneQuery, [zone_id, latitude, longitude]);
    if (zoneRows.length === 0) {
      return {
        validation_status: "REJECTED",
        rejection_reason: "OUTSIDE_ZONE",
      };
    }

    // STEP 3: Protocol Road Restriction Check via PostGIS ST_Intersects
    const roadQuery = `
      SELECT id, name 
      FROM protocol_roads 
      WHERE ST_Intersects(
        geom,
        ST_Buffer(ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 10)::geometry
      )
      LIMIT 1;
    `;

    const { rows: roadRows } = await pool.query(roadQuery, [latitude, longitude]);
    if (roadRows.length > 0) {
      return {
        validation_status: "REJECTED",
        rejection_reason: "PROHIBITED_ROAD",
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

    // STEP 5: Duplicate Candidate Protection
    const duplicate = await this.candRepo.findNearbyDuplicateCandidate(latitude, longitude, 5, zone_id);
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
  public async createCandidateSellingLocation(input: any = {}): Promise<any> {
    const validationResult = await this.validateCandidateLocation(input);

    const candidateRecord = await this.candRepo.createCandidate({
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
  public async getCandidatesByZone(zoneId: number | string): Promise<any[]> {
    if (!zoneId) {
      const error: any = new Error("Zone ID required.");
      error.statusCode = 400;
      throw error;
    }
    return await this.candRepo.findByZoneId(zoneId);
  }

  /**
   * Generate Candidates from Eligible POIs in a Zone
   */
  public async generateCandidatesFromZonePois(zoneId: number | string): Promise<any[]> {
    const zone = await this.zoneRepo.findById(zoneId);
    if (!zone) {
      const error: any = new Error(`Zone with ID '${zoneId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const pois = await this.poiRepo.findByZonePolygon(zone.polygon);
    const generatedCandidates: any[] = [];

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
  public async evaluateCandidateSellingLocation(candidateId: number | string, options: any = {}): Promise<any> {
    const candidate = await this.candRepo.findById(candidateId);
    if (!candidate) {
      const error: any = new Error(`Candidate selling location with ID '${candidateId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (candidate.validation_status !== "ALLOWED") {
      const error: any = new Error(`Candidate location '${candidate.name}' is not eligible for DSS evaluation (Status: ${candidate.validation_status}, Reason: ${candidate.rejection_reason || "N/A"}).`);
      error.statusCode = 400;
      error.code = "CANDIDATE_NOT_ELIGIBLE_FOR_DSS";
      throw error;
    }

    const spatialCheck = await this.validateCandidateLocation({
      zone_id: candidate.zone_id,
      poi_id: candidate.poi_id,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      name: candidate.name,
      source: candidate.source,
    });

    if (spatialCheck.validation_status !== "ALLOWED" && spatialCheck.rejection_reason !== "DUPLICATE_CANDIDATE") {
      const error: any = new Error(`Candidate location failed spatial eligibility re-verification: ${spatialCheck.rejection_reason}.`);
      error.statusCode = 400;
      error.code = "CANDIDATE_NOT_ELIGIBLE_FOR_DSS";
      throw error;
    }

    const zone = await this.zoneRepo.findById(candidate.zone_id);
    if (!zone) {
      const error: any = new Error(`Associated Zone with ID '${candidate.zone_id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(new Date());

    const c1c2Res = await this.poiRepo.getDensitasDanDiversitasByZonePolygon(zone.polygon);
    const c3Res = await poiTimeCrowdService.calculateZoneC3Score(zone.polygon, activeSlot);
    const c4Res = await poiWeatherService.calculateZoneC4Score(zone.id, activeSlot);
    const c5Res = await poiDistanceService.calculateCandidateC5Score(candidate.latitude, candidate.longitude, options.riderLat, options.riderLon);
    const c6Res = await poiCompetitorService.getZoneC6Score(zone.id);

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
  public async evaluateZoneCandidateSellingLocations(zoneId: number | string, options: any = {}): Promise<any> {
    const candidates = await this.candRepo.findByZoneId(zoneId);
    const allowedCandidates = candidates.filter((c: any) => c.validation_status === "ALLOWED");

    if (allowedCandidates.length === 0) {
      return {
        message: "Tidak ada candidate selling location dengan status 'ALLOWED' di zona ini.",
        total_evaluated_candidates: 0,
        rankings: [],
      };
    }

    const activeBwmConfig = await bwmRepository.findActiveConfig();
    let weights: Record<string, number> = { C1: 0.1667, C2: 0.1667, C3: 0.1667, C4: 0.1667, C5: 0.1667, C6: 0.1667 };

    if (activeBwmConfig && activeBwmConfig.best_to_others && activeBwmConfig.worst_to_others) {
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

    const rawMatrix: any[] = [];
    for (const cand of allowedCandidates) {
      const evalRes = await this.evaluateCandidateSellingLocation(cand.id, options);
      rawMatrix.push({
        id: cand.id,
        name: cand.name,
        scores: evalRes.scores,
      });
    }

    const topsisRes = topsisEngineService.calculateTopsisForMatrix(rawMatrix, criteriaSpecs);

    const count = rawMatrix.length;
    const matrixAvg = {
      C1: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C1, 0) / count : 0,
      C2: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C2, 0) / count : 0,
      C3: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C3, 0) / count : 0,
      C4: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C4, 0) / count : 0,
      C5: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C5, 0) / count : 0,
      C6: count > 0 ? rawMatrix.reduce((s, r) => s + r.scores.C6, 0) / count : 0,
    };

    const explanations = topsisRes.rankings.map((rankItem: any) => {
      const candObj = allowedCandidates.find((c: any) => c.id === rankItem.id) || { id: rankItem.id, name: rankItem.name, validation_status: "ALLOWED" };
      const rawObj = rawMatrix.find((r: any) => r.id === rankItem.id) || { scores: {} };
      return candidateExplainabilityService.generateCandidateExplanation(candObj, rawObj.scores, rankItem, matrixAvg);
    });

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
        executed_at: snapshotRecord.history.created_at || (snapshotRecord.history as any).execution_date,
        method: "TOPSIS",
        criteria_codes: ["C1", "C2", "C3", "C4", "C5", "C6"],
        weights,
      },
    };
  }

  /**
   * Fetch Evaluation Snapshot & Audit Metadata by ID (Read-Only)
   */
  public async getEvaluationSnapshotById(evaluationId: number | string): Promise<any> {
    const history = await topsisRepository.findHistoryById(evaluationId);

    if (!history) {
      const error: any = new Error(`Evaluation snapshot with ID '${evaluationId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const details = typeof history.details === "string" ? JSON.parse(history.details) : history.details || {};

    return {
      evaluation_id: history.id,
      executed_at: history.created_at || (history as any).execution_date,
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
        executed_at: history.created_at || (history as any).execution_date,
        method: "TOPSIS",
        consistency_ratio: history.consistency_ratio,
      },
    };
  }
}

export const candidateSellingLocationService = new CandidateSellingLocationService();
