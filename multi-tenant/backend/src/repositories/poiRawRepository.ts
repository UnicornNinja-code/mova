/*
 * poiRawRepository.ts
 * Data Access Layer for pois_raw Staging Table in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class POIRawRepository {
  private static instance: POIRawRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (POIRawRepository.instance && dbPool === pool) {
      return POIRawRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      POIRawRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): POIRawRepository {
    if (!POIRawRepository.instance) {
      POIRawRepository.instance = new POIRawRepository(dbPool);
    }
    return POIRawRepository.instance;
  }

  /**
   * UPSERT raw Overpass API response JSON into pois_raw staging table
   */
  public async saveRawData(cityName: string, overpassData: any): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const rawDataStr = JSON.stringify(overpassData);
      await client.query(
        `
        INSERT INTO pois_raw (city_name, raw_data, fetched_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (city_name) 
        DO UPDATE SET raw_data = EXCLUDED.raw_data, fetched_at = CURRENT_TIMESTAMP;
      `,
        [cityName, rawDataStr]
      );
      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve raw Overpass API JSON array from pois_raw staging table by city name
   */
  public async findRawDataByCity(cityName: string): Promise<any | null> {
    const { rows } = await this.pool.query(
      "SELECT raw_data FROM pois_raw WHERE city_name = $1",
      [cityName]
    );
    if (rows.length === 0) {
      return null;
    }
    return rows[0].raw_data;
  }
}

export const poiRawRepository = POIRawRepository.getInstance();
export { POIRawRepository as PoiRawRepository };
