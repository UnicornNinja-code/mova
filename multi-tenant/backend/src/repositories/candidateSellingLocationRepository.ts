/*
 * candidateSellingLocationRepository.ts
 * Data Access Layer for candidate_selling_locations table & PostGIS Spatial Queries in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool, PoolClient } from "pg";

export class CandidateSellingLocationRepository {
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    this.pool = dbPool;
  }

  /**
   * Insert new Candidate Selling Location
   */
  public async createCandidate(
    candidateData: {
      zone_id: number | string;
      poi_id?: number | string | null;
      name: string;
      latitude: number;
      longitude: number;
      source?: string;
      validation_status?: string;
      rejection_reason?: string | null;
    },
    client: PoolClient | null = null
  ): Promise<any> {
    const db = client || this.pool;
    const {
      zone_id,
      poi_id = null,
      name,
      latitude,
      longitude,
      source = "MANUAL",
      validation_status = "ALLOWED",
      rejection_reason = null,
    } = candidateData;

    const query = `
      INSERT INTO candidate_selling_locations (
        zone_id, poi_id, name, latitude, longitude, geom, source, validation_status, rejection_reason
      )
      VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($5, $4), 4326),
        $6, $7, $8
      )
      RETURNING *;
    `;

    const values = [
      zone_id,
      poi_id,
      name,
      latitude,
      longitude,
      source,
      validation_status,
      rejection_reason,
    ];

    const { rows } = await db.query(query, values);
    return rows[0];
  }

  /**
   * Find candidate location by ID
   */
  public async findById(id: number | string): Promise<any | null> {
    const query = `SELECT * FROM candidate_selling_locations WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Fetch candidates by Zone ID
   */
  public async findByZoneId(zoneId: number | string): Promise<any[]> {
    const query = `
      SELECT csl.*, p.name as poi_name, p.category as poi_category
      FROM candidate_selling_locations csl
      LEFT JOIN pois p ON csl.poi_id = p.id
      WHERE csl.zone_id = $1
      ORDER BY csl.created_at DESC;
    `;
    const { rows } = await this.pool.query(query, [zoneId]);
    return rows;
  }

  /**
   * Check for nearby duplicate candidate within threshold meters using PostGIS GIST index
   */
  public async findNearbyDuplicateCandidate(
    latitude: number,
    longitude: number,
    thresholdMeters: number = 5,
    zoneId: number | string | null = null
  ): Promise<any | null> {
    let query = `
      SELECT *
      FROM candidate_selling_locations
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
    `;
    const values: any[] = [latitude, longitude, thresholdMeters];

    if (zoneId) {
      query += ` AND zone_id = $4`;
      values.push(zoneId);
    }

    query += ` LIMIT 1;`;

    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  /**
   * Update candidate validation status & rejection reason
   */
  public async updateCandidateStatus(
    id: number | string,
    validation_status: string,
    rejection_reason: string | null = null
  ): Promise<any | null> {
    const query = `
      UPDATE candidate_selling_locations
      SET validation_status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [validation_status, rejection_reason, id]);
    return rows[0] || null;
  }

  /**
   * Fetch all valid (ALLOWED) candidates within a zone polygon for DSS calculation
   */
  public async findAllowedCandidatesInZone(zoneId: number | string): Promise<any[]> {
    const query = `
      SELECT csl.*, 
             COALESCE(p.score_pagi, 0) as score_pagi,
             COALESCE(p.score_siang, 0) as score_siang,
             COALESCE(p.score_sore, 0) as score_sore,
             COALESCE(p.score_malam, 0) as score_malam,
             p.category as poi_category
      FROM candidate_selling_locations csl
      LEFT JOIN pois p ON csl.poi_id = p.id
      WHERE csl.zone_id = $1 AND csl.validation_status = 'ALLOWED'
      ORDER BY csl.id ASC;
    `;
    const { rows } = await this.pool.query(query, [zoneId]);
    return rows;
  }

  /**
   * Delete candidates generated from POI sync to refresh recommendations
   */
  public async deleteAutomatedCandidatesByZone(zoneId: number | string, client: PoolClient | null = null): Promise<void> {
    const db = client || this.pool;
    const query = `
      DELETE FROM candidate_selling_locations 
      WHERE zone_id = $1 AND source = 'AUTOMATED_POI';
    `;
    await db.query(query, [zoneId]);
  }
}

export const candidateSellingLocationRepository = new CandidateSellingLocationRepository();
