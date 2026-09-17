/*
 * zoneRepository.ts
 * Data Access Layer for Zone PostGIS Spatial Operations & Distance Calculations in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";
import { ZoneModel } from "../models/zoneModel.js";

export class ZoneRepository {
  private static instance: ZoneRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (ZoneRepository.instance && dbPool === pool) {
      return ZoneRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ZoneRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): ZoneRepository {
    if (!ZoneRepository.instance) {
      ZoneRepository.instance = new ZoneRepository(dbPool);
    }
    return ZoneRepository.instance;
  }

  /**
   * Find Zone by ID via ZoneModel
   */
  public async findById(id: number | string): Promise<any | null> {
    return await ZoneModel.findById(id);
  }

  /**
   * Helper to format zone.polygon to valid GeoJSON string
   */
  public formatPolygonToGeoJSON(polygon: any): string | null {
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
      const coordinates = parsed.map((pt: any) => {
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
   */
  public async getDistanceToZoneCentroid(
    zoneId: number | string,
    originLat: number | string,
    originLon: number | string
  ): Promise<{
    zone_id: number | string;
    zone_name: string;
    distance_meters: number;
    distance_km: number;
    centroid_lat: number | null;
    centroid_lon: number | null;
  }> {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error: any = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
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
      parseFloat(String(originLon)),
      parseFloat(String(originLat)),
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
  public async getDistanceToZoneBoundary(
    zoneId: number | string,
    originLat: number | string,
    originLon: number | string
  ) {
    return this.getDistanceToZoneCentroid(zoneId, originLat, originLon);
  }
}

export const zoneRepository = ZoneRepository.getInstance();
