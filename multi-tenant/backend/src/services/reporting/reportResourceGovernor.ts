/*
 * reportResourceGovernor.ts
 * S7-05-07: Resource Governor & Concurrency Guard for Operational Reports
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Max 2 active export jobs per tenant (QUEUED or PROCESSING).
 * 2. Max 90-day time range.
 * 3. Max 100,000 data rows.
 * 4. Artifact TTL of exactly 24 hours.
 * 5. Deterministic artifact storage path resolution: storage/reports/{tenantId}/{jobId}.{ext}.
 */

import path from "path";
import { ReportFormat, REPORT_GOVERNANCE } from "../../types/reporting.types.js";
import { ReportDomainError } from "../../lib/reporting/reportingStateMachine.js";
import { reportJobRepository } from "../../repositories/reportJobRepository.js";

export class MaxConcurrentExportJobsExceededError extends ReportDomainError {
  constructor(tenantId: string, activeCount: number) {
    super(
      `Tenant '${tenantId}' has reached the maximum allowed concurrent export jobs (${activeCount}/${REPORT_GOVERNANCE.MAX_CONCURRENT_JOBS_PER_TENANT}). Please wait for ongoing jobs to finish.`,
      "MAX_CONCURRENT_EXPORT_JOBS_EXCEEDED",
      429
    );
  }
}

export class ReportResourceGovernor {
  public static readonly STORAGE_ROOT = path.resolve(process.cwd(), "storage/reports");

  /**
   * Enforces tenant concurrency limit before enqueuing a new export job
   */
  public async checkTenantConcurrency(tenantId: string): Promise<void> {
    const activeCount = await reportJobRepository.countActiveJobs(tenantId);
    if (activeCount >= REPORT_GOVERNANCE.MAX_CONCURRENT_JOBS_PER_TENANT) {
      throw new MaxConcurrentExportJobsExceededError(tenantId, activeCount);
    }
  }

  /**
   * Resolves physical storage path for an artifact with strict tenant isolation
   */
  public resolveArtifactPath(tenantId: string, jobId: string, format: ReportFormat): string {
    const ext = format.toLowerCase();
    // Path: storage/reports/{tenantId}/{jobId}.{format}
    return path.join(ReportResourceGovernor.STORAGE_ROOT, tenantId, `${jobId}.${ext}`);
  }

  /**
   * Calculates artifact expiration timestamp (24 hours TTL)
   */
  public calculateArtifactExpiration(hours = REPORT_GOVERNANCE.ARTIFACT_TTL_HOURS): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }
}

export const reportResourceGovernor = new ReportResourceGovernor();
