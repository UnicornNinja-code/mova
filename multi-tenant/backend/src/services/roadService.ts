/*
 * roadService.ts
 * Service for fetching PostGIS protocol_roads spatial restriction layer in TypeScript.
 */

import { pool } from "../config/database.js";
import { roadOverpassSyncService } from "./roadOverpassSyncService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { roadRepository } from "../repositories/roadRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves the absolute path to jalan_protokol.geojson across various working directories
 */
export function resolveProtocolGeoJsonPath(): string | null {
  const candidates = [
    path.resolve(__dirname, "../../public/geojson/jalan_protokol.geojson"),
    path.resolve(__dirname, "../../../public/geojson/jalan_protokol.geojson"),
    path.resolve(process.cwd(), "public/geojson/jalan_protokol.geojson"),
    path.resolve(process.cwd(), "bun_svelte/backend/public/geojson/jalan_protokol.geojson"),
    path.resolve(process.cwd(), "backend/public/geojson/jalan_protokol.geojson"),
    "F:/project_zero/bun_svelte/backend/public/geojson/jalan_protokol.geojson",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export class RoadService {
  private static instance: RoadService | null = null;

  public static getInstance(): RoadService {
    if (!RoadService.instance) {
      RoadService.instance = new RoadService();
    }
    return RoadService.instance;
  }

  /**
   * Fetch protocol roads from PostGIS as GeoJSON FeatureCollection
   * Includes auto-heal if table is empty
   */
  public async getProtocolRoadsGeoJson(): Promise<any> {
    const query = `
      SELECT 
        json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'properties', json_build_object(
                'id', external_id,
                'name', name,
                'highway', highway_type,
                'restriction_type', COALESCE(restriction_type, 'PROHIBITED_ROAD')
              ),
              'geometry', ST_AsGeoJSON(geom)::json
            )
          ), '[]'::json)
        ) AS geojson
      FROM protocol_roads
      WHERE (restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD')
        AND (is_active = true OR is_active IS NULL);
    `;

    let { rows } = await pool.query(query);
    let result = rows[0]?.geojson || { type: "FeatureCollection", features: [] };

    // Auto-heal fallback: If PostGIS has 0 road features, auto-seed from GeoJSON immediately
    if (!result.features || result.features.length === 0) {
      console.log("⚠️ [ROAD SERVICE] protocol_roads kosong di PostGIS. Melakukan auto-seed dari GeoJSON...");
      await syncProtocolRoadsService(true);
      const retry = await pool.query(query);
      result = retry.rows[0]?.geojson || result;
    }

    return result;
  }

  /**
   * Fetch toll roads from PostGIS as GeoJSON FeatureCollection
   */
  public async getTollRoadsGeoJson(): Promise<any> {
    const query = `
      SELECT 
        json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'properties', json_build_object(
                'id', external_id,
                'name', name,
                'highway', highway_type,
                'restriction_type', restriction_type,
                'metadata', metadata
              ),
              'geometry', ST_AsGeoJSON(geom)::json
            )
          ), '[]'::json)
        ) AS geojson
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
        AND (is_active = true OR is_active IS NULL);
    `;

    const { rows } = await pool.query(query);
    return rows[0]?.geojson || { type: "FeatureCollection", features: [] };
  }
}

export const roadService = RoadService.getInstance();

export async function syncProtocolRoadsService(force = false): Promise<any> {
  if (!force) {
    const countRes = await pool.query(
      "SELECT COUNT(*)::int AS total FROM protocol_roads WHERE restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD';"
    );
    const existing = countRes.rows[0]?.total || 0;
    if (existing > 0) {
      return {
        success: true,
        totalRoads: existing,
        msg: `Protocol roads already populated (${existing} segments).`,
      };
    }
  }

  const geoJsonPath = resolveProtocolGeoJsonPath();
  if (!geoJsonPath) {
    console.warn("⚠️ [ROAD SERVICE] File 'jalan_protokol.geojson' tidak ditemukan di kandidat lokasi!");
    return {
      success: false,
      totalRoads: 0,
      msg: "File 'jalan_protokol.geojson' tidak ditemukan.",
    };
  }

  try {
    const rawData = fs.readFileSync(geoJsonPath, "utf8");
    const parsed = JSON.parse(rawData);
    const features = parsed.features || [];
    const validFeatures = features
      .filter((f: any) => f.geometry?.type === "LineString" && Array.isArray(f.geometry.coordinates))
      .map((feat: any, idx: number) => ({
        external_id: feat.properties?.id || `way/gen-${idx + 1}`,
        name: feat.properties?.name || "Jalan Protokol Utama",
        highway_type: feat.properties?.highway || "secondary",
        restriction_type: "PROHIBITED_ROAD",
        metadata: feat.properties || {},
        geometry: feat.geometry,
      }));

    if (validFeatures.length > 0) {
      await roadRepository.bulkCreate(validFeatures);
      console.log(`✅ [ROAD SERVICE] ${validFeatures.length} ruas jalan protokol berhasil diimpor ke PostGIS.`);
    }

    return {
      success: true,
      totalRoads: validFeatures.length,
      msg: "Protocol roads spatial layer synchronized successfully.",
    };
  } catch (err: any) {
    console.error("💥 [ROAD SERVICE] Gagal sinkronisasi jalan protokol:", err.message);
    return {
      success: false,
      totalRoads: 0,
      error: err.message,
    };
  }
}

export async function syncTollRoadsService(): Promise<any> {
  return await roadOverpassSyncService.syncTollRoadsFromOverpass();
}
