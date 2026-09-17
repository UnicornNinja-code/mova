/*
 * datasetSyncJobRepository.ts
 * Data Access Layer for dataset_sync_jobs audit and monitoring table in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export interface SyncJobRecord {
  id: string;
  job_id: string;
  dataset_type: string;
  triggered_by?: string | null;
  status:
    | "PENDING"
    | "FETCHING"
    | "VALIDATING"
    | "PROCESSING"
    | "LOADING"
    | "PROMOTING"
    | "COMPLETED"
    | "FAILED"
    | "CONCURRENCY_CONFLICT"
    | "LOCK_LOST";
  progress: number;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  duplicates_count: number;
  invalid_geometries_count: number;
  target_version?: number | null;
  previous_version?: number | null;
  duration_ms?: number | null;
  error_details?: any;
  started_at: Date | string;
  completed_at?: Date | string | null;
  created_at: Date | string;
}

export class DatasetSyncJobRepository {
  private static instance: DatasetSyncJobRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    this.pool = dbPool;
  }

  public static getInstance(dbPool: Pool = pool): DatasetSyncJobRepository {
    if (!DatasetSyncJobRepository.instance) {
      DatasetSyncJobRepository.instance = new DatasetSyncJobRepository(dbPool);
    }
    return DatasetSyncJobRepository.instance;
  }

  /**
   * Create an initial job audit entry
   */
  public async createJob(data: {
    job_id: string;
    dataset_type: string;
    triggered_by?: string | null;
    target_version?: number | null;
    previous_version?: number | null;
  }): Promise<SyncJobRecord> {
    const query = `
      INSERT INTO dataset_sync_jobs (
        job_id, dataset_type, triggered_by, target_version, previous_version, status, progress
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING', 0)
      ON CONFLICT (job_id) DO UPDATE SET
        status = 'PENDING',
        progress = 0,
        error_details = NULL,
        started_at = NOW(),
        completed_at = NULL,
        target_version = EXCLUDED.target_version,
        triggered_by = EXCLUDED.triggered_by
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      data.job_id,
      data.dataset_type,
      data.triggered_by || null,
      data.target_version || null,
      data.previous_version || null,
    ]);
    return rows[0];
  }

  /**
   * Update job status, progress, and metrics
   */
  public async updateJob(
    job_id: string,
    updates: Partial<SyncJobRecord>
  ): Promise<SyncJobRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === "id" || key === "job_id" || key === "created_at") continue;
      if (key === "error_details" && typeof value === "object") {
        fields.push(`error_details = $${idx++}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return null;

    const query = `
      UPDATE dataset_sync_jobs
      SET ${fields.join(", ")}
      WHERE job_id = $${idx}
      RETURNING *;
    `;
    values.push(job_id);

    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  /**
   * Find job by BullMQ job_id
   */
  public async findByJobId(job_id: string): Promise<SyncJobRecord | null> {
    const query = `SELECT * FROM dataset_sync_jobs WHERE job_id = $1;`;
    const { rows } = await this.pool.query(query, [job_id]);
    return rows[0] || null;
  }

  /**
   * Find recent sync jobs
   */
  public async findRecentJobs(limit: number = 30): Promise<SyncJobRecord[]> {
    const query = `
      SELECT * FROM dataset_sync_jobs
      ORDER BY created_at DESC
      LIMIT $1;
    `;
    const { rows } = await this.pool.query(query, [limit]);
    return rows;
  }
}

export const datasetSyncJobRepository = DatasetSyncJobRepository.getInstance();
