/*
 * reportExportStore.test.ts
 * S7-05-10: Automated Unit & Contract Suite for Frontend Operational Reporting Engine
 * 
 * Verifies:
 * 1. Frontend Types & Capability Registry align strictly with OpenAPI v4.2.0.
 * 2. Governance limits (90-day max, 100k row limit, 2-job concurrency).
 * 3. Typed Service HTTP endpoints and bounded exponential backoff poller.
 * 4. Reactive Store state transitions, active job tracking, and download triggers.
 * 5. SALES_SETTLEMENT_REPORT capability gate (DEFERRED status preservation).
 */

import "./setup.js";
import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  ReportType,
  ReportFormat,
  ReportJobStatus,
  REPORT_CAPABILITY_REGISTRY,
  REPORT_GOVERNANCE,
  isExecutableReportType,
  type ReportExportJob,
  type ExportJobStatusResponse,
} from "../src/lib/types/reporting.types.js";
import { reportExportService } from "../src/services/reportExportService.js";
import { ReportExportStore } from "../src/lib/stores/reportExportStore.svelte.js";
import { axiosInstance } from "../src/lib/axios.js";

describe("S7-05-10: Frontend Operational Reporting Suite", () => {
  // ==========================================================================
  // Section 1: Types & Capability Registry Invariants
  // ==========================================================================
  describe("1. Capability Registry & Governance Invariants", () => {
    it("preserves canonical report types enum matching OpenAPI v4.2.0", () => {
      expect(ReportType.PRESENCE_COMPLIANCE_REPORT).toBe("PRESENCE_COMPLIANCE_REPORT");
      expect(ReportType.ZONE_PERFORMANCE_REPORT).toBe("ZONE_PERFORMANCE_REPORT");
      expect(ReportType.RIDER_DUTY_REPORT).toBe("RIDER_DUTY_REPORT");
      expect(ReportType.SALES_SETTLEMENT_REPORT).toBe("SALES_SETTLEMENT_REPORT");
    });

    it("locks SALES_SETTLEMENT_REPORT strictly as DEFERRED", () => {
      const spec = REPORT_CAPABILITY_REGISTRY[ReportType.SALES_SETTLEMENT_REPORT];
      expect(spec.availability).toBe("DEFERRED");
      expect(isExecutableReportType(ReportType.SALES_SETTLEMENT_REPORT)).toBe(false);
      expect(spec.deferredReason).toContain("shift_settlements");
    });

    it("locks PRESENCE, ZONE, and RIDER reports as READY", () => {
      expect(isExecutableReportType(ReportType.PRESENCE_COMPLIANCE_REPORT)).toBe(true);
      expect(isExecutableReportType(ReportType.ZONE_PERFORMANCE_REPORT)).toBe(true);
      expect(isExecutableReportType(ReportType.RIDER_DUTY_REPORT)).toBe(true);
    });

    it("defines governance constants matching backend authority", () => {
      expect(REPORT_GOVERNANCE.MAX_RANGE_DAYS).toBe(90);
      expect(REPORT_GOVERNANCE.MAX_ROW_LIMIT).toBe(100000);
      expect(REPORT_GOVERNANCE.MAX_CONCURRENT_JOBS_PER_TENANT).toBe(2);
      expect(REPORT_GOVERNANCE.ARTIFACT_TTL_HOURS).toBe(24);
      expect(REPORT_GOVERNANCE.DEFAULT_TIMEZONE).toBe("Asia/Jakarta");
    });
  });

  // ==========================================================================
  // Section 2: Typed Service & Bounded Poller
  // ==========================================================================
  describe("2. Typed Service & Polling Lifecycle", () => {
    it("calls POST /reports/export for createExportJob", async () => {
      const mockPost = mock(async () => ({
        data: {
          data: {
            job: {
              id: "job-101",
              tenantId: "tenant-test",
              reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
              format: ReportFormat.PDF,
              status: ReportJobStatus.QUEUED,
              progress: 0,
            },
            statusUrl: "/api/reports/export/job-101",
          },
        },
      }));
      (axiosInstance as any).post = mockPost;

      const res = await reportExportService.createExportJob({
        reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
        format: ReportFormat.PDF,
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-08T00:00:00.000Z",
      });

      expect(mockPost).toHaveBeenCalled();
      expect(res.job.id).toBe("job-101");
      expect(res.job.status).toBe(ReportJobStatus.QUEUED);
    });

    it("polls until COMPLETED state with progress callbacks", async () => {
      let pollCount = 0;
      const mockGet = mock(async (url: string) => {
        pollCount++;
        if (pollCount === 1) {
          return {
            data: {
              data: {
                job: { id: "job-101", status: ReportJobStatus.PROCESSING, progress: 45 },
                downloadUrl: null,
                isExpired: false,
              },
            },
          };
        }
        return {
          data: {
            data: {
              job: { id: "job-101", status: ReportJobStatus.COMPLETED, progress: 100 },
              downloadUrl: "/api/reports/export/job-101/download",
              isExpired: false,
            },
          },
        };
      });
      (axiosInstance as any).get = mockGet;

      const progressSnapshots: number[] = [];
      const res = await reportExportService.pollUntilReady("job-101", {
        initialIntervalMs: 5,
        maxIntervalMs: 10,
        onProgress: (job) => progressSnapshots.push(job.progress),
      });

      expect(res.job.status).toBe(ReportJobStatus.COMPLETED);
      expect(res.downloadUrl).toBe("/api/reports/export/job-101/download");
      expect(progressSnapshots).toEqual([45, 100]);
    });

    it("throws error immediately when job transitions to FAILED", async () => {
      (axiosInstance as any).get = mock(async () => ({
        data: {
          data: {
            job: {
              id: "job-err",
              status: ReportJobStatus.FAILED,
              errorMessage: "PostgreSQL Query Timeout",
            },
            downloadUrl: null,
            isExpired: false,
          },
        },
      }));

      expect(
        reportExportService.pollUntilReady("job-err", { initialIntervalMs: 5 })
      ).rejects.toThrow("PostgreSQL Query Timeout");
    });
  });

  // ==========================================================================
  // Section 3: Reactive Store State & Actions
  // ==========================================================================
  describe("3. ReportExportStore State Management", () => {
    let store: ReportExportStore;

    beforeEach(() => {
      store = new ReportExportStore();
    });

    it("initializes with closed modal and empty active jobs", () => {
      expect(store.isModalOpen).toBe(false);
      expect(store.isDrawerOpen).toBe(false);
      expect(store.activeJobs.length).toBe(0);
      expect(store.recentJobs.length).toBe(0);
    });

    it("opens and closes modal with custom initial options", () => {
      store.openExportModal({
        reportType: ReportType.ZONE_PERFORMANCE_REPORT,
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-05T00:00:00.000Z",
        zoneId: "zone-1",
      });

      expect(store.isModalOpen).toBe(true);
      expect(store.modalInitialReportType).toBe(ReportType.ZONE_PERFORMANCE_REPORT);
      expect(store.modalInitialRangeStart).toBe("2026-09-01T00:00:00.000Z");
      expect(store.modalInitialZoneId).toBe("zone-1");

      store.closeExportModal();
      expect(store.isModalOpen).toBe(false);
    });

    it("tracks submitted job in activeJobs and launches background polling", async () => {
      const mockJob: ReportExportJob = {
        id: "job-submit-1",
        tenantId: "tenant-sda",
        reportType: ReportType.RIDER_DUTY_REPORT,
        format: ReportFormat.CSV,
        status: ReportJobStatus.QUEUED,
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-08T00:00:00.000Z",
        timezone: "Asia/Jakarta",
        progress: 0,
        rowCount: null,
        rowLimit: 100000,
        truncated: false,
        artifactExpiresAt: null,
        errorCode: null,
        errorMessage: null,
        zoneId: null,
        riderId: null,
        createdBy: "user-1",
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        failedAt: null,
      };

      (axiosInstance as any).post = mock(async () => ({
        data: { data: { job: mockJob, statusUrl: "/api/reports/export/job-submit-1" } },
      }));

      (axiosInstance as any).get = mock(async () => ({
        data: {
          data: {
            job: { ...mockJob, status: ReportJobStatus.COMPLETED, progress: 100, rowCount: 50 },
            downloadUrl: "/api/reports/export/job-submit-1/download",
            isExpired: false,
          },
        },
      }));

      const created = await store.submitExportJob({
        reportType: ReportType.RIDER_DUTY_REPORT,
        format: ReportFormat.CSV,
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-08T00:00:00.000Z",
      });

      expect(created).not.toBeNull();
      expect(store.isModalOpen).toBe(false);
      expect(store.activeJobs.length).toBe(1);
      expect(store.activeJobs[0].id).toBe("job-submit-1");
    });
  });
});
