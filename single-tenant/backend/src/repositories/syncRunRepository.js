/*
 * syncRunRepository.js
 * Data Access Layer for data_sync_runs Table (Provenance & Execution Audit)
 */

import { pool } from "../config/database.js";

export class SyncRunRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (SyncRunRepository.instance && dbPool === pool) {
      return SyncRunRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      SyncRunRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!SyncRunRepository.instance) {
      SyncRunRepository.instance = new SyncRunRepository(dbPool);
    }
    return SyncRunRepository.instance;
  }

  /**
   * Start a new sync run entry
   */
  async startRun({ data_type, source, metadata = {} }) {
    const query = `
      INSERT INTO data_sync_runs (
        data_type, status, source, metadata, started_at
      ) VALUES (
        $1, 'RUNNING', $2, $3, CURRENT_TIMESTAMP
      ) RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [data_type, source, JSON.stringify(metadata)]);
    return rows[0];
  }

  /**
   * Complete a sync run with success metrics
   */
  async completeRun(runId, { records_fetched = 0, records_processed = 0, records_rejected = 0, metadata = {} }) {
    const query = `
      UPDATE data_sync_runs
      SET 
        status = 'SUCCESS',
        records_fetched = $2,
        records_processed = $3,
        records_rejected = $4,
        metadata = metadata || $5::jsonb,
        finished_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      runId,
      records_fetched,
      records_processed,
      records_rejected,
      JSON.stringify(metadata),
    ]);
    return rows[0];
  }

  /**
   * Mark a sync run as failed with error message
   */
  async failRun(runId, errorMessage, metadata = {}) {
    const query = `
      UPDATE data_sync_runs
      SET 
        status = 'FAILED',
        error_message = $2,
        metadata = metadata || $3::jsonb,
        finished_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [runId, String(errorMessage), JSON.stringify(metadata)]);
    return rows[0];
  }

  /**
   * Fetch latest sync status per data type
   */
  async getLatestStatusSummary() {
    const query = `
      SELECT DISTINCT ON (data_type)
        id, data_type, status, source, records_fetched, records_processed,
        records_rejected, started_at, finished_at, error_message, metadata
      FROM data_sync_runs
      ORDER BY data_type, started_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Fetch recent sync run logs
   */
  async getRecentRuns(limit = 20) {
    const query = `
      SELECT * FROM data_sync_runs
      ORDER BY started_at DESC
      LIMIT $1;
    `;
    const { rows } = await this.pool.query(query, [limit]);
    return rows;
  }
}

export const syncRunRepository = SyncRunRepository.getInstance();
