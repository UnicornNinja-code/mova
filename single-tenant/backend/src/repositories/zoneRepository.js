/*
 * zoneRepository.js
 * Data Access Layer for Zone PostGIS Spatial Operations & Distance Calculations.
 */

import { pool } from "../config/database.js";
import { ZoneModel } from "../models/zoneModel.js";

export class ZoneRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (ZoneRepository.instance && dbPool === pool) {
      return ZoneRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ZoneRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!ZoneRepository.instance) {
      ZoneRepository.instance = new ZoneRepository(dbPool);
    }
    return ZoneRepository.instance;
  }

  /**
   * Find Zone by ID via ZoneModel
   */
  async findById(id) {
    return await ZoneModel.findById(id);
  }

  /**
   * Helper to format zone.polygon to valid GeoJSON string
   */
  formatPolygonToGeoJSON(polygon) {
    if (!polygon) return null;
    let parsed = polygon;
    if (typeof polygon === "string") {
      try {
        parsed = JSON.parse(polygon);
      } catch (e) {
        return null;
      }
    }
    if (parsed.type === "Polygon") return JSON.stringify(parsed);
    if (parsed.type === "Feature" && parsed.geometry) return JSON.stringify(parsed.geometry);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      const coordinates = parsed.map((pt) => {
        if (Array.isArray(pt)) {
          const isLonFirst = Math.abs(pt[0]) > Math.abs(pt[1]);
          return [parseFloat(isLonFirst ? pt[0] : pt[1]), parseFloat(isLonFirst ? pt[1] : pt[0])];
        }
        return [parseFloat(pt.lon || pt.lng || 0), parseFloat(pt.lat || 0)];
      });
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([first[0], first[1]]);
      }
      return JSON.stringify({ type: "Polygon", coordinates: [coordinates] });
    }
    return null;
  }

  /**
   * Calculate geodesic distance from an origin (lat, lon) to the CENTROID of a zone polygon
   * @param {string} zoneId 
   * @param {number} originLat 
   * @param {number} originLon 
   * @returns {Promise<{zone_id: string, zone_name: string, distance_meters: number, distance_km: number, centroid_lat: number, centroid_lon: number}>}
   */
  async getDistanceToZoneCentroid(zoneId, originLat, originLon) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const geoJsonStr = this.formatPolygonToGeoJSON(zone.polygon);
    if (!geoJsonStr) {
      return {
        zone_id: zone.id,
        zone_name: zone.name,
        distance_meters: 0,
        distance_km: 0,
        centroid_lat: null,
        centroid_lon: null,
      };
    }

    const query = `
      WITH zone_geom AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) AS geom
      ),
      zone_centroid AS (
        SELECT ST_Centroid(geom) AS centroid FROM zone_geom
      )
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        ST_Y(zc.centroid) AS centroid_lat,
        ST_X(zc.centroid) AS centroid_lon,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          zc.centroid::geography
        ) AS distance_meters,
        (ST_Distance(
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          zc.centroid::geography
        ) / 1000.0) AS distance_km
      FROM zones z, zone_centroid zc
      WHERE z.id = $1;
    `;

    const { rows } = await this.pool.query(query, [
      zoneId,
      parseFloat(originLon),
      parseFloat(originLat),
      geoJsonStr,
    ]);

    const res = rows[0] || {};
    const meters = Math.round((parseFloat(res.distance_meters) || 0) * 100) / 100;
    const km = Math.round((parseFloat(res.distance_km) || 0) * 100) / 100;

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      distance_meters: meters,
      distance_km: km,
      centroid_lat: parseFloat(res.centroid_lat || 0),
      centroid_lon: parseFloat(res.centroid_lon || 0),
    };
  }

  /**
   * Legacy alias for boundary distance
   */
  async getDistanceToZoneBoundary(zoneId, originLat, originLon) {
    return this.getDistanceToZoneCentroid(zoneId, originLat, originLon);
  }
}

export const zoneRepository = ZoneRepository.getInstance();
