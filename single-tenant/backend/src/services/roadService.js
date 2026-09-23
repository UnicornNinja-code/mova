import fs from "fs";
import path from "path";
import { pool } from "../config/database.js";
import { roadRepository } from "../repositories/roadRepository.js";
import { roadOverpassSyncService } from "./roadOverpassSyncService.js";

const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: "FeatureCollection", features: [] });

export class RoadService {
  static instance = null;

  static getInstance() {
    if (!RoadService.instance) {
      RoadService.instance = new RoadService();
    }
    return RoadService.instance;
  }

  /**
   * Retrieves Protocol Roads GeoJSON.
   * When merge = true (default), unifies contiguous road segments by road name
   * using PostGIS ST_LineMerge while preserving unnamed segments.
   */
  async getProtocolRoadsGeoJson({ merge = true } = {}) {
    if (!merge) {
      const rawQuery = `
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
        WHERE restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD';
      `;
      const { rows } = await pool.query(rawQuery);
      return rows[0]?.geojson || EMPTY_FEATURE_COLLECTION;
    }

    const query = `
      WITH named_roads AS (
        SELECT 
          MIN(external_id) AS external_id,
          name,
          highway_type,
          COALESCE(restriction_type, 'PROHIBITED_ROAD') AS restriction_type,
          (ST_Dump(ST_LineMerge(ST_Collect(geom)))).geom AS geom
        FROM protocol_roads
        WHERE (restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD')
          AND name IS NOT NULL 
          AND TRIM(name) <> '' 
          AND name !~* '^Way #\\d+'
        GROUP BY name, highway_type, COALESCE(restriction_type, 'PROHIBITED_ROAD')
      ),
      unnamed_roads AS (
        SELECT 
          external_id,
          COALESCE(NULLIF(TRIM(name), ''), 'Ruas Jalan Tanpa Nama') AS name,
          highway_type,
          COALESCE(restriction_type, 'PROHIBITED_ROAD') AS restriction_type,
          geom
        FROM protocol_roads
        WHERE (restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD')
          AND (name IS NULL OR TRIM(name) = '' OR name ~* '^Way #\\d+')
      ),
      all_roads AS (
        SELECT * FROM named_roads
        UNION ALL
        SELECT * FROM unnamed_roads
      )
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
                'restriction_type', restriction_type
              ),
              'geometry', ST_AsGeoJSON(geom)::json
            )
          ), '[]'::json)
        ) AS geojson
      FROM all_roads;
    `;

    const { rows } = await pool.query(query);
    return rows[0]?.geojson || EMPTY_FEATURE_COLLECTION;
  }

  /**
   * Retrieves Toll Roads GeoJSON.
   * When merge = true (default), unifies contiguous road segments by road name
   * using PostGIS ST_LineMerge while preserving unnamed segments.
   */
  async getTollRoadsGeoJson({ merge = true } = {}) {
    if (!merge) {
      const rawQuery = `
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
        WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
      `;
      const { rows } = await pool.query(rawQuery);
      return rows[0]?.geojson || EMPTY_FEATURE_COLLECTION;
    }

    const query = `
      WITH named_toll AS (
        SELECT 
          MIN(external_id) AS external_id,
          name,
          highway_type,
          restriction_type,
          (ST_Dump(ST_LineMerge(ST_Collect(geom)))).geom AS geom
        FROM protocol_roads
        WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
          AND name IS NOT NULL 
          AND TRIM(name) <> '' 
          AND name !~* '^Way #\\d+'
        GROUP BY name, highway_type, restriction_type
      ),
      unnamed_toll AS (
        SELECT 
          external_id,
          COALESCE(NULLIF(TRIM(name), ''), 'Ruas Jalan Tol') AS name,
          highway_type,
          restriction_type,
          geom
        FROM protocol_roads
        WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
          AND (name IS NULL OR TRIM(name) = '' OR name ~* '^Way #\\d+')
      ),
      all_toll AS (
        SELECT * FROM named_toll
        UNION ALL
        SELECT * FROM unnamed_toll
      )
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
                'restriction_type', restriction_type
              ),
              'geometry', ST_AsGeoJSON(geom)::json
            )
          ), '[]'::json)
        ) AS geojson
      FROM all_toll;
    `;

    const { rows } = await pool.query(query);
    return rows[0]?.geojson || EMPTY_FEATURE_COLLECTION;
  }
}

export const roadService = RoadService.getInstance();

export async function syncProtocolRoadsService(options = {}) {
  return await roadOverpassSyncService.syncProtocolRoadsFromOverpass(options);
}

export async function syncTollRoadsService(options = {}) {
  return await roadOverpassSyncService.syncTollRoadsFromOverpass(options);
}
