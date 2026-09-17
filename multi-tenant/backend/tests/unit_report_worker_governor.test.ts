/*
 * unit_report_worker_governor.test.ts
 * S7-05-07: BullMQ Worker & Resource Governor Unit & Integration Tests
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import {
  ReportResourceGovernor,
  reportResourceGovernor,
  MaxConcurrentExportJobsExceededError,
} from "../src/services/reporting/reportResourceGovernor";
import { ReportExportProcessor } from "../src/services/reporting/reportExportProcessor";
import {
  ReportType,
  ReportFormat,
  ReportJobStatus,
  REPORT_GOVERNANCE,
} from "../src/types/reporting.types";
import { reportJobRepository } from "../src/repositories/reportJobRepository";
import { reportDataAssembler } from "../src/services/reporting/reportDataAssembler";

describe("S7-05-07: Resource Governor & Export Processor", () => {
  // ============================================================================
  // 1. Resource Governor Concurrency Checks
  // ============================================================================
  describe("Resource Governor Concurrency Invariants", () => {
    it("allows new job when active count is 0 or 1", async () => {
      const origCount = reportJobRepository.countActiveJobs;
      reportJobRepository.countActiveJobs = async () => 1;

      try {
        expect(reportResourceGovernor.checkTenantConcurrency("tenant-1")).resolves.toBeUndefined();
      } finally {
        reportJobRepository.countActiveJobs = origCount;
      }
    });

    it("throws 429 MaxConcurrentExportJobsExceededError when active count is >= 2", async () => {
      const origCount = reportJobRepository.countActiveJobs;
      reportJobRepository.countActiveJobs = async () => 2;

      try {
        expect(reportResourceGovernor.checkTenantConcurrency("tenant-1")).rejects.toThrow(
          MaxConcurrentExportJobsExceededError
        );
      } finally {
        reportJobRepository.countActiveJobs = origCount;
      }
    });

    it("resolves isolated artifact path under storage/reports/{tenantId}/{jobId}.{ext}", () => {
      const resolved = reportResourceGovernor.resolveArtifactPath(
        "tenant-sejuta-jiwa",
        "job-abc-123",
        ReportFormat.CSV
      );
      expect(resolved).toContain("storage");
      expect(resolved).toContain("reports");
      expect(resolved).toContain("tenant-sejuta-jiwa");
      expect(resolved.endsWith("job-abc-123.csv")).toBe(true);
    });

    it("calculates 24-hour artifact TTL accurately", () => {
      const before = Date.now() + 24 * 60 * 60 * 1000;
      const ttlIso = reportResourceGovernor.calculateArtifactExpiration();
      const ttlTime = new Date(ttlIso).getTime();
      expect(Math.abs(ttlTime - before)).toBeLessThan(2000);
    });
  });

  // ============================================================================
  // 2. Export Processor Lifecycle & File Cleanup
  // ============================================================================
  describe("ReportExportProcessor Orchestration & Fail-Closed Cleanup", () => {
    const sampleJob = {
      id: "job-test-001",
      tenantId: "tenant-test",
      reportType: ReportType.ZONE_PERFORMANCE_REPORT,
      format: ReportFormat.CSV,
      status: ReportJobStatus.QUEUED,
      rangeStart: "2026-09-01T00:00:00Z",
      rangeEnd: "2026-09-08T00:00:00Z",
      timezone: "Asia/Jakarta",
      progress: 0,
      rowCount: null,
      rowLimit: 100000,
      truncated: false,
      artifactPath: null,
      artifactExpiresAt: null,
      errorCode: null,
      errorMessage: null,
      zoneId: null,
      riderId: null,
      createdBy: "u1",
      createdAt: "2026-09-08T00:00:00Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
    };

    it("processes ZONE_PERFORMANCE_REPORT as CSV successfully and writes artifact file", async () => {
      const origFind = reportJobRepository.findById;
      const origMarkProc = reportJobRepository.markProcessing;
      const origMarkComp = reportJobRepository.markCompleted;
      const origAssemble = reportDataAssembler.assembleReport;

      let completedMetadata: any = null;
      reportJobRepository.findById = async () => sampleJob;
      reportJobRepository.markProcessing = async () => ({ ...sampleJob, status: ReportJobStatus.PROCESSING });
      reportJobRepository.markCompleted = async (id, tId, meta) => {
        completedMetadata = meta;
        return { ...sampleJob, status: ReportJobStatus.COMPLETED };
      };

      reportDataAssembler.assembleReport = async () => ({
        metadata: {
          tenantName: "Test Tenant",
          tenantId: "tenant-test",
          reportType: ReportType.ZONE_PERFORMANCE_REPORT,
          reportTitle: "Zone Report",
          rangeStart: "2026-09-01T00:00:00Z",
          rangeEnd: "2026-09-08T00:00:00Z",
          timezone: "Asia/Jakarta",
          generatedAt: "2026-09-08T00:00:00Z",
        },
        zones: [
          {
            zoneId: "z1",
            zoneName: "Zone 1",
            status: "ACTIVE",
            totalEvents: 100,
            compliantCount: 95,
            deviatedCount: 5,
            outsideCount: 0,
            unassignedCount: 0,
            complianceRate: 0.95,
            observedRiders: 4,
            affectedRiders: 1,
            deviationEpisodes: 1,
            avgDeviationDurationMinutes: 10,
          },
        ],
        totalZones: 1,
        overallComplianceRate: 0.95,
        overallComplianceRateFormatted: "95.0%",
      });

      const processor = new ReportExportProcessor();

      try {
        await processor.processExportJob("job-test-001", "tenant-test");

        expect(completedMetadata).not.toBeNull();
        expect(completedMetadata.rowCount).toBe(1);
        expect(completedMetadata.truncated).toBe(false);
        expect(fs.existsSync(completedMetadata.artifactPath)).toBe(true);

        const content = fs.readFileSync(completedMetadata.artifactPath, "utf8");
        expect(content).toContain("Zone Name");
        expect(content).toContain("Zone 1");
      } finally {
        if (completedMetadata?.artifactPath && fs.existsSync(completedMetadata.artifactPath)) {
          fs.unlinkSync(completedMetadata.artifactPath);
        }
        reportJobRepository.findById = origFind;
        reportJobRepository.markProcessing = origMarkProc;
        reportJobRepository.markCompleted = origMarkComp;
        reportDataAssembler.assembleReport = origAssemble;
      }
    });

    it("cleans up partial artifact file on unhandled failure and marks job FAILED", async () => {
      const origFind = reportJobRepository.findById;
      const origMarkProc = reportJobRepository.markProcessing;
      const origMarkFail = reportJobRepository.markFailed;
      const origAssemble = reportDataAssembler.assembleReport;

      let failedCode: string | null = null;
      reportJobRepository.findById = async () => sampleJob;
      reportJobRepository.markProcessing = async () => ({ ...sampleJob, status: ReportJobStatus.PROCESSING });
      reportJobRepository.markFailed = async (id, tId, code, msg) => {
        failedCode = code;
        return { ...sampleJob, status: ReportJobStatus.FAILED };
      };

      reportDataAssembler.assembleReport = async () => {
        throw new Error("Unexpected database connection crash");
      };

      const processor = new ReportExportProcessor();
      const targetPath = reportResourceGovernor.resolveArtifactPath("tenant-test", "job-test-001", ReportFormat.CSV);

      try {
        expect(processor.processExportJob("job-test-001", "tenant-test")).rejects.toThrow();
        expect(failedCode).not.toBeNull();
        expect(fs.existsSync(targetPath)).toBe(false);
      } finally {
        reportJobRepository.findById = origFind;
        reportJobRepository.markProcessing = origMarkProc;
        reportJobRepository.markFailed = origMarkFail;
        reportDataAssembler.assembleReport = origAssemble;
      }
    });
  });
});
