/*
 * GlobalSpatialMasterService.ts
 * Shared Spatial Infrastructure Service for Multi-Tenant DSS Platform
 * 
 * Menyediakan antarmuka query spasial terpusat untuk mengakses Master POI Global,
 * jaringan jalan protokol, dan validasi koridor terlarang (Jalan Tol & Protokol)
 * yang direferensikan bersama oleh seluruh tenant tanpa duplicate fetching.
 */

import { pool } from "../../config/database.js";
import { withTenantContext } from "../../lib/tenantContext.js";

export interface GlobalPoiRecord {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  status: string;
  operational_status: string;
  is_global: boolean;
  city_name?: string;
  distance_meters?: number;
}

export interface SpatialSafetyValidationResult {
  isValid: boolean;
  reason?: string;
  code?: string;
  distanceToTollMeters?: number;
  distanceToProtocolMeters?: number;
}

export class GlobalSpatialMasterService {
  private static instance: GlobalSpatialMasterService | null = null;

  public static getInstance(): GlobalSpatialMasterService {
    if (!GlobalSpatialMasterService.instance) {
      GlobalSpatialMasterService.instance = new GlobalSpatialMasterService();
    }
    return GlobalSpatialMasterService.instance;
  }

  /**
   * Mengambil POI Global yang berada di dalam Poligon Zona milik Tenant tertentu.
   * Menggunakan PostGIS `ST_Contains` untuk spatial join tanpa duplikasi baris POI fisik.
   */
  public async getPoisInZone(
    tenantId: string,
    zoneId: string,
    categoryFilter?: string[]
  ): Promise<GlobalPoiRecord[]> {
    return withTenantContext(tenantId, async (client) => {
      // 1. Dapatkan geometri poligon zona tenant
      const zoneRes = await client.query(
        `SELECT id, name, polygon FROM zones WHERE id = $1;`,
        [zoneId]
      );

      if (!zoneRes.rows[0]) {
        throw new Error(`Zona dengan ID '${zoneId}' tidak ditemukan untuk tenant ini.`);
      }

      const zonePolygonJson = zoneRes.rows[0].polygon;
      let coordinates: [number, number][] = [];

      if (zonePolygonJson && Array.isArray(zonePolygonJson.coordinates)) {
        coordinates = zonePolygonJson.coordinates[0];
      } else if (Array.isArray(zonePolygonJson)) {
        coordinates = zonePolygonJson;
      }

      if (coordinates.length < 3) {
        return [];
      }

      // Format WKT Polygon: POLYGON((lon lat, lon lat, ...))
      const wktPoints = coordinates
        .map((coord: any) => `${coord.lng ?? coord[0]} ${coord.lat ?? coord[1]}`)
        .join(", ");
      
      // Tutup poligon jika titik awal dan akhir belum sama
      const firstPoint = `${coordinates[0].lng ?? coordinates[0][0]} ${coordinates[0].lat ?? coordinates[0][1]}`;
      const closedWkt = wktPoints.endsWith(firstPoint) ? wktPoints : `${wktPoints}, ${firstPoint}`;
      const polygonWkt = `POLYGON((${closedWkt}))`;

      // 2. Query POI global yang berada di dalam poligon zona
      let query = `
        SELECT 
          id, name, category, latitude, longitude, 
          status, operational_status, is_global, city_name
        FROM pois
        WHERE is_global = true
          AND operational_status = 'ELIGIBLE'
          AND ST_Contains(
            ST_GeomFromText($1, 4326),
            geom
          )
      `;
      const params: any[] = [polygonWkt];

      if (categoryFilter && categoryFilter.length > 0) {
        query += ` AND category = ANY($2::varchar[])`;
        params.push(categoryFilter);
      }

      query += ` ORDER BY name ASC;`;

      const { rows } = await client.query(query, params);
      return rows;
    });
  }

  /**
   * Mengambil POI Global berdasarkan radius Haversine dari titik koordinat tertentu
   */
  public async getGlobalPoisNearPoint(
    lat: number,
    lon: number,
    radiusMeters: number = 500,
    categoryFilter?: string[]
  ): Promise<GlobalPoiRecord[]> {
    let query = `
      SELECT 
        id, name, category, latitude, longitude, 
        status, operational_status, is_global, city_name,
        ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
      FROM pois
      WHERE is_global = true
        AND operational_status = 'ELIGIBLE'
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
    `;
    const params: any[] = [lat, lon, radiusMeters];

    if (categoryFilter && categoryFilter.length > 0) {
      query += ` AND category = ANY($4::varchar[])`;
      params.push(categoryFilter);
    }

    query += ` ORDER BY distance_meters ASC LIMIT 100;`;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  /**
   * Memvalidasi apakah suatu titik koordinat aman (di luar koridor tol 25m & buffer protokol 10m)
   */
  public async validateCoordinateSafety(
    lat: number,
    lon: number
  ): Promise<SpatialSafetyValidationResult> {
    // 1. Cek koridor Jalan Tol (Buffer 25m ST_DWithin pada restriction_type = 'PROHIBITED_TOLL_ROAD')
    const tollRes = await pool.query(
      `SELECT id, name, 
              ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as dist
       FROM protocol_roads
       WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
         AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 25)
       LIMIT 1;`,
      [lat, lon]
    );

    if (tollRes.rows.length > 0) {
      return {
        isValid: false,
        code: "PROHIBITED_TOLL_ROAD",
        reason: "Lokasi berada di dalam koridor Jalan Tol (buffer 25 meter). Dilarang untuk armada keliling.",
        distanceToTollMeters: Math.round(tollRes.rows[0].dist),
      };
    }

    // 2. Cek Jalan Protokol (Buffer 10m pada restriction_type = 'PROHIBITED_ROAD')
    const protocolRes = await pool.query(
      `SELECT id, name,
              ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as dist
       FROM protocol_roads
       WHERE is_global = true
         AND (restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL)
         AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 10)
       LIMIT 1;`,
      [lat, lon]
    );

    if (protocolRes.rows.length > 0) {
      return {
        isValid: false,
        code: "PROHIBITED_ROAD",
        reason: "Lokasi berjarak < 10 meter dari garis as jalan protokol. Dilarang oleh regulasi PKL setempat.",
        distanceToProtocolMeters: Math.round(protocolRes.rows[0].dist),
      };
    }

    return {
      isValid: true,
    };
  }

  /**
   * Mengambil statistik ringkasan Master Data Spasial Global
   */
  public async getSharedSpatialStatistics(cityName?: string): Promise<any> {
    const poiQuery = cityName
      ? `SELECT count(*)::int as total_pois, count(DISTINCT category)::int as total_categories 
         FROM pois WHERE is_global = true AND (city_name = $1 OR city_name IS NULL);`
      : `SELECT count(*)::int as total_pois, count(DISTINCT category)::int as total_categories 
         FROM pois WHERE is_global = true;`;
    
    const poiParams = cityName ? [cityName] : [];
    const { rows: poiStats } = await pool.query(poiQuery, poiParams);

    const { rows: roadStats } = await pool.query(
      `SELECT count(*)::int as total_protocol_roads FROM protocol_roads WHERE is_global = true;`
    );

    const { rows: snapshotStats } = await pool.query(
      `SELECT version, status, total_pois, created_at, promoted_at 
       FROM spatial_snapshots ORDER BY created_at DESC LIMIT 5;`
    );

    return {
      total_global_pois: poiStats[0]?.total_pois || 0,
      total_categories: poiStats[0]?.total_categories || 0,
      total_protocol_roads: roadStats[0]?.total_protocol_roads || 0,
      recent_snapshots: snapshotStats,
      is_global_shared: true,
    };
  }
}

export const globalSpatialMasterService = GlobalSpatialMasterService.getInstance();
