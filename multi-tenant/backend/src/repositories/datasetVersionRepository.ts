/*
 * datasetVersionRepository.ts
 * Data Access Layer for dataset_versions table in TypeScript (MOVA Spatial Architecture)
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export interface DatasetVersionRecord {
  id: string;
  dataset_type: "POI" | "TOLL_ROADS" | "PROTOCOL_ROADS";
  version: number;
  status: "STAGING" | "VALIDATED" | "ACTIVE" | "RETIRED" | "FAILED";
  source: string;
  feature_count: number;
  checksum?: string | null;
  snapshot_path?: string | null;
  manifest_path?: string | null;
  validation_summary?: any;
  error_message?: string | null;
  fetched_at: Date | string;
  validated_at?: Date | string | null;
  promoted_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class DatasetVersionRepository {
  private static instance: DatasetVersionRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    this.pool = dbPool;
  }

  public static getInstance(dbPool: Pool = pool): DatasetVersionRepository {
    if (!DatasetVersionRepository.instance) {
      DatasetVersionRepository.instance = new DatasetVersionRepository(dbPool);
    }
    return DatasetVersionRepository.instance;
  }

  /**
   * Find the currently ACTIVE version of a dataset
   */
  public async findActiveVersion(datasetType: string): Promise<DatasetVersionRecord | null> {
    const query = `
      SELECT * FROM dataset_versions
      WHERE dataset_type = $1 AND status = 'ACTIVE'
      ORDER BY version DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [datasetType]);
    return rows[0] || null;
  }

  /**
   * Get highest version number for a dataset type
   */
  public async getLatestVersionNumber(datasetType: string): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(version), 0) AS max_v
      FROM dataset_versions
      WHERE dataset_type = $1;
    `;
    const { rows } = await this.pool.query(query, [datasetType]);
    return parseInt(rows[0]?.max_v || "0", 10);
  }

  /**
   * Create a new dataset version record (usually in STAGING status)
   */
  public async createVersion(data: {
    dataset_type: string;
    version: number;
    status?: string;
    source?: string;
    feature_count?: number;
    checksum?: string | null;
    snapshot_path?: string | null;
    manifest_path?: string | null;
    validation_summary?: any;
  }): Promise<DatasetVersionRecord> {
    const query = `
      INSERT INTO dataset_versions (
        dataset_type, version, status, source, feature_count,
        checksum, snapshot_path, manifest_path, validation_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      data.dataset_type,
      data.version,
      data.status || "STAGING",
      data.source || "OVERPASS_API",
      data.feature_count || 0,
      data.checksum || null,
      data.snapshot_path || null,
      data.manifest_path || null,
      JSON.stringify(data.validation_summary || {}),
    ];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  /**
   * Update dataset version details
   */
  public async updateVersion(
    id: string,
    updates: Partial<DatasetVersionRecord>
  ): Promise<DatasetVersionRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === "id" || key === "created_at") continue;
      if (key === "validation_summary" && typeof value === "object") {
        fields.push(`validation_summary = $${idx++}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    const query = `
      UPDATE dataset_versions
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *;
    `;
    values.push(id);

    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  /**
   * Find all versions for a dataset type
   */
  public async findHistory(datasetType: string, limit: number = 20): Promise<DatasetVersionRecord[]> {
    const query = `
      SELECT * FROM dataset_versions
      WHERE dataset_type = $1
      ORDER BY version DESC
      LIMIT $2;
    `;
    const { rows } = await this.pool.query(query, [datasetType, limit]);
    return rows;
  }

  /**
   * Find a specific version by ID
   */
  public async findById(id: string): Promise<DatasetVersionRecord | null> {
    const query = `SELECT * FROM dataset_versions WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }
}

export const datasetVersionRepository = DatasetVersionRepository.getInstance();
