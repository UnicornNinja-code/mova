/*
 * CandidateSellingLocationRepository.js
 * Data Access Layer for candidate_selling_locations table & PostGIS Spatial Queries
 */

import { pool } from "../config/database.js";

export class CandidateSellingLocationRepository {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Insert new Candidate Selling Location
   */
  async createCandidate(candidateData, client = null) {
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
  async findById(id) {
    const query = `SELECT * FROM candidate_selling_locations WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Fetch candidates by Zone ID
   */
  async findByZoneId(zoneId) {
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
  async findNearbyDuplicateCandidate(latitude, longitude, thresholdMeters = 5, zoneId = null) {
    let query = `
      SELECT *
      FROM candidate_selling_locations
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
    `;
    const values = [latitude, longitude, thresholdMeters];

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
  async updateCandidateStatus(id, validation_status, rejection_reason = null) {
    const query = `
      UPDATE candidate_selling_locations
      SET validation_status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [validation_status, rejection_reason, id]);
    return rows[0] || null;
  }
}

export const candidateSellingLocationRepository = new CandidateSellingLocationRepository();
