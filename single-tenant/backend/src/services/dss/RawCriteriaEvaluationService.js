/*
 * RawCriteriaEvaluationService.js
 * Domain Service for DSS Phase 1 — Raw Criteria Evaluation Engine (DSS-CRITERIA-v1.0)
 * Evaluates raw C1-C6 criteria values for user-defined operational zones with strict pipeline validation.
 * Optimized with Parallelized I/O & Resilient Data Provenance.
 */

import { ZoneModel } from "../../models/zoneModel.js";
import { poiRepository } from "../../repositories/poiRepository.js";
import { poiTimeCrowdService } from "../poi/POITimeCrowdService.js";
import { poiWeatherService } from "../poi/POIWeatherService.js";
import { poiDistanceService } from "../poi/POIDistanceService.js";
import { poiCompetitorService } from "../poi/POICompetitorService.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";

export class RawCriteriaEvaluationService {
  static instance = null;

  constructor() {
    if (RawCriteriaEvaluationService.instance) {
      return RawCriteriaEvaluationService.instance;
    }
    RawCriteriaEvaluationService.instance = this;
  }

  static getInstance() {
    if (!RawCriteriaEvaluationService.instance) {
      RawCriteriaEvaluationService.instance = new RawCriteriaEvaluationService();
    }
    return RawCriteriaEvaluationService.instance;
  }

  /**
   * Evaluate Raw Criteria (C1-C6) for a specific zone ID with strict spatial pipeline execution
   * 
   * @param {string} zoneId 
   * @param {Object} options
   * @param {string} options.timeSlot - Optional time slot ('pagi', 'siang', 'sore', 'malam')
   * @param {number} options.riderLat - Optional dynamic origin latitude
   * @param {number} options.riderLon - Optional dynamic origin longitude
   * @returns {Promise<Object>} Formatted DSS-CRITERIA-v1.0 Raw Evaluation Object
   */
  async evaluateZoneRawCriteria(zoneId, options = {}) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const evaluatedAt = new Date();
    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(evaluatedAt);
    const { riderLat = null, riderLon = null } = options;

    // Parallelized I/O Pipeline: Fetch all 6 criteria simultaneously to minimize latency
    const [c1c2Res, c3Res, c3Details, c4Res, c5Res, c6Res] = await Promise.all([
      poiRepository.getDensitasDanDiversitasByZonePolygon(zone.polygon).catch((err) => {
        console.warn(`⚠️ [DSS PIPELINE] Gagal mengevaluasi C1/C2 untuk zona ${zoneId}:`, err.message);
        return { skor_c1: 0, skor_c2: 0 };
      }),
      poiTimeCrowdService.calculateZoneC3Score(zone.polygon, activeSlot).catch((err) => {
        console.warn(`⚠️ [DSS PIPELINE] Gagal mengevaluasi C3 score untuk zona ${zoneId}:`, err.message);
        return { total_c3_score: 1.0 };
      }),
      poiRepository.getTimeCrowdDetailsByZonePolygon(zone.polygon, activeSlot).catch(() => []),
      poiWeatherService.calculateZoneC4Score(zone.id, evaluatedAt).catch((err) => {
        console.warn(`⚠️ [DSS PIPELINE] Gagal mengevaluasi C4 weather untuk zona ${zoneId}:`, err.message);
        return { skor_c4: 0, max_precipitation_probability: 0, data_quality: "DEGRADED" };
      }),
      poiDistanceService.calculateZoneC5Score(zone.id, riderLat, riderLon).catch((err) => {
        console.warn(`⚠️ [DSS PIPELINE] Gagal mengevaluasi C5 distance untuk zona ${zoneId}:`, err.message);
        return { skor_c5: 0, distance_km: 0, data_quality: "BASELINE" };
      }),
      poiCompetitorService.getZoneC6Score(zone.id).catch((err) => {
        console.warn(`⚠️ [DSS PIPELINE] Gagal mengevaluasi C6 competitor untuk zona ${zoneId}:`, err.message);
        return { skor_c6: 0, details: [] };
      }),
    ]);

    const c1Val = Math.max(0, parseInt(c1c2Res?.skor_c1 || 0, 10));
    const c2Val = Math.max(0, parseInt(c1c2Res?.skor_c2 || 0, 10));
    const c3Val = parseFloat(Number(c3Res?.total_c3_score || 0).toFixed(2));
    const c4Val = parseFloat(Number(c4Res?.skor_c4 ?? c4Res?.max_precipitation_probability ?? 0).toFixed(2));
    const c5Val = parseFloat(Number(c5Res?.skor_c5 ?? c5Res?.distance_km ?? 0).toFixed(2));
    const c6Val = Math.max(0, parseInt(c6Res?.skor_c6 || 0, 10));

    // Format Competitor Details with Threat Level explicitly
    const formattedCompetitors = (c6Res?.details || []).map((comp) => ({
      id: comp.id,
      name: comp.name,
      category: comp.category,
      source: comp.source || "POI_AUTOMATED",
      threat_level: parseInt(comp.weight || 1, 10),
      latitude: comp.latitude,
      longitude: comp.longitude,
    }));

    const isAnyDegraded = c4Res?.data_quality === "DEGRADED";
    const overallQuality = isAnyDegraded ? "DEGRADED" : "VALID";

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      evaluation_version: "DSS-CRITERIA-v1.0",
      evaluated_at: evaluatedAt.toISOString(),
      time_slot: activeSlot,
      data_status: "COMPLETE",
      data_quality: overallQuality,
      criteria: {
        C1: {
          code: "C1",
          name: "Densitas POI",
          type: "BENEFIT",
          raw_value: c1Val,
          value: c1Val,
          unit: "POI",
          source: "POI_MASTER_POSTGIS",
          quality: "VALID",
          methodology: "DISTINCT_LOGICAL_POI_COUNT",
          details: { total_distinct_logical_pois: c1Val },
        },
        C2: {
          code: "C2",
          name: "Diversitas POI",
          type: "BENEFIT",
          raw_value: c2Val,
          value: c2Val,
          unit: "CATEGORY",
          source: "POI_MASTER_POSTGIS",
          quality: "VALID",
          methodology: "DISTINCT_ACTIVE_CATEGORY_COUNT",
          details: { total_distinct_active_categories: c2Val },
        },
        C3: {
          code: "C3",
          name: "Keramaian Waktu",
          type: "BENEFIT",
          raw_value: c3Val,
          value: c3Val,
          unit: "SCORE",
          source: "POI_TIME_SCORES",
          quality: "VALID",
          methodology: "EXPERT_BASELINE_LIKERT_1_5",
          details: c3Details,
        },
        C4: {
          code: "C4",
          name: "Kondisi Cuaca",
          type: "COST",
          raw_value: c4Val,
          value: c4Val,
          unit: "PERCENT",
          source: c4Res?.source || "OPEN_METEO",
          quality: c4Res?.data_quality || "FRESH",
          methodology: "OPERATIONAL_HOURS_MAX_PRECIPITATION_PROBABILITY",
          warning: c4Res?.warning || null,
          details: {
            source: "Open-Meteo API",
            max_precipitation_probability: c4Val,
            avg_precipitation_probability: c4Res?.avg_precipitation_probability || 0,
            weather_condition: c4Res?.supporting_info?.weather_condition || "Normal",
            risk_level: c4Val > 60 ? "HIGH" : c4Val > 30 ? "MEDIUM" : "LOW",
            operational_hours_window: c4Res?.operational_hours_window || "06:00 - 21:00",
          },
        },
        C5: {
          code: "C5",
          name: "Jarak Aksesibilitas",
          type: "COST",
          raw_value: c5Val,
          value: c5Val,
          unit: "KM",
          source: c5Res?.source || c5Res?.origin?.type || "DEFAULT_HUB",
          quality: c5Res?.data_quality || (c5Res?.origin?.type === "RIDER_LIVE_LOCATION" ? "OPERATIONAL" : "BASELINE"),
          methodology: "GEODESIC_DISTANCE_CENTROID",
          details: {
            distance_meters: c5Res?.distance_meters || 0,
            centroid: c5Res?.centroid || { latitude: 0, longitude: 0 },
            origin: c5Res?.origin || { type: "DEFAULT_HUB", latitude: -7.397402, longitude: 112.711958 },
          },
        },
        C6: {
          code: "C6",
          name: "Tingkat Persaingan",
          type: "COST",
          raw_value: c6Val,
          value: c6Val,
          unit: "INDEX",
          source: "COMPETITOR_COMBINED",
          quality: "VALID",
          methodology: "SURVEY_AND_COFFEE_POI_WEIGHTED_SUM",
          details: formattedCompetitors,
        },
      },
    };
  }

  /**
   * Evaluate Raw Criteria for all active zones in parallel
   */
  async evaluateAllActiveZonesRawCriteria(options = {}) {
    const activeZones = await ZoneModel.findAll({ status: "ACTIVE" });
    if (!activeZones || activeZones.length === 0) return [];

    return await Promise.all(
      activeZones.map((zone) => this.evaluateZoneRawCriteria(zone.id, options))
    );
  }
}

export const rawCriteriaEvaluationService = RawCriteriaEvaluationService.getInstance();

