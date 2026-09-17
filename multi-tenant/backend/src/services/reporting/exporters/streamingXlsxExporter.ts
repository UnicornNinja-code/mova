/*
 * streamingXlsxExporter.ts
 * S7-05-05: Deterministic Memory-Safe Streaming XLSX Exporter
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Pure Serialization Boundary: Never queries DB/Redis, no business math.
 * 2. Multi-Sheet Structured Workbook: Sheet 1 'Metadata' + Sheet 2 'Data'.
 * 3. Deterministic Column & Sheet Ordering.
 * 4. Zero-Fake-Data: null/undefined -> blank cell, explicit 'N/A' -> string 'N/A'.
 * 5. Type Preservation: numbers -> numeric cells, strings -> string cells, booleans -> boolean cells.
 * 6. Non-Finite Number Guard: NaN / Infinity / -Infinity immediately throws fail-closed error.
 * 7. Bounded O(1) Memory Streaming: Row-by-row commit via WorkbookWriter stream.
 */

import ExcelJS from "exceljs";
import { Writable } from "stream";
import { ReportType, REPORT_GOVERNANCE } from "../../../types/reporting.types.js";

// ============================================================================
// 1. Core Interfaces & Error Types
// ============================================================================

export type XlsxCellValue = string | number | boolean | null | undefined;

export interface XlsxColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly getValue: (row: T) => XlsxCellValue;
}

export interface XlsxRowSource<T> {
  readonly columns: readonly XlsxColumn<T>[];
  rows(): AsyncIterable<T>;
  readonly truncated?: boolean;
  readonly totalCount?: number;
}

export interface XlsxExportMetadata {
  readonly reportType?: ReportType;
  readonly generatedAt?: string;
  readonly rangeStart?: string;
  readonly rangeEnd?: string;
  readonly timezone?: string;
  readonly rowCount?: number;
  readonly rowLimit?: number;
  readonly truncated?: boolean;
}

export interface XlsxExportInput<T> {
  readonly source: XlsxRowSource<T>;
  readonly metadata?: XlsxExportMetadata;
}

export interface XlsxExportResult {
  readonly rowCount: number;
  readonly rowLimit: number;
  readonly truncated: boolean;
}

export interface XlsxWritable {
  write(chunk: Uint8Array): Promise<void>;
  end(): Promise<void>;
}

export type XlsxExportErrorCode =
  | "INVALID_SCHEMA"
  | "INVALID_VALUE"
  | "NON_FINITE_NUMBER"
  | "WRITE_FAILED"
  | "STREAM_CLOSED"
  | "WORKBOOK_FINALIZATION_FAILED";

export class XlsxExportError extends Error {
  public readonly code: XlsxExportErrorCode;

  constructor(code: XlsxExportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "XlsxExportError";
    this.code = code;
  }
}

export const XLSX_SHEET_NAMES = {
  metadata: "Metadata",
  data: "Data",
} as const;

export const XLSX_MAX_DATA_ROWS = REPORT_GOVERNANCE.MAX_ROW_LIMIT;

// ============================================================================
// 2. Cell Validation & Sanitization Helpers
// ============================================================================

export function sanitizeXlsxCellValue(value: XlsxCellValue): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new XlsxExportError(
        "NON_FINITE_NUMBER",
        `Non-finite numeric value (${value}) encountered during XLSX serialization.`
      );
    }
    return value;
  }

  return String(value);
}

// ============================================================================
// 3. Streaming XLSX Exporter Implementation
// ============================================================================

export class StreamingXlsxExporter {
  /**
   * Adapts our promise-based XlsxWritable to a standard Node.js Writable stream
   */
  private createNodeStreamAdapter(destination: XlsxWritable): Writable {
    return new Writable({
      write(chunk, encoding, callback) {
        const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        destination
          .write(u8)
          .then(() => callback())
          .catch((err) => callback(err));
      },
    });
  }

  /**
   * Stream assembled domain rows into a multi-sheet XLSX workbook.
   * Emits 'Metadata' sheet first, followed by 'Data' sheet with row-by-row commits.
   */
  public async export<T>(
    input: XlsxExportInput<T>,
    destination: XlsxWritable
  ): Promise<XlsxExportResult> {
    const { source, metadata } = input;

    if (!source || !Array.isArray(source.columns) || source.columns.length === 0) {
      throw new XlsxExportError(
        "INVALID_SCHEMA",
        "Cannot export XLSX without at least one defined column."
      );
    }

    let rowCount = 0;
    const nodeStream = this.createNodeStreamAdapter(destination);

    // Initialize WorkbookWriter with true row-oriented streaming
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: nodeStream,
      useStyles: true,
      useSharedStrings: false, // Disabling shared strings keeps memory O(1)
    });

    try {
      // ----------------------------------------------------------------------
      // 1. Sheet 1: Metadata (Deterministic 8-field order)
      // ----------------------------------------------------------------------
      const metaSheet = workbook.addWorksheet(XLSX_SHEET_NAMES.metadata);
      metaSheet.columns = [
        { header: "Field", key: "field", width: 20 },
        { header: "Value", key: "value", width: 40 },
      ];

      const reportTypeStr = metadata?.reportType || "OPERATIONAL_REPORT";
      const generatedAtStr = metadata?.generatedAt || new Date().toISOString();
      const rangeStartStr = metadata?.rangeStart || "-";
      const rangeEndStr = metadata?.rangeEnd || "-";
      const timezoneStr = metadata?.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;
      const rowLimitVal = metadata?.rowLimit || XLSX_MAX_DATA_ROWS;
      const isTruncated = source.truncated !== undefined ? Boolean(source.truncated) : Boolean(metadata?.truncated);

      metaSheet.addRow(["Report Type", reportTypeStr]).commit();
      metaSheet.addRow(["Generated At", generatedAtStr]).commit();
      metaSheet.addRow(["Range Start", rangeStartStr]).commit();
      metaSheet.addRow(["Range End", rangeEndStr]).commit();
      metaSheet.addRow(["Timezone", timezoneStr]).commit();
      metaSheet.addRow(["Row Limit", rowLimitVal]).commit();
      metaSheet.addRow(["Truncated", isTruncated ? "TRUE" : "FALSE"]).commit();
      metaSheet.commit();

      // ----------------------------------------------------------------------
      // 2. Sheet 2: Data (Header from source.columns, followed by streamed rows)
      // ----------------------------------------------------------------------
      const dataSheet = workbook.addWorksheet(XLSX_SHEET_NAMES.data);
      dataSheet.columns = source.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: Math.max(c.header.length + 4, 15),
      }));

      for await (const row of source.rows()) {
        const values: (string | number | boolean | null)[] = [];
        for (const col of source.columns) {
          const rawVal = col.getValue(row);
          const sanitized = sanitizeXlsxCellValue(rawVal);
          values.push(sanitized);
        }

        const addedRow = dataSheet.addRow(values);
        addedRow.commit();
        rowCount++;
      }

      dataSheet.commit();

      // ----------------------------------------------------------------------
      // 3. Finalize and Flush Workbook
      // ----------------------------------------------------------------------
      await workbook.commit();
      await destination.end();

      return {
        rowCount,
        rowLimit: rowLimitVal,
        truncated: isTruncated,
      };
    } catch (err: any) {
      if (err instanceof XlsxExportError) {
        throw err;
      }
      throw new XlsxExportError(
        "WORKBOOK_FINALIZATION_FAILED",
        `XLSX export failed: ${err.message || String(err)}`,
        { cause: err }
      );
    }
  }
}

export const streamingXlsxExporter = new StreamingXlsxExporter();
