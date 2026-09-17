/*
 * artifactSecurityService.ts
 * S7-05-08: Artifact Security, Path Containment & 24-Hour Purge Engine
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Authenticated Context Authorization: Strict tenant boundary enforcement.
 * 2. Path Traversal Guard: Strict canonical storage root containment.
 * 3. 24-Hour Expiration Check: Rejects expired artifacts (HTTP 410 / DENY).
 * 4. Zero-Data-Loss Purge: Only clears physical file & artifact_path, preserves job audit history.
 * 5. Deterministic Sanitized Download Filenames.
 */

import fs from "fs";
import path from "path";
import {
  ReportExportJob,
  ReportFormat,
  ReportJobStatus,
  ReportType,
} from "../../types/reporting.types.js";
import { reportJobRepository } from "../../repositories/reportJobRepository.js";
import { reportResourceGovernor, ReportResourceGovernor } from "./reportResourceGovernor.js";

export class ArtifactSecurityError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "ArtifactSecurityError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface AuthorizedArtifact {
  job: ReportExportJob;
  filePath: string;
  mimeType: string;
  downloadFilename: string;
  fileSizeBytes: number;
}

export class ArtifactSecurityService {
  /**
   * Resolves standard MIME type for supported export formats
   */
  public getMimeType(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV:
        return "text/csv; charset=utf-8";
      case ReportFormat.XLSX:
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case ReportFormat.PDF:
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Generates a safe, sanitized, deterministic download filename
   */
  public generateDownloadFilename(reportType: ReportType, jobId: string, format: ReportFormat): string {
    const sanitizedType = reportType.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const sanitizedJobId = jobId.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const ext = format.toLowerCase();
    return `${sanitizedType}-${sanitizedJobId}.${ext}`;
  }

  /**
   * Validates that target filePath is strictly contained within the tenant's storage subfolder
   * Defends against directory traversal (e.g. ../../etc/passwd or absolute path injection)
   */
  public isPathContainedInTenantStorage(filePath: string, tenantId: string): boolean {
    if (!filePath || typeof filePath !== "string") return false;

    const normalizedTarget = path.resolve(filePath);
    const expectedTenantDir = path.resolve(ReportResourceGovernor.STORAGE_ROOT, tenantId);

    // Target must start with expectedTenantDir path prefix
    const relative = path.relative(expectedTenantDir, normalizedTarget);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  /**
   * Authorizes a download request:
   * 1. Resolves job by ID strictly within authenticated tenant context.
   * 2. Checks status is COMPLETED.
   * 3. Checks artifact has not expired (artifact_expires_at > NOW).
   * 4. Verifies physical file exists and is strictly contained in tenant storage.
   */
  public async authorizeDownload(jobId: string, tenantId: string): Promise<AuthorizedArtifact> {
    const job = await reportJobRepository.findById(jobId, tenantId);
    if (!job) {
      throw new ArtifactSecurityError(
        `Report export job '${jobId}' not found for tenant '${tenantId}'.`,
        "REPORT_JOB_NOT_FOUND",
        404
      );
    }

    // Status Check
    if (job.status !== ReportJobStatus.COMPLETED) {
      throw new ArtifactSecurityError(
        `Cannot download report artifact: job status is '${job.status}'.`,
        "REPORT_NOT_READY",
        409
      );
    }

    // Path existence in metadata
    if (!job.artifactPath) {
      throw new ArtifactSecurityError(
        "Report artifact path is missing or was already purged.",
        "ARTIFACT_UNAVAILABLE",
        410
      );
    }

    // Expiration Check (24-hour TTL)
    if (job.artifactExpiresAt) {
      const expiresAt = new Date(job.artifactExpiresAt);
      if (expiresAt.getTime() <= Date.now()) {
        throw new ArtifactSecurityError(
          `Report artifact expired at ${job.artifactExpiresAt} and is no longer available.`,
          "ARTIFACT_EXPIRED",
          410
        );
      }
    }

    // Filesystem Containment Check
    if (!this.isPathContainedInTenantStorage(job.artifactPath, tenantId)) {
      throw new ArtifactSecurityError(
        "Access denied: artifact path violates tenant storage boundary.",
        "PATH_TRAVERSAL_DETECTED",
        403
      );
    }

    // Physical File Existence Check
    if (!fs.existsSync(job.artifactPath)) {
      throw new ArtifactSecurityError(
        "Report artifact file is physically missing from disk storage.",
        "ARTIFACT_FILE_MISSING",
        404
      );
    }

    const stats = fs.statSync(job.artifactPath);
    const mimeType = this.getMimeType(job.format);
    const downloadFilename = this.generateDownloadFilename(job.reportType, job.id, job.format);

    return {
      job,
      filePath: job.artifactPath,
      mimeType,
      downloadFilename,
      fileSizeBytes: stats.size,
    };
  }

  /**
   * Idempotent 24-hour Purge Service:
   * Finds expired completed jobs, deletes physical files, clears artifact_path in database.
   * Preserves database job records for historical audit integrity.
   */
  public async purgeExpiredArtifacts(cutoffDate: Date = new Date()): Promise<{
    purgedCount: number;
    failedCount: number;
  }> {
    const expiredJobs = await reportJobRepository.findExpiredArtifacts(cutoffDate);
    let purgedCount = 0;
    let failedCount = 0;

    for (const job of expiredJobs) {
      if (!job.artifactPath) continue;

      try {
        // Verify containment before physical deletion
        if (this.isPathContainedInTenantStorage(job.artifactPath, job.tenantId)) {
          if (fs.existsSync(job.artifactPath)) {
            fs.unlinkSync(job.artifactPath);
          }
        }

        // Clear artifact path in DB (idempotent)
        await reportJobRepository.clearArtifactPath(job.id);
        purgedCount++;
      } catch (err) {
        failedCount++;
        console.error(`[PURGE] Failed to purge artifact for job '${job.id}':`, err);
      }
    }

    return { purgedCount, failedCount };
  }
}

export const artifactSecurityService = new ArtifactSecurityService();
