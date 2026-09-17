/*
 * CompetitorRelevanceService.ts
 * Aggregate Decision Intelligence Service for Criteria C6 (Relevant Competitor Impact)
 * 
 * Menggabungkan Global Spatial Master (OSM POI) dan Tenant Competitor Observations
 * dengan evaluasi Price Overlap, Spatial Decay, Overnight Temporal Window, dan Confidence.
 */

import { pool } from "../../config/database.js";
import { competitorProfileService, CompetitorProfileDTO } from "./CompetitorProfileService.js";
import { competitorObservationService } from "./CompetitorObservationService.js";
import { calculatePriceOverlap, resolveCategoryPricePrior } from "./PriceOverlapEngine.js";
import { calculateCompetitorRelevance } from "./CompetitorRelevanceEngine.js";
import { calculateSpatialDecay, calculateTemporalFactor, calculateCompetitivePressure } from "./SpatialTemporalPressureEngine.js";

export interface CompetitorContributorAudit {
  id: string;
  name: string;
  source: "OSM" | "OBSERVATION";
  category: string;
  business_model: string;
  distance_meters: number;
  price_range: string;
  price_score: number;
  relevance_score: number;
  spatial_decay: number;
  temporal_factor: number;
  confidence: number;
  competitive_pressure: number;
  is_relevant: boolean;
}

export interface C6EvaluationResult {
  criterion: "C6";
  name: "Dampak Kompetitor Relevan";
  type: "COST";
  value: number; // Final C6 score (Σ P_i)
  radius_meters: number;
  total_candidates_analyzed: number;
  relevant_competitors_count: number;
  contributors: CompetitorContributorAudit[];
  evaluation_metadata: {
    tenant_price_range: [number, number];
    target_categories: string[];
    target_time?: string;
    evaluated_at: string;
  };
}

export class CompetitorRelevanceService {
  private static instance: CompetitorRelevanceService | null = null;

  public static getInstance(): CompetitorRelevanceService {
    if (!CompetitorRelevanceService.instance) {
      CompetitorRelevanceService.instance = new CompetitorRelevanceService();
    }
    return CompetitorRelevanceService.instance;
  }

  /**
   * Menghitung nilai kriteria C6 untuk titik lokasi kandidat tertentu
   */
  public async evaluateC6ForCoordinate(
    tenantId: string,
    lat: number,
    lon: number,
    targetTime?: string | null
  ): Promise<C6EvaluationResult> {
    // 1. Ambil profil kompetitor aktif milik tenant
    const profile = await competitorProfileService.getActiveProfile(tenantId);
    const radius = profile.radius_meters || 500;
    const targetCategoriesSet = new Set((profile.target_categories || []).map((c) => c.toUpperCase()));
    const businessModelsSet = new Set((profile.business_models || []).map((m) => m.toUpperCase()));

    const contributors: CompetitorContributorAudit[] = [];

    // 2. Sumber A: Global OSM POIs dalam radius pencarian
    const globalPoisQuery = `
      SELECT 
        id, name, category, latitude, longitude,
        ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
      FROM pois
      WHERE is_global = true
        AND operational_status = 'ELIGIBLE'
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
      ORDER BY distance_meters ASC;
    `;
    const { rows: globalPois } = await pool.query(globalPoisQuery, [lat, lon, radius]);

    for (const poi of globalPois) {
      const catUpper = (poi.category || "").toUpperCase();
      const prior = resolveCategoryPricePrior(catUpper);

      // Jika kategori tidak memiliki prior harga, S_price = 0.0
      let priceScore = 0.0;
      let priceRangeStr = "UNKNOWN";

      if (prior) {
        priceScore = calculatePriceOverlap(
          profile.min_price,
          profile.max_price,
          prior.min,
          prior.max
        );
        priceRangeStr = `Rp${prior.min.toLocaleString()} - Rp${prior.max.toLocaleString()} (Prior)`;
      }

      const categoryMatch = targetCategoriesSet.has(catUpper);
      // OSM POI dianggap model BOOTH / STOREfront default
      const modelMatch = businessModelsSet.has("BOOTH") || businessModelsSet.has("STATIC");

      const relevance = calculateCompetitorRelevance({
        priceScore,
        categoryMatch,
        modelMatch,
      });

      const dist = Math.round(poi.distance_meters);
      const spatialDecay = calculateSpatialDecay(dist, radius);
      // OSM POIs operate within normal daytime window
      const temporalFactor = calculateTemporalFactor("08:00:00", "21:00:00", targetTime);
      const confidence = 0.50; // OSM Category Prior Uncertainty Discount

      const pressure = relevance.isRelevant
        ? calculateCompetitivePressure(relevance.relevanceScore, spatialDecay, temporalFactor, confidence)
        : 0.0;

      contributors.push({
        id: poi.id,
        name: poi.name,
        source: "OSM",
        category: poi.category,
        business_model: "BOOTH",
        distance_meters: dist,
        price_range: priceRangeStr,
        price_score: priceScore,
        relevance_score: relevance.relevanceScore,
        spatial_decay: spatialDecay,
        temporal_factor: temporalFactor,
        confidence,
        competitive_pressure: pressure,
        is_relevant: relevance.isRelevant,
      });
    }

    // 3. Sumber B: Observasi Kompetitor Lapangan (Rider/Supervisor)
    const observations = await competitorObservationService.getActiveObservationsInRadius(
      tenantId,
      lat,
      lon,
      radius
    );

    for (const obs of observations) {
      const catUpper = (obs.category || "").toUpperCase();
      const modelUpper = (obs.business_model || "MOBILE").toUpperCase();

      // Gunakan harga observasi eksplisit jika ada, atau fallback prior jika kosong
      let compMin = obs.min_price;
      let compMax = obs.max_price;
      let priceRangeStr = "UNKNOWN";

      if (compMin != null && compMax != null) {
        priceRangeStr = `Rp${compMin.toLocaleString()} - Rp${compMax.toLocaleString()} (Observed)`;
      } else {
        const prior = resolveCategoryPricePrior(catUpper);
        if (prior) {
          compMin = prior.min;
          compMax = prior.max;
          priceRangeStr = `Rp${prior.min.toLocaleString()} - Rp${prior.max.toLocaleString()} (Prior Fallback)`;
        }
      }

      let priceScore = 0.0;
      if (compMin != null && compMax != null) {
        priceScore = calculatePriceOverlap(
          profile.min_price,
          profile.max_price,
          compMin,
          compMax
        );
      }

      const categoryMatch = targetCategoriesSet.has(catUpper);
      const modelMatch = businessModelsSet.has(modelUpper);

      const relevance = calculateCompetitorRelevance({
        priceScore,
        categoryMatch,
        modelMatch,
      });

      const dist = Math.round(obs.distance_meters);
      const spatialDecay = calculateSpatialDecay(dist, radius);
      const temporalFactor = calculateTemporalFactor(
        obs.activity_start || profile.activity_start,
        obs.activity_end || profile.activity_end,
        targetTime
      );
      const confidence = Number(obs.confidence) || 0.60;

      const pressure = relevance.isRelevant
        ? calculateCompetitivePressure(relevance.relevanceScore, spatialDecay, temporalFactor, confidence)
        : 0.0;

      contributors.push({
        id: obs.id,
        name: obs.name,
        source: "OBSERVATION",
        category: obs.category,
        business_model: obs.business_model,
        distance_meters: dist,
        price_range: priceRangeStr,
        price_score: priceScore,
        relevance_score: relevance.relevanceScore,
        spatial_decay: spatialDecay,
        temporal_factor: temporalFactor,
        confidence,
        competitive_pressure: pressure,
        is_relevant: relevance.isRelevant,
      });
    }

    // 4. Agregasi Skor Total C6 = Σ P_i
    const relevantContributors = contributors.filter((c) => c.is_relevant && c.competitive_pressure > 0);
    const totalC6Score = Number(
      relevantContributors.reduce((sum, c) => sum + c.competitive_pressure, 0).toFixed(4)
    );

    return {
      criterion: "C6",
      name: "Dampak Kompetitor Relevan",
      type: "COST",
      value: totalC6Score,
      radius_meters: radius,
      total_candidates_analyzed: contributors.length,
      relevant_competitors_count: relevantContributors.length,
      contributors,
      evaluation_metadata: {
        tenant_price_range: [profile.min_price, profile.max_price],
        target_categories: profile.target_categories,
        target_time: targetTime || undefined,
        evaluated_at: new Date().toISOString(),
      },
    };
  }
}

export const competitorRelevanceService = CompetitorRelevanceService.getInstance();
