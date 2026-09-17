/*
 * roadRepository.ts
 * Data Access Layer for protocol_roads Spatial Table in TypeScript
 */

import format from "pg-format";
import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class RoadRepository {
  private static instance: RoadRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (RoadRepository.instance && dbPool === pool) {
      return RoadRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      RoadRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): RoadRepository {
    if (!RoadRepository.instance) {
      RoadRepository.instance = new RoadRepository(dbPool);
    }
    return RoadRepository.instance;
  }

  public async findAll(): Promise<any[]> {
    const query = `SELECT * FROM protocol_roads ORDER BY created_at DESC;`;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  public async truncate(): Promise<void> {
    const query = `TRUNCATE TABLE protocol_roads;`;
    await this.pool.query(query);
  }

  public async bulkCreate(roadsData: any[] = []): Promise<any[]> {
    if (!Array.isArray(roadsData) || roadsData.length === 0) return [];

    const valuesArray = roadsData.map((r, idx) => [
      r.external_id || r.id || `way/gen-${idx + 1}`,
      r.name || "Jalan Protokol Utama",
      r.highway_type || "secondary",
      r.restriction_type || "PROHIBITED_ROAD",
      JSON.stringify(r.metadata || {}),
      JSON.stringify(r.geometry || r.geom || {}),
    ]);

    const batchSize = 200;
    const allRows: any[] = [];

    for (let i = 0; i < valuesArray.length; i += batchSize) {
      const batch = valuesArray.slice(i, i + batchSize);
      const insertQuery = format(
        `
        INSERT INTO protocol_roads (external_id, name, highway_type, restriction_type, metadata, geom)
        SELECT 
          v.external_id,
          v.name,
          v.highway_type,
          v.restriction_type,
          v.metadata::jsonb,
          ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326)
        FROM (VALUES %L) AS v(external_id, name, highway_type, restriction_type, metadata, geojson)
        ON CONFLICT (external_id) DO UPDATE SET
          name = EXCLUDED.name,
          highway_type = EXCLUDED.highway_type,
          restriction_type = EXCLUDED.restriction_type,
          metadata = EXCLUDED.metadata,
          geom = EXCLUDED.geom,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `,
        batch
      );

      const { rows } = await this.pool.query(insertQuery);
      allRows.push(...rows);
    }

    return allRows;
  }
}

export const roadRepository = RoadRepository.getInstance();
