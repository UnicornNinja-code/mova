import fs from "fs";
import path from "path";
import { pool } from "../config/database.js";
import { roadRepository } from "../repositories/roadRepository.js";
import { roadOverpassSyncService } from "./roadOverpassSyncService.js";

const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: "FeatureCollection", features: [] });
const DEFAULT_GEOJSON_REL_PATH = "public/geojson/jalan_protokol.geojson";

export class RoadService {
  static instance = null;

  static getInstance() {
    if (!RoadService.instance) {
      RoadService.instance = new RoadService();
    }
    return RoadService.instance;
  }

  async getProtocolRoadsGeoJson() {
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
      WHERE restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD';
    `;

    const { rows } = await pool.query(query);
    return rows[0]?.geojson || EMPTY_FEATURE_COLLECTION;
  }

  async getTollRoadsGeoJson() {
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
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
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

