/*
 * POIDistanceService.js
 * Singleton Service for Criteria C5 (Distance Cost Score) from Hub or Live Rider Location to Zone Boundary.
 */

import { SystemSettingModel } from "../../models/systemSettingModel.js";
import { zoneRepository } from "../../repositories/zoneRepository.js";
import { pool } from "../../config/database.js";

const DEFAULT_HUB_LATITUDE = -7.397402184098715;
const DEFAULT_HUB_LONGITUDE = 112.71195887495875;
const METERS_TO_KM_DIVISOR = 1000;

export class POIDistanceService {
  static instance = null;

  constructor(repo = zoneRepository, dbPool = pool) {
    if (POIDistanceService.instance && repo === zoneRepository) {
      return POIDistanceService.instance;
    }
    this.repo = repo;
    this.pool = dbPool;
    if (repo === zoneRepository) {
      POIDistanceService.instance = this;
    }
  }

  static getInstance(repo = zoneRepository, dbPool = pool) {
    if (!POIDistanceService.instance) {
      POIDistanceService.instance = new POIDistanceService(repo, dbPool);
    }
    return POIDistanceService.instance;
  }

  /**
   * Helper to get default Hub coordinates from System Settings
   */
  async getHubCoordinates() {
    const latSetting = await SystemSettingModel.getByKey("HUB_LATITUDE");
    const lonSetting = await SystemSettingModel.getByKey("HUB_LONGITUDE");

    const latitude = parseFloat(latSetting?.setting_value || latSetting?.value || String(DEFAULT_HUB_LATITUDE));
    const longitude = parseFloat(lonSetting?.setting_value || lonSetting?.value || String(DEFAULT_HUB_LONGITUDE));

    return {
      latitude: isNaN(latitude) ? DEFAULT_HUB_LATITUDE : latitude,
      longitude: isNaN(longitude) ? DEFAULT_HUB_LONGITUDE : longitude,
    };
  }

  /**
   * Calculate C5 Cost Score (Geodesic Distance in KM to Zone Centroid)
   * @param {string} zoneId 
   * @param {number|string} customLat - Optional dynamic rider latitude
   * @param {number|string} customLon - Optional dynamic rider longitude
   */
  async calculateZoneC5Score(zoneId, customLat = null, customLon = null) {
    let originLat = parseFloat(customLat);
    let originLon = parseFloat(customLon);
    let originType = "RIDER_LIVE_LOCATION";
    let calculationMode = "OPERATIONAL";
    let dataQuality = "VALID";

    if (isNaN(originLat) || isNaN(originLon)) {
      const hub = await this.getHubCoordinates();
      originLat = hub.latitude;
      originLon = hub.longitude;
      originType = "DEFAULT_HUB";
      calculationMode = "BASELINE";
      dataQuality = "BASELINE";
    }

    const result = await this.repo.getDistanceToZoneCentroid(zoneId, originLat, originLon);

    return {
      zone_id: result.zone_id,
      zone_name: result.zone_name,
      skor_c5: result.distance_km,
      distance_meters: result.distance_meters,
      distance_km: result.distance_km,
      calculation_mode: calculationMode,
      data_quality: dataQuality,
      source: originType,
      centroid: {
        latitude: result.centroid_lat,
        longitude: result.centroid_lon,
      },
      origin: {
        type: originType,
        source: originType,
        latitude: originLat,
        longitude: originLon,
      },
    };
  }

  /**
   * Calculate C5 Cost Score for a Candidate Selling Location Point (Distance in KM from Origin)
   */
  async calculateCandidateC5Score(candidateLat, candidateLon, customLat = null, customLon = null) {
    let originLat = parseFloat(customLat);
    let originLon = parseFloat(customLon);
    let originType = "RIDER_LIVE_LOCATION";
    let calculationMode = "OPERATIONAL";
    let dataQuality = "VALID";

    if (isNaN(originLat) || isNaN(originLon)) {
      const hub = await this.getHubCoordinates();
      originLat = hub.latitude;
      originLon = hub.longitude;
      originType = "DEFAULT_HUB";
      calculationMode = "BASELINE";
      dataQuality = "BASELINE";
    }

    const query = `
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
      ) AS distance_meters;
    `;
    const { rows } = await this.pool.query(query, [candidateLat, candidateLon, originLat, originLon]);

    const distanceMeters = parseFloat(rows[0]?.distance_meters || 0);
    const distanceKm = Math.round((distanceMeters / METERS_TO_KM_DIVISOR) * 100) / 100;

    return {
      skor_c5: distanceKm,
      distance_meters: distanceMeters,
      distance_km: distanceKm,
      calculation_mode: calculationMode,
      data_quality: dataQuality,
      source: originType,
      origin: {
        type: originType,
        source: originType,
        latitude: originLat,
        longitude: originLon,
      },
    };
  }
}

export const poiDistanceService = POIDistanceService.getInstance();

