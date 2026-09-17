/*
 * reporting.types.ts
 * S7-05-01: Operational Reporting & Async Export Domain Models & DTOs
 * MOVA Architecture - Additive Reporting Layer
 * 
 * Strict Invariants:
 * 1. Read-Only Intelligence Consumer: Observes authoritative PostgreSQL/PostGIS facts.
 * 2. Async Offloading: Heavy CSV/XLSX/PDF file creation is queued and offloaded.
 * 3. Zero-Fake-Data: Nullable ratios, zero-denominator safeguards, no NaN/Infinity.
 * 4. Tenant Isolation: Session-bound JWT tenant resolution with RLS enforcement.
 * 5. Capability-Gated: SALES_SETTLEMENT_REPORT is explicitly DEFERRED.
 */

// ============================================================================
// 1. Report Enums & Primitive Types
// ============================================================================

export enum ReportType {
  PRESENCE_COMPLIANCE_REPORT = "PRESENCE_COMPLIANCE_REPORT",
  ZONE_PERFORMANCE_REPORT = "ZONE_PERFORMANCE_REPORT",
  RIDER_DUTY_REPORT = "RIDER_DUTY_REPORT",
  SALES_SETTLEMENT_REPORT = "SALES_SETTLEMENT_REPORT",
}

export enum ReportFormat {
  CSV = "CSV",
  XLSX = "XLSX",
  PDF = "PDF",
}

export enum ReportJobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum ReportJobEvent {
  WORKER_STARTED = "WORKER_STARTED",
  EXPORT_SUCCEEDED = "EXPORT_SUCCEEDED",
  EXPORT_FAILED = "EXPORT_FAILED",
}

export type ReportAvailability = "READY" | "DEFERRED";

// ============================================================================
// 2. Report Capability Specification
// ============================================================================

export interface ReportCapabilitySpec {
  reportType: ReportType;
  availability: ReportAvailability;
  description: string;
  authoritativeSources: string[];
  supportedFormats: ReportFormat[];
  deferredReason?: string;
}

export const REPORT_CAPABILITY_REGISTRY: Record<ReportType, ReportCapabilitySpec> = {
  [ReportType.PRESENCE_COMPLIANCE_REPORT]: {
    reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
    availability: "READY",
    description: "Rekapitulasi terperinci sinyal keberadaan rider, kepatuhan geofence, dan episode deviasi.",
    authoritativeSources: ["rider_presence_events", "zones", "users"],
    supportedFormats: [ReportFormat.CSV, ReportFormat.XLSX, ReportFormat.PDF],
  },
  [ReportType.ZONE_PERFORMANCE_REPORT]: {
    reportType: ReportType.ZONE_PERFORMANCE_REPORT,
    availability: "READY",
    description: "Evaluasi volume kehadiran, kepadatan deviasi, dan performa per zona operasional.",
    authoritativeSources: ["zones", "rider_presence_events", "users"],
    supportedFormats: [ReportFormat.CSV, ReportFormat.XLSX, ReportFormat.PDF],
  },
  [ReportType.RIDER_DUTY_REPORT]: {
    reportType: ReportType.RIDER_DUTY_REPORT,
    availability: "READY",
    description: "Log kehadiran rider, hari dinas aktif, zona terobservasi, dan rasio kepatuhan individu.",
    authoritativeSources: ["users", "rider_presence_events", "zone_assignments"],
    supportedFormats: [ReportFormat.CSV, ReportFormat.XLSX, ReportFormat.PDF],
  },
  [ReportType.SALES_SETTLEMENT_REPORT]: {
    reportType: ReportType.SALES_SETTLEMENT_REPORT,
    availability: "DEFERRED",
    description: "Rekonsiliasi penjualan produk shift kasir, perbandingan Cash vs QRIS, dan diskrepansi.",
    authoritativeSources: ["sales_logs", "shift_settlements", "zone_assignments"],
    supportedFormats: [ReportFormat.CSV, ReportFormat.XLSX, ReportFormat.PDF],
    deferredReason: "Tabel shift_settlements belum memiliki kolom tenant_id terisolasi RLS secara mandiri.",
  },
};

export function isExecutableReportType(type: ReportType): boolean {
  return REPORT_CAPABILITY_REGISTRY[type]?.availability === "READY";
}

// ============================================================================
// 3. Filter & Request Models
// ============================================================================

export interface ReportFilter {
  rangeStart: string; // ISO 8601
  rangeEnd: string;   // ISO 8601
  timezone: string;   // e.g. "Asia/Jakarta"
  zoneId?: string;
  riderId?: string;
}

export interface CreateExportJobRequest {
  reportType: ReportType;
  format: ReportFormat;
  rangeStart: string;
  rangeEnd: string;
  timezone?: string; // Defaults to "Asia/Jakarta"
  zoneId?: string;
  riderId?: string;
}

export interface ExportJobHistoryQuery {
  limit?: number;
  offset?: number;
  status?: ReportJobStatus;
  reportType?: ReportType;
}

// ============================================================================
// 4. Job Domain Entity & Metadata Models
// ============================================================================

export interface ReportResultMetadata {
  rowCount: number;
  rowLimit: number;
  truncated: boolean;
  fileSizeBytes?: number;
  generatedAt: string;
  artifactExpiresAt: string;
}

export interface ReportExportJob {
  id: string;
  tenantId: string;
  reportType: ReportType;
  format: ReportFormat;
  status: ReportJobStatus;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  progress: number; // 0 to 100
  rowCount: number | null;
  rowLimit: number;
  truncated: boolean;
  artifactPath: string | null;
  artifactExpiresAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  zoneId: string | null;
  riderId: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
}

export interface ExportJobStatusResponse {
  job: ReportExportJob;
  downloadUrl?: string | null;
  isExpired?: boolean;
}

// ============================================================================
// 5. System Limits & Governance Invariants
// ============================================================================

export const REPORT_GOVERNANCE = {
  MAX_RANGE_DAYS: 90,
  MAX_ROW_LIMIT: 100000,
  MAX_CONCURRENT_JOBS_PER_TENANT: 2,
  ARTIFACT_TTL_HOURS: 24,
  MAX_PDF_ROWS_PER_SECTION: 50,
  DEFAULT_TIMEZONE: "Asia/Jakarta",
  BOUNDARY_SEMANTICS: "[start, end)",
} as const;
