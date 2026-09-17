/*
 * unit_report_job_repository.test.ts
 * S7-05-02: Export Job Persistence Layer Unit & Mock Tests
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import { ReportJobRepository } from "../src/repositories/reportJobRepository";
import {
  ReportType,
  ReportFormat,
  ReportJobStatus,
  REPORT_GOVERNANCE,
} from "../src/types/reporting.types";
import { InvalidReportStateTransitionError } from "../src/lib/reporting/reportingStateMachine";

describe("S7-05-02: ReportJobRepository Unit & Persistence Contract", () => {
  // Mock pool factory for deterministic repository testing
  function createMockPool(rowsToReturn: any[] = [], queryInterceptor?: (sql: string, params: any[]) => void) {
    return {
      query: async (sql: string, params: any[] = []) => {
        if (queryInterceptor) {
          queryInterceptor(sql, params);
        }
        return { rows: rowsToReturn };
      },
    } as any;
  }

  const sampleDbRow = {
    id: "a0000000-0000-0000-0000-000000000001",
    tenant_id: "tenant-sejuta-jiwa",
    report_type: ReportType.PRESENCE_COMPLIANCE_REPORT,
    format: ReportFormat.CSV,
    status: ReportJobStatus.QUEUED,
    range_start: "2026-09-01T00:00:00Z",
    range_end: "2026-09-08T00:00:00Z",
    timezone: "Asia/Jakarta",
    progress: 0,
    row_count: null,
    row_limit: 100000,
    truncated: false,
    artifact_path: null,
    artifact_expires_at: null,
    error_code: null,
    error_message: null,
    zone_id: null,
    rider_id: null,
    created_by: "u0000000-0000-0000-0000-000000000001",
    created_at: "2026-09-08T01:00:00Z",
    started_at: null,
    completed_at: null,
    failed_at: null,
  };

  it("should create a job in QUEUED status with progress 0 and 100k row limit", async () => {
    let capturedSql = "";
    let capturedParams: any[] = [];

    const mockPool = createMockPool([sampleDbRow], (sql, params) => {
      capturedSql = sql;
      capturedParams = params;
    });

    const repo = new ReportJobRepository(mockPool);
    const job = await repo.createJob({
      tenantId: "tenant-sejuta-jiwa",
      reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
      format: ReportFormat.CSV,
      rangeStart: "2026-09-01T00:00:00Z",
      rangeEnd: "2026-09-08T00:00:00Z",
      timezone: "Asia/Jakarta",
      createdBy: "u0000000-0000-0000-0000-000000000001",
    });

    expect(capturedSql).toContain("INSERT INTO report_export_jobs");
    expect(capturedParams[0]).toBe("tenant-sejuta-jiwa");
    expect(capturedParams[1]).toBe(ReportType.PRESENCE_COMPLIANCE_REPORT);
    expect(capturedParams[2]).toBe(ReportFormat.CSV);
    expect(capturedParams[5]).toBe("Asia/Jakarta");
    expect(capturedParams[6]).toBe(REPORT_GOVERNANCE.MAX_ROW_LIMIT);

    expect(job.id).toBe("a0000000-0000-0000-0000-000000000001");
    expect(job.status).toBe(ReportJobStatus.QUEUED);
    expect(job.progress).toBe(0);
    expect(job.rowLimit).toBe(100000);
    expect(job.truncated).toBe(false);
  });

  it("should correctly count active jobs for concurrency governor check", async () => {
    const mockPool = createMockPool([{ active_count: 2 }]);
    const repo = new ReportJobRepository(mockPool);

    const activeCount = await repo.countActiveJobs("tenant-sejuta-jiwa");
    expect(activeCount).toBe(2);
  });

  it("should find job by id strictly isolated by tenantId", async () => {
    let capturedParams: any[] = [];
    const mockPool = createMockPool([sampleDbRow], (sql, params) => {
      capturedParams = params;
    });
    const repo = new ReportJobRepository(mockPool);

    const job = await repo.findById("a0000000-0000-0000-0000-000000000001", "tenant-sejuta-jiwa");
    expect(capturedParams[0]).toBe("a0000000-0000-0000-0000-000000000001");
    expect(capturedParams[1]).toBe("tenant-sejuta-jiwa");
    expect(job).not.toBeNull();
    expect(job?.tenantId).toBe("tenant-sejuta-jiwa");
  });

  it("should return null if job not found or belongs to another tenant", async () => {
    const mockPool = createMockPool([]);
    const repo = new ReportJobRepository(mockPool);

    const job = await repo.findById("a0000000-0000-0000-0000-000000000001", "other-tenant");
    expect(job).toBeNull();
  });

  it("should mark job as PROCESSING when transition QUEUED -> PROCESSING is valid", async () => {
    let queryIndex = 0;
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        queryIndex++;
        if (queryIndex === 1) {
          // findById call
          return { rows: [sampleDbRow] };
        } else {
          // UPDATE call
          return {
            rows: [
              {
                ...sampleDbRow,
                status: ReportJobStatus.PROCESSING,
                progress: 1,
                started_at: "2026-09-08T01:00:05Z",
              },
            ],
          };
        }
      },
    } as any;

    const repo = new ReportJobRepository(mockPool);
    const updated = await repo.markProcessing("a0000000-0000-0000-0000-000000000001", "tenant-sejuta-jiwa");
    expect(updated?.status).toBe(ReportJobStatus.PROCESSING);
    expect(updated?.progress).toBe(1);
    expect(updated?.startedAt).toBe("2026-09-08T01:00:05.000Z");
  });

  it("should mark job as COMPLETED when transition PROCESSING -> COMPLETED is valid", async () => {
    const processingDbRow = {
      ...sampleDbRow,
      status: ReportJobStatus.PROCESSING,
      progress: 50,
      started_at: "2026-09-08T01:00:05Z",
    };

    let queryIndex = 0;
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        queryIndex++;
        if (queryIndex === 1) {
          // findById call
          return { rows: [processingDbRow] };
        } else {
          // UPDATE call
          return {
            rows: [
              {
                ...processingDbRow,
                status: ReportJobStatus.COMPLETED,
                progress: 100,
                row_count: 500,
                truncated: false,
                artifact_path: "storage/reports/tenant-sejuta-jiwa/export-1.csv",
                artifact_expires_at: "2026-09-09T01:00:05Z",
                completed_at: "2026-09-08T01:00:10Z",
              },
            ],
          };
        }
      },
    } as any;

    const repo = new ReportJobRepository(mockPool);
    const updated = await repo.markCompleted(
      "a0000000-0000-0000-0000-000000000001",
      "tenant-sejuta-jiwa",
      {
        rowCount: 500,
        truncated: false,
        artifactPath: "storage/reports/tenant-sejuta-jiwa/export-1.csv",
        artifactExpiresAt: "2026-09-09T01:00:05Z",
      }
    );

    expect(updated?.status).toBe(ReportJobStatus.COMPLETED);
    expect(updated?.progress).toBe(100);
    expect(updated?.rowCount).toBe(500);
    expect(updated?.truncated).toBe(false);
    expect(updated?.artifactPath).toBe("storage/reports/tenant-sejuta-jiwa/export-1.csv");
  });

  it("should reject markCompleted if current state is QUEUED (illegal state transition)", async () => {
    let queryIndex = 0;
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        queryIndex++;
        if (queryIndex === 1) {
          // findById call returns QUEUED
          return { rows: [sampleDbRow] };
        }
        return { rows: [] };
      },
    } as any;

    const repo = new ReportJobRepository(mockPool);
    expect(
      repo.markCompleted("a0000000-0000-0000-0000-000000000001", "tenant-sejuta-jiwa", {
        rowCount: 500,
        truncated: false,
        artifactPath: "path",
        artifactExpiresAt: "2026-09-09T00:00:00Z",
      })
    ).rejects.toThrow(InvalidReportStateTransitionError);
  });

  it("should mark job as FAILED when transition PROCESSING -> FAILED occurs", async () => {
    const processingDbRow = {
      ...sampleDbRow,
      status: ReportJobStatus.PROCESSING,
      progress: 50,
      started_at: "2026-09-08T01:00:05Z",
    };

    let queryIndex = 0;
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        queryIndex++;
        if (queryIndex === 1) {
          return { rows: [processingDbRow] };
        } else {
          return {
            rows: [
              {
                ...processingDbRow,
                status: ReportJobStatus.FAILED,
                error_code: "EXPORT_STORAGE_WRITE_ERROR",
                error_message: "Disk write failure",
                failed_at: "2026-09-08T01:00:10Z",
              },
            ],
          };
        }
      },
    } as any;

    const repo = new ReportJobRepository(mockPool);
    const updated = await repo.markFailed(
      "a0000000-0000-0000-0000-000000000001",
      "tenant-sejuta-jiwa",
      "EXPORT_STORAGE_WRITE_ERROR",
      "Disk write failure"
    );

    expect(updated?.status).toBe(ReportJobStatus.FAILED);
    expect(updated?.errorCode).toBe("EXPORT_STORAGE_WRITE_ERROR");
    expect(updated?.errorMessage).toBe("Disk write failure");
  });
});
