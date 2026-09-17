/*
 * POIDistanceService.ts
 * Singleton Service for Criteria C5 (Distance Cost Score) in TypeScript.
 */

import { SystemSettingModel } from "../../models/systemSettingModel.js";
import { zoneRepository, ZoneRepository } from "../../repositories/zoneRepository.js";
import { pool } from "../../config/database.js";

import { operationalContextService } from "../spatial/OperationalContextService.js";

export class POIDistanceService {
  private static instance: POIDistanceService | null = null;
  private repo: ZoneRepository;

  constructor(repo: ZoneRepository = zoneRepository) {
    if (POIDistanceService.instance) {
      return POIDistanceService.instance;
    }
    this.repo = repo;
    POIDistanceService.instance = this;
  }

  public static getInstance(): POIDistanceService {
    if (!POIDistanceService.instance) {
      POIDistanceService.instance = new POIDistanceService();
    }
    return POIDistanceService.instance;
  }

  /**
   * Helper to get default Hub coordinates from Operational Context
   */
  public async getHubCoordinates(): Promise<{ latitude: number; longitude: number }> {
    const context = await operationalContextService.getOperationalContext();
    return { latitude: context.latitude, longitude: context.longitude };
  }

  /**
   * Calculate C5 Cost Score (Geodesic Distance in KM to Zone Centroid)
   */
  public async calculateZoneC5Score(
    zoneId: number | string,
    customLat: number | string | null = null,
    customLon: number | string | null = null
  ): Promise<any> {
    let originLat = parseFloat(String(customLat));
    let originLon = parseFloat(String(customLon));
    let originType = "RIDER_LIVE_LOCATION";

    if (isNaN(originLat) || isNaN(originLon)) {
      const hub = await this.getHubCoordinates();
      originLat = hub.latitude;
      originLon = hub.longitude;
      originType = "HUB_DEFAULT_LOCATION";
    }

    const result = await this.repo.getDistanceToZoneCentroid(zoneId, originLat, originLon);

    return {
      zone_id: result.zone_id,
      zone_name: result.zone_name,
      skor_c5: result.distance_km,
      distance_meters: result.distance_meters,
      distance_km: result.distance_km,
      centroid: {
        latitude: result.centroid_lat,
        longitude: result.centroid_lon,
      },
      origin: {
        type: originType,
        latitude: originLat,
        longitude: originLon,
      },
    };
  }

  /**
   * Calculate C5 Cost Score for a Candidate Selling Location Point (Distance in KM from Origin)
   */
  public async calculateCandidateC5Score(
    candidateLat: number,
    candidateLon: number,
    customLat: number | string | null = null,
    customLon: number | string | null = null
  ): Promise<any> {
    let originLat = parseFloat(String(customLat));
    let originLon = parseFloat(String(customLon));
    let originType = "RIDER_LIVE_LOCATION";

    if (isNaN(originLat) || isNaN(originLon)) {
      const hub = await this.getHubCoordinates();
      originLat = hub.latitude;
      originLon = hub.longitude;
      originType = "HUB_DEFAULT_LOCATION";
    }

    const { rows } = await pool.query(
      `SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
      ) AS distance_meters;`,
      [candidateLat, candidateLon, originLat, originLon]
    );

    const distanceMeters = parseFloat(rows[0]?.distance_meters || 0);
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

    return {
      skor_c5: distanceKm,
      distance_meters: distanceMeters,
      distance_km: distanceKm,
      origin: {
        type: originType,
        latitude: originLat,
        longitude: originLon,
      },
    };
  }
}

export const poiDistanceService = POIDistanceService.getInstance();
