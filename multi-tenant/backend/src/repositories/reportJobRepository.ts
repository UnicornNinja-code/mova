/*
 * reportJobRepository.ts
 * S7-05-02: Export Job Persistence Layer with Multi-Tenant Isolation
 * MOVA Architecture
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";
import {
  ReportExportJob,
  ReportJobStatus,
  ReportJobEvent,
  ReportType,
  ReportFormat,
  REPORT_GOVERNANCE,
} from "../types/reporting.types.js";
import {
  transitionReportJob,
  normalizeProgress,
} from "../lib/reporting/reportingStateMachine.js";

export interface CreateReportJobParams {
  tenantId: string;
  reportType: ReportType;
  format: ReportFormat;
  rangeStart: string;
  rangeEnd: string;
  timezone?: string;
  zoneId?: string | null;
  riderId?: string | null;
  createdBy?: string | null;
}

export interface ListReportJobsParams {
  limit?: number;
  offset?: number;
  status?: ReportJobStatus;
  reportType?: ReportType;
}

export interface MarkCompletedParams {
  rowCount: number;
  rowLimit?: number;
  truncated: boolean;
  artifactPath: string;
  artifactExpiresAt: string;
}

export class ReportJobRepository {
  private static instance: ReportJobRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (ReportJobRepository.instance && dbPool === pool) {
      return ReportJobRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ReportJobRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): ReportJobRepository {
    if (!ReportJobRepository.instance) {
      ReportJobRepository.instance = new ReportJobRepository(dbPool);
    }
    return ReportJobRepository.instance;
  }

  /**
   * Helper to map database row (snake_case) to ReportExportJob domain entity (camelCase)
   */
  private mapRowToJob(row: any): ReportExportJob {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      reportType: row.report_type as ReportType,
      format: row.format as ReportFormat,
      status: row.status as ReportJobStatus,
      rangeStart: new Date(row.range_start).toISOString(),
      rangeEnd: new Date(row.range_end).toISOString(),
      timezone: row.timezone,
      progress: Number(row.progress) || 0,
      rowCount: row.row_count !== null ? Number(row.row_count) : null,
      rowLimit: Number(row.row_limit) || REPORT_GOVERNANCE.MAX_ROW_LIMIT,
      truncated: Boolean(row.truncated),
      artifactPath: row.artifact_path || null,
      artifactExpiresAt: row.artifact_expires_at ? new Date(row.artifact_expires_at).toISOString() : null,
      errorCode: row.error_code || null,
      errorMessage: row.error_message || null,
      zoneId: row.zone_id || null,
      riderId: row.rider_id || null,
      createdBy: row.created_by || null,
      createdAt: new Date(row.created_at).toISOString(),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
    };
  }

  /**
   * Insert a new export job into report_export_jobs in QUEUED status
   */
  public async createJob(params: CreateReportJobParams): Promise<ReportExportJob> {
    const tz = params.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;
    const query = `
      INSERT INTO report_export_jobs (
        tenant_id,
        report_type,
        format,
        status,
        range_start,
        range_end,
        timezone,
        progress,
        row_limit,
        truncated,
        zone_id,
        rider_id,
        created_by
      )
      VALUES ($1, $2, $3, 'QUEUED', $4, $5, $6, 0, $7, FALSE, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      params.tenantId,
      params.reportType,
      params.format,
      params.rangeStart,
      params.rangeEnd,
      tz,
      REPORT_GOVERNANCE.MAX_ROW_LIMIT,
      params.zoneId || null,
      params.riderId || null,
      params.createdBy || null,
    ];

    const { rows } = await this.pool.query(query, values);
    return this.mapRowToJob(rows[0]);
  }

  /**
   * Count active export jobs for a tenant (QUEUED or PROCESSING)
   * Used for Resource Governor concurrency enforcement (Max 2 concurrent per tenant)
   */
  public async countActiveJobs(tenantId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS active_count
      FROM report_export_jobs
      WHERE tenant_id = $1
        AND status IN ('QUEUED', 'PROCESSING');
    `;
    const { rows } = await this.pool.query(query, [tenantId]);
    return rows[0]?.active_count || 0;
  }

  /**
   * Find a specific report export job by ID, strictly bounded by tenant_id
   */
  public async findById(id: string, tenantId: string): Promise<ReportExportJob | null> {
    const query = `
      SELECT *
      FROM report_export_jobs
      WHERE id = $1 AND tenant_id = $2;
    `;
    const { rows } = await this.pool.query(query, [id, tenantId]);
    if (rows.length === 0) return null;
    return this.mapRowToJob(rows[0]);
  }

  /**
   * List report export jobs for a tenant with pagination and optional filters
   */
  public async listJobs(
    tenantId: string,
    params: ListReportJobsParams = {}
  ): Promise<{ jobs: ReportExportJob[]; total: number }> {
    const limit = Math.min(params.limit || 20, 100);
    const offset = params.offset || 0;

    let whereClause = "WHERE tenant_id = $1";
    const values: any[] = [tenantId];

    if (params.status) {
      values.push(params.status);
      whereClause += ` AND status = $${values.length}`;
    }

    if (params.reportType) {
      values.push(params.reportType);
      whereClause += ` AND report_type = $${values.length}`;
    }

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM report_export_jobs
      ${whereClause};
    `;
    const countResult = await this.pool.query(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    const dataQuery = `
      SELECT *
      FROM report_export_jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `;
    values.push(limit, offset);

    const { rows } = await this.pool.query(dataQuery, values);
    const jobs = rows.map((r) => this.mapRowToJob(r));

    return { jobs, total };
  }

  /**
   * Atomically mark a job as PROCESSING when the worker picks it up
   * Validates canonical state machine transition QUEUED -> PROCESSING
   */
  public async markProcessing(id: string, tenantId: string): Promise<ReportExportJob | null> {
    const current = await this.findById(id, tenantId);
    if (!current) return null;

    const nextStatus = transitionReportJob(current.status, ReportJobEvent.WORKER_STARTED);
    const progress = normalizeProgress(nextStatus, 1);

    const query = `
      UPDATE report_export_jobs
      SET status = $1,
          progress = $2,
          started_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND tenant_id = $4
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [nextStatus, progress, id, tenantId]);
    return rows[0] ? this.mapRowToJob(rows[0]) : null;
  }

  /**
   * Update progress for a PROCESSING job (1..99)
   */
  public async updateProgress(
    id: string,
    tenantId: string,
    progress: number
  ): Promise<ReportExportJob | null> {
    const normalized = Math.min(99, Math.max(1, Math.floor(progress)));
    const query = `
      UPDATE report_export_jobs
      SET progress = $1
      WHERE id = $2 AND tenant_id = $3 AND status = 'PROCESSING'
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [normalized, id, tenantId]);
    return rows[0] ? this.mapRowToJob(rows[0]) : null;
  }

  /**
   * Mark a job as COMPLETED upon successful artifact generation
   * Validates canonical state machine transition PROCESSING -> COMPLETED
   */
  public async markCompleted(
    id: string,
    tenantId: string,
    metadata: MarkCompletedParams
  ): Promise<ReportExportJob | null> {
    const current = await this.findById(id, tenantId);
    if (!current) return null;

    const nextStatus = transitionReportJob(current.status, ReportJobEvent.EXPORT_SUCCEEDED);

    const query = `
      UPDATE report_export_jobs
      SET status = $1,
          progress = 100,
          row_count = $2,
          row_limit = $3,
          truncated = $4,
          artifact_path = $5,
          artifact_expires_at = $6,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND tenant_id = $8
      RETURNING *;
    `;

    const values = [
      nextStatus,
      metadata.rowCount,
      metadata.rowLimit || REPORT_GOVERNANCE.MAX_ROW_LIMIT,
      metadata.truncated,
      metadata.artifactPath,
      metadata.artifactExpiresAt,
      id,
      tenantId,
    ];

    const { rows } = await this.pool.query(query, values);
    return rows[0] ? this.mapRowToJob(rows[0]) : null;
  }

  /**
   * Mark a job as FAILED upon unrecoverable error
   * Validates canonical state machine transition PROCESSING -> FAILED
   */
  public async markFailed(
    id: string,
    tenantId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<ReportExportJob | null> {
    const current = await this.findById(id, tenantId);
    if (!current) return null;

    const nextStatus = transitionReportJob(current.status, ReportJobEvent.EXPORT_FAILED);

    const query = `
      UPDATE report_export_jobs
      SET status = $1,
          error_code = $2,
          error_message = $3,
          failed_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
      RETURNING *;
    `;

    const { rows } = await this.pool.query(query, [nextStatus, errorCode, errorMessage, id, tenantId]);
    return rows[0] ? this.mapRowToJob(rows[0]) : null;
  }

  /**
   * Find all expired completed export jobs whose artifact files should be purged
   */
  public async findExpiredArtifacts(cutoffTime: Date = new Date()): Promise<ReportExportJob[]> {
    const query = `
      SELECT *
      FROM report_export_jobs
      WHERE status = 'COMPLETED'
        AND artifact_path IS NOT NULL
        AND artifact_expires_at <= $1
      ORDER BY artifact_expires_at ASC
      LIMIT 100;
    `;
    const { rows } = await this.pool.query(query, [cutoffTime.toISOString()]);
    return rows.map((r) => this.mapRowToJob(r));
  }

  /**
   * Clear artifact path after physical file cleanup has succeeded
   */
  public async clearArtifactPath(id: string): Promise<void> {
    const query = `
      UPDATE report_export_jobs
      SET artifact_path = NULL
      WHERE id = $1;
    `;
    await this.pool.query(query, [id]);
  }
}

export const reportJobRepository = ReportJobRepository.getInstance();
