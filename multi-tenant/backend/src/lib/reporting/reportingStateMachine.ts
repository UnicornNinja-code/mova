/*
 * reportingStateMachine.ts
 * S7-05-01: Operational Reporting & Async Export State Machine & Invariant Validators
 * MOVA Architecture
 */

import {
  ReportJobStatus,
  ReportJobEvent,
  ReportType,
  ReportFormat,
  ReportFilter,
  CreateExportJobRequest,
  REPORT_GOVERNANCE,
  isExecutableReportType,
} from "../../types/reporting.types";

// ============================================================================
// Domain Error Classes
// ============================================================================

export class ReportDomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "ReportDomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class InvalidReportStateTransitionError extends ReportDomainError {
  constructor(currentStatus: ReportJobStatus, event: ReportJobEvent) {
    super(
      `Illegal report job transition: cannot apply event '${event}' to status '${currentStatus}'.`,
      "REPORT_INVALID_STATE_TRANSITION",
      409
    );
  }
}

export class ReportTypeNotAvailableError extends ReportDomainError {
  constructor(reportType: ReportType) {
    super(
      `Report type '${reportType}' is deferred and not currently available for execution.`,
      "REPORT_TYPE_NOT_AVAILABLE",
      400
    );
  }
}

export class InvalidReportFilterError extends ReportDomainError {
  constructor(message: string) {
    super(message, "REPORT_INVALID_FILTER", 400);
  }
}

// ============================================================================
// Canonical State Transition Table
// ============================================================================

const ALLOWED_TRANSITIONS: Record<ReportJobStatus, Partial<Record<ReportJobEvent, ReportJobStatus>>> = {
  [ReportJobStatus.QUEUED]: {
    [ReportJobEvent.WORKER_STARTED]: ReportJobStatus.PROCESSING,
  },
  [ReportJobStatus.PROCESSING]: {
    [ReportJobEvent.EXPORT_SUCCEEDED]: ReportJobStatus.COMPLETED,
    [ReportJobEvent.EXPORT_FAILED]: ReportJobStatus.FAILED,
  },
  [ReportJobStatus.COMPLETED]: {},
  [ReportJobStatus.FAILED]: {},
};

/**
 * Transitions a report job to its next state based on canonical lifecycle rules.
 * Throws InvalidReportStateTransitionError if the transition is illegal.
 */
export function transitionReportJob(
  currentStatus: ReportJobStatus,
  event: ReportJobEvent
): ReportJobStatus {
  const nextStatus = ALLOWED_TRANSITIONS[currentStatus]?.[event];
  if (!nextStatus) {
    throw new InvalidReportStateTransitionError(currentStatus, event);
  }
  return nextStatus;
}

/**
 * Validates progress value according to status semantics:
 * - QUEUED: 0
 * - PROCESSING: 1..99 (or null/0 during init)
 * - COMPLETED: 100
 * - FAILED: retains last known progress (0..100)
 */
export function normalizeProgress(status: ReportJobStatus, currentProgress?: number | null): number {
  switch (status) {
    case ReportJobStatus.QUEUED:
      return 0;
    case ReportJobStatus.COMPLETED:
      return 100;
    case ReportJobStatus.PROCESSING: {
      if (currentProgress === null || currentProgress === undefined) return 0;
      return Math.min(99, Math.max(0, Math.floor(currentProgress)));
    }
    case ReportJobStatus.FAILED: {
      if (currentProgress === null || currentProgress === undefined) return 0;
      return Math.min(100, Math.max(0, Math.floor(currentProgress)));
    }
  }
}

// ============================================================================
// Filter and Request Validators
// ============================================================================

/**
 * Validates IANA timezone string.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates base ReportFilter:
 * 1. ISO 8601 parsing.
 * 2. start < end ([start, end) boundary semantics).
 * 3. Range <= 90 days.
 * 4. Valid IANA timezone.
 */
export function validateReportFilter(filter: ReportFilter): void {
  if (!filter.rangeStart || !filter.rangeEnd) {
    throw new InvalidReportFilterError("rangeStart and rangeEnd are required ISO timestamps.");
  }

  const startDate = new Date(filter.rangeStart);
  const endDate = new Date(filter.rangeEnd);

  if (isNaN(startDate.getTime())) {
    throw new InvalidReportFilterError(`rangeStart '${filter.rangeStart}' is not a valid ISO timestamp.`);
  }
  if (isNaN(endDate.getTime())) {
    throw new InvalidReportFilterError(`rangeEnd '${filter.rangeEnd}' is not a valid ISO timestamp.`);
  }

  if (startDate.getTime() >= endDate.getTime()) {
    throw new InvalidReportFilterError("rangeStart must be strictly before rangeEnd ([start, end) boundary).");
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > REPORT_GOVERNANCE.MAX_RANGE_DAYS) {
    throw new InvalidReportFilterError(
      `Date range exceeds maximum allowed limit of ${REPORT_GOVERNANCE.MAX_RANGE_DAYS} days (${diffDays.toFixed(1)} days requested).`
    );
  }

  const tz = filter.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;
  if (!isValidTimezone(tz)) {
    throw new InvalidReportFilterError(`Timezone '${tz}' is not a valid IANA timezone.`);
  }
}

/**
 * Validates full CreateExportJobRequest:
 * 1. ReportType validity & capability execution check (DEFERRED check).
 * 2. ReportFormat validity.
 * 3. Filter boundary and timezone rules.
 */
export function validateExportRequest(req: CreateExportJobRequest): void {
  if (!req.reportType || !Object.values(ReportType).includes(req.reportType)) {
    throw new InvalidReportFilterError(`Invalid or missing reportType '${req.reportType}'.`);
  }

  if (!isExecutableReportType(req.reportType)) {
    throw new ReportTypeNotAvailableError(req.reportType);
  }

  if (!req.format || !Object.values(ReportFormat).includes(req.format)) {
    throw new InvalidReportFilterError(`Invalid or missing format '${req.format}'. Supported: CSV, XLSX, PDF.`);
  }

  validateReportFilter({
    rangeStart: req.rangeStart,
    rangeEnd: req.rangeEnd,
    timezone: req.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE,
    zoneId: req.zoneId,
    riderId: req.riderId,
  });
}
