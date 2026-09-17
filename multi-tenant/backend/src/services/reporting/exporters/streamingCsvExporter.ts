/*
 * streamingCsvExporter.ts
 * S7-05-04: Deterministic Memory-Safe Streaming CSV Exporter (RFC 4180)
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Pure Serialization Boundary: Never queries DB, Redis, or modifies domain state.
 * 2. Deterministic Column Order: Explicit ordered column schemas, never Object.keys().
 * 3. RFC 4180 Compliant: Comma delimiter, CRLF row terminators, double-quote escaping.
 * 4. Zero-Fake-Data & Null Semantics: null/undefined -> empty cell, explicit 'N/A' preserved.
 * 5. Non-Finite Number Guard: NaN / Infinity / -Infinity immediately throws fail-closed error.
 * 6. Asynchronous Backpressure: Awaits destination.write() chunk-by-chunk.
 */

import { ReportType } from "../../../types/reporting.types.js";

// ============================================================================
// 1. Core Interfaces & Error Types
// ============================================================================

export type CsvCellValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly getValue: (row: T) => CsvCellValue;
}

export interface CsvRowSource<T> {
  readonly columns: readonly CsvColumn<T>[];
  rows(): AsyncIterable<T>;
  readonly truncated?: boolean;
  readonly totalCount?: number;
}

export interface CsvExportMetadata {
  readonly reportType?: ReportType;
  readonly generatedAt?: string;
  readonly rangeStart?: string;
  readonly rangeEnd?: string;
  readonly timezone?: string;
  readonly rowCount?: number;
  readonly rowLimit?: number;
  readonly truncated?: boolean;
}

export interface CsvExportInput<T> {
  readonly source: CsvRowSource<T>;
  readonly metadata?: CsvExportMetadata;
}

export interface CsvExportResult {
  readonly rowCount: number;
  readonly truncated: boolean;
}

export interface CsvWritable {
  write(chunk: string): Promise<void>;
  end(): Promise<void>;
}

export type CsvExportErrorCode =
  | "INVALID_SCHEMA"
  | "INVALID_VALUE"
  | "NON_FINITE_NUMBER"
  | "WRITE_FAILED"
  | "STREAM_CLOSED";

export class CsvExportError extends Error {
  public readonly code: CsvExportErrorCode;

  constructor(code: CsvExportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CsvExportError";
    this.code = code;
  }
}

// ============================================================================
// 2. RFC 4180 Escaping & Cell Serializer
// ============================================================================

/**
 * Serializes a single cell value according to RFC 4180 and Zero-Fake-Data rules.
 */
export function serializeCsvCell(value: CsvCellValue): string {
  // Null and undefined map to empty field
  if (value === null || value === undefined) {
    return "";
  }

  // Boolean serialization
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  // Number serialization with non-finite safety guard
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CsvExportError(
        "NON_FINITE_NUMBER",
        `Non-finite numeric value (${value}) encountered during CSV serialization.`
      );
    }
    return String(value);
  }

  // String serialization with RFC 4180 escaping
  const str = String(value);
  const needsQuotes =
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\r") ||
    str.includes("\n");

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes an entire row array to a CRLF-terminated line.
 */
export function serializeCsvRow(cells: CsvCellValue[]): string {
  return cells.map(serializeCsvCell).join(",") + "\r\n";
}

// ============================================================================
// 3. Streaming CSV Exporter Implementation
// ============================================================================

export class StreamingCsvExporter {
  public static readonly DEFAULT_CHUNK_FLUSH_ROWS = 50;

  /**
   * Stream assembled domain rows to destination CsvWritable.
   * Emits header exactly once, streams rows with backpressure, and returns result metadata.
   */
  public async export<T>(
    input: CsvExportInput<T>,
    destination: CsvWritable
  ): Promise<CsvExportResult> {
    const { source } = input;

    if (!source || !Array.isArray(source.columns) || source.columns.length === 0) {
      throw new CsvExportError(
        "INVALID_SCHEMA",
        "Cannot export CSV without at least one defined column."
      );
    }

    let rowCount = 0;
    let buffer = "";

    try {
      // 1. Emit Header Line (CRLF terminated)
      const headerLine = source.columns.map((c) => serializeCsvCell(c.header)).join(",") + "\r\n";
      await destination.write(headerLine);

      // 2. Stream Data Rows with Bounded Chunk Buffering
      for await (const row of source.rows()) {
        const cells = source.columns.map((col) => col.getValue(row));
        buffer += serializeCsvRow(cells);
        rowCount++;

        if (rowCount % StreamingCsvExporter.DEFAULT_CHUNK_FLUSH_ROWS === 0) {
          await destination.write(buffer);
          buffer = "";
        }
      }

      // 3. Flush any remaining buffered data
      if (buffer.length > 0) {
        await destination.write(buffer);
        buffer = "";
      }

      // 4. Finalize Destination Stream
      await destination.end();

      const truncated = Boolean(source.truncated);
      return {
        rowCount,
        truncated,
      };
    } catch (err: any) {
      if (err instanceof CsvExportError) {
        throw err;
      }
      throw new CsvExportError(
        "WRITE_FAILED",
        `CSV streaming write failed: ${err.message || String(err)}`,
        { cause: err }
      );
    }
  }
}

export const streamingCsvExporter = new StreamingCsvExporter();

// ============================================================================
// 4. Canonical Column Schemas for MOVA Reports
// ============================================================================

import type { PresenceEventRow } from "../reportDataFetcher.js";
import type { ZoneHistoricalMetric, RiderHistoricalMetric } from "../../../types/analytics.types.js";
import { ReportDataAssembler } from "../reportDataAssembler.js";

export const PRESENCE_COMPLIANCE_CSV_COLUMNS: readonly CsvColumn<PresenceEventRow>[] = [
  {
    key: "capturedAtFormatted",
    header: "Timestamp",
    getValue: (row) => row.capturedAtFormatted,
  },
  {
    key: "riderName",
    header: "Rider Name",
    getValue: (row) => row.riderName,
  },
  {
    key: "riderEmail",
    header: "Rider Email",
    getValue: (row) => row.riderEmail,
  },
  {
    key: "assignedZoneName",
    header: "Assigned Zone",
    getValue: (row) => row.assignedZoneName,
  },
  {
    key: "observedZoneName",
    header: "Observed Zone",
    getValue: (row) => row.observedZoneName,
  },
  {
    key: "eventType",
    header: "Event Type",
    getValue: (row) => row.eventType,
  },
  {
    key: "complianceStatus",
    header: "Compliance Status",
    getValue: (row) => row.complianceStatus,
  },
  {
    key: "latitude",
    header: "Latitude",
    getValue: (row) => row.latitude,
  },
  {
    key: "longitude",
    header: "Longitude",
    getValue: (row) => row.longitude,
  },
] as const;

export const ZONE_PERFORMANCE_CSV_COLUMNS: readonly CsvColumn<ZoneHistoricalMetric>[] = [
  {
    key: "zoneName",
    header: "Zone Name",
    getValue: (row) => row.zoneName,
  },
  {
    key: "status",
    header: "Status",
    getValue: (row) => row.status,
  },
  {
    key: "totalEvents",
    header: "Total Events",
    getValue: (row) => row.totalEvents,
  },
  {
    key: "compliantCount",
    header: "Compliant Events",
    getValue: (row) => row.compliantCount,
  },
  {
    key: "deviatedCount",
    header: "Deviated Events",
    getValue: (row) => row.deviatedCount,
  },
  {
    key: "complianceRate",
    header: "Compliance Rate",
    getValue: (row) => ReportDataAssembler.formatComplianceRate(row.complianceRate),
  },
  {
    key: "observedRiders",
    header: "Observed Riders",
    getValue: (row) => row.observedRiders,
  },
  {
    key: "affectedRiders",
    header: "Affected Riders",
    getValue: (row) => row.affectedRiders,
  },
  {
    key: "deviationEpisodes",
    header: "Deviation Episodes",
    getValue: (row) => row.deviationEpisodes,
  },
  {
    key: "avgDeviationDurationMinutes",
    header: "Avg Deviation Duration (Min)",
    getValue: (row) =>
      row.avgDeviationDurationMinutes !== null && row.avgDeviationDurationMinutes !== undefined
        ? row.avgDeviationDurationMinutes
        : null,
  },
] as const;

export const RIDER_DUTY_CSV_COLUMNS: readonly CsvColumn<RiderHistoricalMetric>[] = [
  {
    key: "riderName",
    header: "Rider Name",
    getValue: (row) => row.riderName,
  },
  {
    key: "email",
    header: "Email",
    getValue: (row) => row.email,
  },
  {
    key: "activeDutyDays",
    header: "Active Duty Days",
    getValue: (row) => row.activeDutyDays,
  },
  {
    key: "assignedZones",
    header: "Assigned Zones",
    getValue: (row) => row.assignedZones.join("; "),
  },
  {
    key: "observedZones",
    header: "Observed Zones",
    getValue: (row) => row.observedZones.join("; "),
  },
  {
    key: "totalEvents",
    header: "Total Events",
    getValue: (row) => row.totalEvents,
  },
  {
    key: "compliantCount",
    header: "Compliant Events",
    getValue: (row) => row.compliantCount,
  },
  {
    key: "deviatedCount",
    header: "Deviated Events",
    getValue: (row) => row.deviatedCount,
  },
  {
    key: "complianceRate",
    header: "Compliance Rate",
    getValue: (row) => ReportDataAssembler.formatComplianceRate(row.complianceRate),
  },
  {
    key: "topDeviationZone",
    header: "Top Deviation Zone",
    getValue: (row) => row.topDeviationZone || "-",
  },
] as const;
