/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   TopsisRepository.js (Data Access Layer for dss_histories and recommendations Tables)
 */

import { pool } from "../config/database.js";

export class TopsisRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (TopsisRepository.instance && dbPool === pool) {
      return TopsisRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      TopsisRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!TopsisRepository.instance) {
      TopsisRepository.instance = new TopsisRepository(dbPool);
    }
    return TopsisRepository.instance;
  }

  /**
   * Save TOPSIS Execution History and Recommended Zone Rankings
   */
  async saveExecutionHistory({
    rider_id = null,
    consistency_ratio = null,
    status = "COMPLETED",
    details = {},
    rankings = [],
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insert into dss_histories
      const historyQuery = `
        INSERT INTO dss_histories (consistency_ratio, status, details)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const historyValues = [consistency_ratio, status, JSON.stringify(details)];
      const { rows: historyRows } = await client.query(historyQuery, historyValues);
      const history = historyRows[0];

      // 2. Insert into recommendations if rider_id is provided
      const insertedRecs = [];
      if (rider_id && Array.isArray(rankings) && rankings.length > 0) {
        for (const rankItem of rankings) {
          const recQuery = `
            INSERT INTO recommendations (rider_id, zone_id, score, rank, date, dss_history_id)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
            RETURNING *;
          `;
          const recValues = [
            rider_id,
            rankItem.zone_id,
            rankItem.preference_score,
            rankItem.rank,
            history.id,
          ];
          const { rows: recRows } = await client.query(recQuery, recValues);
          insertedRecs.push(recRows[0]);
        }
      }

      await client.query("COMMIT");
      return { history, recommendations: insertedRecs };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch DSS History record by ID
   */
  async findHistoryById(id) {
    const query = `SELECT * FROM dss_histories WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Fetch recent DSS History records
   */
  async findHistories(limit = 20) {
    const query = `SELECT * FROM dss_histories ORDER BY created_at DESC LIMIT $1;`;
    const { rows } = await this.pool.query(query, [limit]);
    return rows;
  }

  /**
   * Fetch all operational zones with active status
   */
  async findAllActiveZones() {
    const query = `
      SELECT id, name, description, max_capacity, status, polygon
      FROM zones
      WHERE status = 'ACTIVE'
      ORDER BY name ASC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }
}

export const topsisRepository = TopsisRepository.getInstance();
