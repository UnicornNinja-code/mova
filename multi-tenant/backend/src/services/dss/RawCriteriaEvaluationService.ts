/*
 * RawCriteriaEvaluationService.ts
 * Domain Service for DSS Phase 1 — Raw Criteria Evaluation Engine (DSS-CRITERIA-v1.0) in TypeScript
 * Standarisasi Kriteria: C1-C3 BENEFIT, C4-C6 COST
 */

import { ZoneModel } from "../../models/zoneModel.js";
import { poiRepository } from "../../repositories/poiRepository.js";
import { poiTimeCrowdService } from "../poi/POITimeCrowdService.js";
import { poiWeatherService } from "../poi/POIWeatherService.js";
import { poiDistanceService } from "../poi/POIDistanceService.js";
import { competitorRelevanceService } from "../competitor/CompetitorRelevanceService.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";

export class RawCriteriaEvaluationService {
  private static instance: RawCriteriaEvaluationService | null = null;

  public static getInstance(): RawCriteriaEvaluationService {
    if (!RawCriteriaEvaluationService.instance) {
      RawCriteriaEvaluationService.instance = new RawCriteriaEvaluationService();
    }
    return RawCriteriaEvaluationService.instance;
  }

  /**
   * Evaluate Raw Criteria (C1-C6) for a specific zone ID
   */
  public async evaluateZoneRawCriteria(
    zoneId: number | string,
    options: {
      tenantId?: string;
      timeSlot?: string;
      riderLat?: number | string | null;
      riderLon?: number | string | null;
    } = {}
  ): Promise<any> {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error: any = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const tenantId = options.tenantId || (zone as any).tenant_id || "thesis-default";
    const evaluatedAt = new Date();
    const activeSlot = options.timeSlot || TimeSlotEvaluator.getSlot(evaluatedAt);
    const { riderLat = null, riderLon = null } = options;

    // 1. Fetch C1 & C2 (Density & Diversity) - BENEFIT
    const c1c2Res = await poiRepository.getDensitasDanDiversitasByZonePolygon(zone.polygon);
    const c1Val = parseInt(String(c1c2Res?.skor_c1 || 0), 10);
    const c2Val = parseInt(String(c1c2Res?.skor_c2 || 0), 10);

    // 2. Fetch C3 (Time Crowd Score + Detailed Breakdown) - BENEFIT
    const c3Res = await poiTimeCrowdService.calculateZoneC3Score(zone.polygon, activeSlot);
    const c3Details = await poiRepository.getTimeCrowdDetailsByZonePolygon(zone.polygon, activeSlot);
    const c3Val = parseFloat((c3Res?.total_c3_score || 0).toFixed(2));

    // 3. Fetch C4 (Weather Risk Cost) - COST
    const c4Res = await poiWeatherService.calculateZoneC4Score(zone.id, evaluatedAt);
    const c4Val = parseFloat((c4Res?.skor_c4 ?? c4Res?.max_precipitation_probability ?? 0).toFixed(2));

    // 4. Fetch C5 (Distance Cost to Zone Centroid) - COST
    const c5Res = await poiDistanceService.calculateZoneC5Score(zone.id, riderLat, riderLon);
    const c5Val = parseFloat((c5Res?.skor_c5 ?? c5Res?.distance_km ?? 0).toFixed(2));
    const centroid = c5Res?.centroid || { latitude: -7.4478, longitude: 112.7183 };

    // 5. Fetch C6 (Relevant Competitor Impact Score) - COST
    const c6Res = await competitorRelevanceService.evaluateC6ForCoordinate(
      tenantId,
      centroid.latitude,
      centroid.longitude,
      evaluatedAt.toTimeString().split(" ")[0]
    );
    const c6Val = c6Res.value;

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      evaluation_version: "DSS-CRITERIA-v1.0",
      evaluated_at: evaluatedAt.toISOString(),
      time_slot: activeSlot,
      criteria: {
        C1: {
          code: "C1",
          name: "Densitas POI",
          type: "BENEFIT",
          raw_value: c1Val,
          unit: "POI",
          details: { total_distinct_logical_pois: c1Val },
        },
        C2: {
          code: "C2",
          name: "Diversitas POI",
          type: "BENEFIT",
          raw_value: c2Val,
          unit: "CATEGORY",
          details: { total_distinct_active_categories: c2Val },
        },
        C3: {
          code: "C3",
          name: "Potensi Keramaian Waktu",
          type: "BENEFIT",
          raw_value: c3Val,
          unit: "SCORE",
          details: c3Details,
        },
        C4: {
          code: "C4",
          name: "Risiko Cuaca",
          type: "COST",
          raw_value: c4Val,
          unit: "PERCENT",
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
          name: "Jarak Aksesibilitas Rider",
          type: "COST",
          raw_value: c5Val,
          unit: "KM",
          details: {
            distance_meters: c5Res?.distance_meters || 0,
            centroid: centroid,
            origin: c5Res?.origin || { type: "HUB_DEFAULT_LOCATION", latitude: 0, longitude: 0 },
          },
        },
        C6: {
          code: "C6",
          name: "Dampak Kompetitor Relevan",
          type: "COST",
          raw_value: c6Val,
          unit: "INDEX",
          details: {
            total_candidates: c6Res.total_candidates_analyzed,
            relevant_competitors: c6Res.relevant_competitors_count,
            contributors: c6Res.contributors,
          },
        },
      },
    };
  }

  /**
   * Evaluate Raw Criteria for all active zones
   */
  public async evaluateAllActiveZonesRawCriteria(options: any = {}): Promise<any[]> {
    const activeZones = await ZoneModel.findAll({ status: "ACTIVE" });
    const results = [];
    for (const zone of activeZones) {
      const rawEval = await this.evaluateZoneRawCriteria(zone.id, options);
      results.push(rawEval);
    }
    return results;
  }
}

export const rawCriteriaEvaluationService = RawCriteriaEvaluationService.getInstance();
