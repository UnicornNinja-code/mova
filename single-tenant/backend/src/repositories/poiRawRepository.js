/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   POIRawRepository (Data Access Layer for pois_raw Staging Table)
 */

import { pool } from "../config/database.js";

export class POIRawRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (POIRawRepository.instance && dbPool === pool) {
      return POIRawRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      POIRawRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!POIRawRepository.instance) {
      POIRawRepository.instance = new POIRawRepository(dbPool);
    }
    return POIRawRepository.instance;
  }

  /**
   * UPSERT raw Overpass API response JSON into pois_raw staging table
   */
  async saveRawData(cityName, overpassData) {
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
  async findRawDataByCity(cityName) {
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
