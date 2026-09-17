/*
 * WeatherRepository.ts
 * Data Access Layer for Weather Caching & PostGIS Zone Centroid Calculations in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class WeatherRepository {
  private static instance: WeatherRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (WeatherRepository.instance && dbPool === pool) {
      return WeatherRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      WeatherRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): WeatherRepository {
    if (!WeatherRepository.instance) {
      WeatherRepository.instance = new WeatherRepository(dbPool);
    }
    return WeatherRepository.instance;
  }

  /**
   * Helper to format zone.polygon to GeoJSON string
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
   * Fetch Centroid (latitude, longitude) of all active zones using PostGIS ST_Centroid
   */
  public async getAllZoneCentroids(): Promise<Array<{ zone_id: number | string; name: string; latitude: number; longitude: number }>> {
    const query = `SELECT id, name, polygon FROM zones WHERE status = 'ACTIVE';`;
    const { rows } = await this.pool.query(query);

    const centroids: Array<{ zone_id: number | string; name: string; latitude: number; longitude: number }> = [];
    for (const z of rows) {
      const geoJsonStr = this.formatPolygonToGeoJSON(z.polygon);
      if (!geoJsonStr) continue;

      const centroidQuery = `
        SELECT 
          ST_Y(ST_Centroid(ST_GeomFromGeoJSON($1))) AS latitude,
          ST_X(ST_Centroid(ST_GeomFromGeoJSON($1))) AS longitude;
      `;
      const res = await this.pool.query(centroidQuery, [geoJsonStr]);
      if (res.rows[0]) {
        centroids.push({
          zone_id: z.id,
          name: z.name,
          latitude: parseFloat(res.rows[0].latitude),
          longitude: parseFloat(res.rows[0].longitude),
        });
      }
    }
    return centroids;
  }

  /**
   * Fetch Centroid of a single zone by ID
   */
  public async getZoneCentroid(zoneId: number | string): Promise<{ zone_id: number | string; name: string; latitude: number; longitude: number } | null> {
    const query = `SELECT id, name, polygon FROM zones WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [zoneId]);
    if (!rows[0]) return null;

    const geoJsonStr = this.formatPolygonToGeoJSON(rows[0].polygon);
    if (!geoJsonStr) return null;

    const centroidQuery = `
      SELECT 
        ST_Y(ST_Centroid(ST_GeomFromGeoJSON($1))) AS latitude,
        ST_X(ST_Centroid(ST_GeomFromGeoJSON($1))) AS longitude;
    `;
    const res = await this.pool.query(centroidQuery, [geoJsonStr]);
    if (!res.rows[0]) return null;

    return {
      zone_id: rows[0].id,
      name: rows[0].name,
      latitude: parseFloat(res.rows[0].latitude),
      longitude: parseFloat(res.rows[0].longitude),
    };
  }

  /**
   * Fetch cached weather for a zone if created within ttlMinutes
   */
  public async getCachedWeather(zoneId: number | string, ttlMinutes: number = 60): Promise<any | null> {
    const query = `
      SELECT * FROM weathers 
      WHERE zone_id = $1 
        AND updated_at >= NOW() - ($2 || ' minutes')::interval
      ORDER BY updated_at DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [zoneId, ttlMinutes]);
    return rows[0] || null;
  }

  /**
   * Upsert cached weather payload into weathers table
   */
  public async saveCachedWeather(zoneId: number | string, weatherPayload: any): Promise<any> {
    // Preserve weather history for reporting and analytics; latest weather fetched via ORDER BY updated_at DESC
    const query = `
      INSERT INTO weathers (
        zone_id, timestamp, temperature_2m, relative_humidity_2m, 
        dew_point_2m, apparent_temperature, precipitation_probability, 
        precipitation, rain, weather_code, showers, visibility, updated_at
      ) VALUES (
        $1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP
      ) RETURNING *;
    `;

    const supporting = weatherPayload.supporting_info || {};
    const values = [
      zoneId,
      supporting.temperature || 0,
      supporting.humidity || 0,
      supporting.dew_point || 0,
      supporting.temperature || 0,
      weatherPayload.max_precipitation_probability || 0,
      weatherPayload.precipitation || 0,
      supporting.rain || 0,
      supporting.weather_code || 0,
      0,
      10000,
    ];

    const { rows } = await this.pool.query(query, values);
    
    if (rows[0]) {
      rows[0].hourly_cache = weatherPayload.hourly;
    }
    return rows[0];
  }
}

export const weatherRepository = WeatherRepository.getInstance();
