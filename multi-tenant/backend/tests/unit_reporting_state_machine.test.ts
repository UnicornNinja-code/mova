/*
 * unit_reporting_state_machine.test.ts
 * S7-05-01: Operational Reporting & Async Export State Machine & Invariant Tests
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import {
  ReportType,
  ReportFormat,
  ReportJobStatus,
  ReportJobEvent,
  REPORT_GOVERNANCE,
  REPORT_CAPABILITY_REGISTRY,
  isExecutableReportType,
} from "../src/types/reporting.types";
import {
  transitionReportJob,
  normalizeProgress,
  validateReportFilter,
  validateExportRequest,
  InvalidReportStateTransitionError,
  ReportTypeNotAvailableError,
  InvalidReportFilterError,
  isValidTimezone,
} from "../src/lib/reporting/reportingStateMachine";

describe("S7-05-01: Report State Machine & Domain Invariants", () => {
  // ============================================================================
  // 1. Canonical State Transitions (12 Cases: 3 Valid, 9 Invalid)
  // ============================================================================
  describe("State Transition Matrix", () => {
    // 3 Valid Transitions
    it("should allow QUEUED -> WORKER_STARTED -> PROCESSING", () => {
      const next = transitionReportJob(ReportJobStatus.QUEUED, ReportJobEvent.WORKER_STARTED);
      expect(next).toBe(ReportJobStatus.PROCESSING);
    });

    it("should allow PROCESSING -> EXPORT_SUCCEEDED -> COMPLETED", () => {
      const next = transitionReportJob(ReportJobStatus.PROCESSING, ReportJobEvent.EXPORT_SUCCEEDED);
      expect(next).toBe(ReportJobStatus.COMPLETED);
    });

    it("should allow PROCESSING -> EXPORT_FAILED -> FAILED", () => {
      const next = transitionReportJob(ReportJobStatus.PROCESSING, ReportJobEvent.EXPORT_FAILED);
      expect(next).toBe(ReportJobStatus.FAILED);
    });

    // 9 Invalid Transitions
    it("should reject QUEUED -> EXPORT_SUCCEEDED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.QUEUED, ReportJobEvent.EXPORT_SUCCEEDED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject QUEUED -> EXPORT_FAILED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.QUEUED, ReportJobEvent.EXPORT_FAILED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject PROCESSING -> WORKER_STARTED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.PROCESSING, ReportJobEvent.WORKER_STARTED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject COMPLETED -> WORKER_STARTED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.COMPLETED, ReportJobEvent.WORKER_STARTED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject COMPLETED -> EXPORT_SUCCEEDED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.COMPLETED, ReportJobEvent.EXPORT_SUCCEEDED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject COMPLETED -> EXPORT_FAILED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.COMPLETED, ReportJobEvent.EXPORT_FAILED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject FAILED -> WORKER_STARTED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.FAILED, ReportJobEvent.WORKER_STARTED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject FAILED -> EXPORT_SUCCEEDED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.FAILED, ReportJobEvent.EXPORT_SUCCEEDED)
      ).toThrow(InvalidReportStateTransitionError);
    });

    it("should reject FAILED -> EXPORT_FAILED", () => {
      expect(() =>
        transitionReportJob(ReportJobStatus.FAILED, ReportJobEvent.EXPORT_FAILED)
      ).toThrow(InvalidReportStateTransitionError);
    });
  });

  // ============================================================================
  // 2. Capability Matrix & Deferred Checks
  // ============================================================================
  describe("Capability Matrix & Availability", () => {
    it("should have PRESENCE_COMPLIANCE_REPORT as READY", () => {
      expect(isExecutableReportType(ReportType.PRESENCE_COMPLIANCE_REPORT)).toBe(true);
      expect(REPORT_CAPABILITY_REGISTRY[ReportType.PRESENCE_COMPLIANCE_REPORT].availability).toBe("READY");
    });

    it("should have ZONE_PERFORMANCE_REPORT as READY", () => {
      expect(isExecutableReportType(ReportType.ZONE_PERFORMANCE_REPORT)).toBe(true);
      expect(REPORT_CAPABILITY_REGISTRY[ReportType.ZONE_PERFORMANCE_REPORT].availability).toBe("READY");
    });

    it("should have RIDER_DUTY_REPORT as READY", () => {
      expect(isExecutableReportType(ReportType.RIDER_DUTY_REPORT)).toBe(true);
      expect(REPORT_CAPABILITY_REGISTRY[ReportType.RIDER_DUTY_REPORT].availability).toBe("READY");
    });

    it("should have SALES_SETTLEMENT_REPORT strictly as DEFERRED", () => {
      expect(isExecutableReportType(ReportType.SALES_SETTLEMENT_REPORT)).toBe(false);
      expect(REPORT_CAPABILITY_REGISTRY[ReportType.SALES_SETTLEMENT_REPORT].availability).toBe("DEFERRED");
      expect(REPORT_CAPABILITY_REGISTRY[ReportType.SALES_SETTLEMENT_REPORT].deferredReason).toBeDefined();
    });

    it("should reject export request for DEFERRED SALES_SETTLEMENT_REPORT", () => {
      expect(() =>
        validateExportRequest({
          reportType: ReportType.SALES_SETTLEMENT_REPORT,
          format: ReportFormat.CSV,
          rangeStart: "2026-09-01T00:00:00Z",
          rangeEnd: "2026-09-07T00:00:00Z",
        })
      ).toThrow(ReportTypeNotAvailableError);
    });
  });

  // ============================================================================
  // 3. Progress Semantics
  // ============================================================================
  describe("Progress Semantics", () => {
    it("QUEUED always normalizes progress to 0", () => {
      expect(normalizeProgress(ReportJobStatus.QUEUED, 50)).toBe(0);
      expect(normalizeProgress(ReportJobStatus.QUEUED, null)).toBe(0);
    });

    it("PROCESSING normalizes progress to range 0..99", () => {
      expect(normalizeProgress(ReportJobStatus.PROCESSING, 45.8)).toBe(45);
      expect(normalizeProgress(ReportJobStatus.PROCESSING, 100)).toBe(99);
      expect(normalizeProgress(ReportJobStatus.PROCESSING, null)).toBe(0);
    });

    it("COMPLETED always normalizes progress to 100", () => {
      expect(normalizeProgress(ReportJobStatus.COMPLETED, 80)).toBe(100);
      expect(normalizeProgress(ReportJobStatus.COMPLETED, null)).toBe(100);
    });

    it("FAILED preserves last known progress", () => {
      expect(normalizeProgress(ReportJobStatus.FAILED, 65)).toBe(65);
      expect(normalizeProgress(ReportJobStatus.FAILED, null)).toBe(0);
    });
  });

  // ============================================================================
  // 4. Base Filter & Timezone Invariants
  // ============================================================================
  describe("Filter & Timezone Validation", () => {
    it("validates valid IANA timezones", () => {
      expect(isValidTimezone("Asia/Jakarta")).toBe(true);
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Invalid/Timezone_Foo")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
    });

    it("passes for valid filter within 90 days", () => {
      expect(() =>
        validateReportFilter({
          rangeStart: "2026-09-01T00:00:00Z",
          rangeEnd: "2026-09-08T00:00:00Z",
          timezone: "Asia/Jakarta",
        })
      ).not.toThrow();
    });

    it("rejects when rangeStart >= rangeEnd", () => {
      expect(() =>
        validateReportFilter({
          rangeStart: "2026-09-08T00:00:00Z",
          rangeEnd: "2026-09-01T00:00:00Z",
          timezone: "Asia/Jakarta",
        })
      ).toThrow(InvalidReportFilterError);

      expect(() =>
        validateReportFilter({
          rangeStart: "2026-09-08T00:00:00Z",
          rangeEnd: "2026-09-08T00:00:00Z",
          timezone: "Asia/Jakarta",
        })
      ).toThrow(InvalidReportFilterError);
    });

    it("rejects when range exceeds 90 days", () => {
      expect(() =>
        validateReportFilter({
          rangeStart: "2026-01-01T00:00:00Z",
          rangeEnd: "2026-05-01T00:00:00Z", // ~120 days
          timezone: "Asia/Jakarta",
        })
      ).toThrow(InvalidReportFilterError);
    });

    it("rejects invalid date strings", () => {
      expect(() =>
        validateReportFilter({
          rangeStart: "not-a-date",
          rangeEnd: "2026-09-08T00:00:00Z",
          timezone: "Asia/Jakarta",
        })
      ).toThrow(InvalidReportFilterError);
    });

    it("rejects invalid IANA timezone", () => {
      expect(() =>
        validateReportFilter({
          rangeStart: "2026-09-01T00:00:00Z",
          rangeEnd: "2026-09-08T00:00:00Z",
          timezone: "Mars/Olympus_Mons",
        })
      ).toThrow(InvalidReportFilterError);
    });
  });

  // ============================================================================
  // 5. Governance and Resource Limits
  // ============================================================================
  describe("Governance Constraints", () => {
    it("locks resource limits exactly as specified", () => {
      expect(REPORT_GOVERNANCE.MAX_RANGE_DAYS).toBe(90);
      expect(REPORT_GOVERNANCE.MAX_ROW_LIMIT).toBe(100000);
      expect(REPORT_GOVERNANCE.MAX_CONCURRENT_JOBS_PER_TENANT).toBe(2);
      expect(REPORT_GOVERNANCE.ARTIFACT_TTL_HOURS).toBe(24);
      expect(REPORT_GOVERNANCE.MAX_PDF_ROWS_PER_SECTION).toBe(50);
      expect(REPORT_GOVERNANCE.DEFAULT_TIMEZONE).toBe("Asia/Jakarta");
    });
  });
});
