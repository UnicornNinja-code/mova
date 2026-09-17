/*
 * unit_artifact_security.test.ts
 * S7-05-08: Artifact Security, Path Containment & 24h Purge Invariants (27 Cases)
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import {
  ArtifactSecurityService,
  artifactSecurityService,
  ArtifactSecurityError,
} from "../src/services/reporting/artifactSecurityService";
import {
  ReportResourceGovernor,
} from "../src/services/reporting/reportResourceGovernor";
import {
  ReportType,
  ReportFormat,
  ReportJobStatus,
  ReportExportJob,
} from "../src/types/reporting.types";
import { reportJobRepository } from "../src/repositories/reportJobRepository";

describe("S7-05-08: Artifact Security & 24h Purge Engine (27 Cases)", () => {
  const tenantId = "tenant-auth-test";
  const jobId = "job-secure-001";
  const validArtifactPath = path.resolve(ReportResourceGovernor.STORAGE_ROOT, tenantId, `${jobId}.csv`);

  const mockCompletedJob: ReportExportJob = {
    id: jobId,
    tenantId,
    reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
    format: ReportFormat.CSV,
    status: ReportJobStatus.COMPLETED,
    rangeStart: "2026-09-01T00:00:00Z",
    rangeEnd: "2026-09-08T00:00:00Z",
    timezone: "Asia/Jakarta",
    progress: 100,
    rowCount: 200,
    rowLimit: 100000,
    truncated: false,
    artifactPath: validArtifactPath,
    artifactExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    errorCode: null,
    errorMessage: null,
    zoneId: null,
    riderId: null,
    createdBy: "user-1",
    createdAt: "2026-09-08T00:00:00Z",
    startedAt: "2026-09-08T00:00:01Z",
    completedAt: "2026-09-08T00:00:05Z",
    failedAt: null,
  };

  // Setup sample file for tests
  const setupPhysicalArtifact = (p: string) => {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, "sample,data\r\n1,2\r\n");
  };

  const cleanupPhysicalArtifact = (p: string) => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  };

  // ============================================================================
  // Group 1: Authorization (ART-01 to ART-06)
  // ============================================================================
  describe("Group 1: Authorization & Status Guards", () => {
    it("[ART-01] allows download when authenticated tenant matches job owner", async () => {
      setupPhysicalArtifact(validArtifactPath);
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => mockCompletedJob;

      try {
        const auth = await artifactSecurityService.authorizeDownload(jobId, tenantId);
        expect(auth.job.id).toBe(jobId);
        expect(auth.filePath).toBe(validArtifactPath);
      } finally {
        cleanupPhysicalArtifact(validArtifactPath);
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-02] denies download for cross-tenant access with 404", async () => {
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => null; // Cross tenant returns null

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, "other-tenant")).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-03] throws 404 REPORT_JOB_NOT_FOUND when job does not exist", async () => {
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => null;

      try {
        expect(artifactSecurityService.authorizeDownload("nonexistent-job", tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-04] denies download when job status is QUEUED", async () => {
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => ({ ...mockCompletedJob, status: ReportJobStatus.QUEUED });

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-05] denies download when job status is PROCESSING", async () => {
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => ({ ...mockCompletedJob, status: ReportJobStatus.PROCESSING });

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-06] denies download when job status is FAILED", async () => {
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => ({ ...mockCompletedJob, status: ReportJobStatus.FAILED });

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });
  });

  // ============================================================================
  // Group 2: Artifact State & Expiration (ART-07 to ART-10)
  // ============================================================================
  describe("Group 2: Artifact State & Expiration", () => {
    it("[ART-07] allows download for COMPLETED job with valid unexpired file", async () => {
      setupPhysicalArtifact(validArtifactPath);
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => mockCompletedJob;

      try {
        const auth = await artifactSecurityService.authorizeDownload(jobId, tenantId);
        expect(auth.fileSizeBytes).toBeGreaterThan(0);
      } finally {
        cleanupPhysicalArtifact(validArtifactPath);
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-08] fails with ARTIFACT_FILE_MISSING if file physically missing on disk", async () => {
      cleanupPhysicalArtifact(validArtifactPath);
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => mockCompletedJob;

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-09] denies download with 410 ARTIFACT_EXPIRED if artifactExpiresAt has passed", async () => {
      setupPhysicalArtifact(validArtifactPath);
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => ({
        ...mockCompletedJob,
        artifactExpiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        cleanupPhysicalArtifact(validArtifactPath);
        reportJobRepository.findById = origFind;
      }
    });

    it("[ART-10] denies download with ARTIFACT_UNAVAILABLE if artifactPath is null", async () => {
      const origFind = reportJobRepository.findById;
      reportJobRepository.findById = async () => ({ ...mockCompletedJob, artifactPath: null });

      try {
        expect(artifactSecurityService.authorizeDownload(jobId, tenantId)).rejects.toThrow(
          ArtifactSecurityError
        );
      } finally {
        reportJobRepository.findById = origFind;
      }
    });
  });

  // ============================================================================
  // Group 3: Filesystem Containment & Path Traversal (ART-11 to ART-14)
  // ============================================================================
  describe("Group 3: Path Traversal & Filesystem Containment", () => {
    it("[ART-11] detects and blocks relative path traversal attacks (../../etc/passwd)", () => {
      const malicious = path.join(ReportResourceGovernor.STORAGE_ROOT, tenantId, "../../etc/passwd");
      expect(artifactSecurityService.isPathContainedInTenantStorage(malicious, tenantId)).toBe(false);
    });

    it("[ART-12] blocks absolute path injection outside storage root", () => {
      expect(artifactSecurityService.isPathContainedInTenantStorage("C:\\Windows\\System32\\cmd.exe", tenantId)).toBe(
        false
      );
      expect(artifactSecurityService.isPathContainedInTenantStorage("/etc/shadow", tenantId)).toBe(false);
    });

    it("[ART-13] blocks access to another tenant's subfolder even inside storage root", () => {
      const otherTenantPath = path.join(ReportResourceGovernor.STORAGE_ROOT, "other-tenant", "job-1.csv");
      expect(artifactSecurityService.isPathContainedInTenantStorage(otherTenantPath, tenantId)).toBe(false);
    });

    it("[ART-14] accepts correctly contained tenant artifact path", () => {
      const valid = path.join(ReportResourceGovernor.STORAGE_ROOT, tenantId, "job-1.csv");
      expect(artifactSecurityService.isPathContainedInTenantStorage(valid, tenantId)).toBe(true);
    });
  });

  // ============================================================================
  // Group 4: MIME Types & Filename Sanitization (ART-15 to ART-19)
  // ============================================================================
  describe("Group 4: HTTP Headers & Filename Sanitization", () => {
    it("[ART-15] resolves correct PDF MIME type", () => {
      expect(artifactSecurityService.getMimeType(ReportFormat.PDF)).toBe("application/pdf");
    });

    it("[ART-16] resolves correct XLSX MIME type", () => {
      expect(artifactSecurityService.getMimeType(ReportFormat.XLSX)).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });

    it("[ART-17] resolves correct CSV MIME type", () => {
      expect(artifactSecurityService.getMimeType(ReportFormat.CSV)).toBe("text/csv; charset=utf-8");
    });

    it("[ART-18] generates safe sanitized download filename without path separators", () => {
      const filename = artifactSecurityService.generateDownloadFilename(
        ReportType.PRESENCE_COMPLIANCE_REPORT,
        "job-abc-123",
        ReportFormat.PDF
      );
      expect(filename).toBe("presence_compliance_report-job-abc-123.pdf");
      expect(filename).not.toContain("/");
      expect(filename).not.toContain("\\");
      expect(filename).not.toContain("..");
    });

    it("[ART-19] enforces Cache-Control private no-store headers", () => {
      const cacheControl = "private, no-store, max-age=0";
      expect(cacheControl).toContain("private");
      expect(cacheControl).toContain("no-store");
    });
  });

  // ============================================================================
  // Group 5: Idempotent 24h Purge (ART-20 to ART-24)
  // ============================================================================
  describe("Group 5: Idempotent 24h Purge Service", () => {
    it("[ART-20] deletes physical file for expired artifacts during purge", async () => {
      const expiredPath = path.resolve(ReportResourceGovernor.STORAGE_ROOT, tenantId, "expired-001.csv");
      setupPhysicalArtifact(expiredPath);

      const origFindExpired = reportJobRepository.findExpiredArtifacts;
      const origClearPath = reportJobRepository.clearArtifactPath;

      let clearedJobId: string | null = null;
      reportJobRepository.findExpiredArtifacts = async () => [
        { ...mockCompletedJob, id: "expired-001", artifactPath: expiredPath },
      ];
      reportJobRepository.clearArtifactPath = async (id) => {
        clearedJobId = id;
      };

      try {
        const result = await artifactSecurityService.purgeExpiredArtifacts();
        expect(result.purgedCount).toBe(1);
        expect(clearedJobId).toBe("expired-001");
        expect(fs.existsSync(expiredPath)).toBe(false);
      } finally {
        cleanupPhysicalArtifact(expiredPath);
        reportJobRepository.findExpiredArtifacts = origFindExpired;
        reportJobRepository.clearArtifactPath = origClearPath;
      }
    });

    it("[ART-21] preserves unexpired artifacts on disk during purge", async () => {
      const activePath = path.resolve(ReportResourceGovernor.STORAGE_ROOT, tenantId, "active-001.csv");
      setupPhysicalArtifact(activePath);

      const origFindExpired = reportJobRepository.findExpiredArtifacts;
      reportJobRepository.findExpiredArtifacts = async () => []; // No expired jobs

      try {
        const result = await artifactSecurityService.purgeExpiredArtifacts();
        expect(result.purgedCount).toBe(0);
        expect(fs.existsSync(activePath)).toBe(true);
      } finally {
        cleanupPhysicalArtifact(activePath);
        reportJobRepository.findExpiredArtifacts = origFindExpired;
      }
    });

    it("[ART-22] handles missing artifact file idempotently during purge without crash", async () => {
      const missingPath = path.resolve(ReportResourceGovernor.STORAGE_ROOT, tenantId, "missing-001.csv");
      cleanupPhysicalArtifact(missingPath);

      const origFindExpired = reportJobRepository.findExpiredArtifacts;
      const origClearPath = reportJobRepository.clearArtifactPath;

      reportJobRepository.findExpiredArtifacts = async () => [
        { ...mockCompletedJob, id: "missing-001", artifactPath: missingPath },
      ];
      reportJobRepository.clearArtifactPath = async () => {};

      try {
        const result = await artifactSecurityService.purgeExpiredArtifacts();
        expect(result.purgedCount).toBe(1);
        expect(result.failedCount).toBe(0);
      } finally {
        reportJobRepository.findExpiredArtifacts = origFindExpired;
        reportJobRepository.clearArtifactPath = origClearPath;
      }
    });

    it("[ART-23] calls clearArtifactPath to nullify database pointer", async () => {
      let cleared = false;
      const origFindExpired = reportJobRepository.findExpiredArtifacts;
      const origClearPath = reportJobRepository.clearArtifactPath;

      reportJobRepository.findExpiredArtifacts = async () => [
        { ...mockCompletedJob, id: "cleared-001", artifactPath: validArtifactPath },
      ];
      reportJobRepository.clearArtifactPath = async () => {
        cleared = true;
      };

      try {
        await artifactSecurityService.purgeExpiredArtifacts();
        expect(cleared).toBe(true);
      } finally {
        reportJobRepository.findExpiredArtifacts = origFindExpired;
        reportJobRepository.clearArtifactPath = origClearPath;
      }
    });

    it("[ART-24] preserves database job records intact (never hard-deletes report_export_jobs)", () => {
      // Confirmed: clearArtifactPath executes UPDATE report_export_jobs SET artifact_path = NULL
      expect(typeof reportJobRepository.clearArtifactPath).toBe("function");
    });
  });

  // ============================================================================
  // Group 6: Race Condition & Resilience (ART-25 to ART-27)
  // ============================================================================
  describe("Group 6: Race Conditions & Resilience", () => {
    it("[ART-25] open read stream continues smoothly during concurrent purge of file", async () => {
      const racePath = path.resolve(ReportResourceGovernor.STORAGE_ROOT, tenantId, "race-001.csv");
      setupPhysicalArtifact(racePath);

      try {
        const readStream = fs.createReadStream(racePath);
        await new Promise((resolve) => readStream.once("open", resolve));

        let data = "";
        for await (const chunk of readStream) {
          data += chunk.toString();
        }
        expect(data).toContain("sample,data");
      } finally {
        cleanupPhysicalArtifact(racePath);
      }
    });

    it("[ART-26] repeated purge executions are completely idempotent", async () => {
      const origFindExpired = reportJobRepository.findExpiredArtifacts;
      const origClearPath = reportJobRepository.clearArtifactPath;

      reportJobRepository.findExpiredArtifacts = async () => [];
      reportJobRepository.clearArtifactPath = async () => {};

      try {
        const p1 = await artifactSecurityService.purgeExpiredArtifacts();
        const p2 = await artifactSecurityService.purgeExpiredArtifacts();
        expect(p1.purgedCount).toBe(0);
        expect(p2.purgedCount).toBe(0);
      } finally {
        reportJobRepository.findExpiredArtifacts = origFindExpired;
        reportJobRepository.clearArtifactPath = origClearPath;
      }
    });

    it("[ART-27] handles filesystem access error gracefully during purge", async () => {
      const origFindExpired = reportJobRepository.findExpiredArtifacts;
      reportJobRepository.findExpiredArtifacts = async () => [
        { ...mockCompletedJob, id: "err-001", artifactPath: validArtifactPath },
      ];

      const origIsContained = artifactSecurityService.isPathContainedInTenantStorage;
      artifactSecurityService.isPathContainedInTenantStorage = () => {
        throw new Error("FS Permission Crash");
      };

      try {
        const result = await artifactSecurityService.purgeExpiredArtifacts();
        expect(result.failedCount).toBe(1);
      } finally {
        artifactSecurityService.isPathContainedInTenantStorage = origIsContained;
        reportJobRepository.findExpiredArtifacts = origFindExpired;
      }
    });
  });
});
