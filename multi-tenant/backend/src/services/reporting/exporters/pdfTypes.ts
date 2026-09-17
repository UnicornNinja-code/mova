/*
 * pdfTypes.ts
 * S7-05-06: Executive PDF Exporter Type Definitions & Contract Interfaces
 * MOVA Architecture
 */

import { ReportType, REPORT_GOVERNANCE } from "../../../types/reporting.types.js";

export const PDF_LAYOUT = {
  pageSize: "A4",
  orientation: "portrait",
  margins: {
    top: 48,
    right: 42,
    bottom: 48,
    left: 42,
  },
  pageWidth: 595.28,
  pageHeight: 841.89,
  contentWidth: 595.28 - 42 - 42, // 511.28 pt
  contentHeight: 841.89 - 48 - 48, // 745.89 pt
} as const;

export const PDF_TOP_N_LIMIT = 50;
export const PDF_MAX_PAGES = 50;
export const MAX_REPORT_RANGE_DAYS = REPORT_GOVERNANCE.MAX_RANGE_DAYS;

export interface PdfExportMetadata {
  readonly reportType: ReportType;
  readonly reportTitle?: string;
  readonly tenantName?: string;
  readonly generatedAt: string;
  readonly rangeStart: string;
  readonly rangeEnd: string;
  readonly timezone: string;
  readonly rowCount: number;
  readonly rowLimit: number;
  readonly truncated: boolean;
}

export interface PdfKpi {
  readonly label: string;
  readonly value: string | number | null;
  readonly unit?: string;
  readonly status?: "AVAILABLE" | "N/A";
  readonly hint?: string;
}

export interface PdfExecutiveSummary {
  readonly headline: string;
  readonly kpis: readonly PdfKpi[];
  readonly notes?: readonly string[];
}

export interface PdfTableRow {
  readonly cells: readonly (string | number | boolean | null | undefined)[];
}

export interface PdfTableContent {
  readonly type: "TABLE";
  readonly headers: readonly string[];
  readonly rows: readonly PdfTableRow[];
  readonly columnWidths?: readonly number[];
  readonly truncated?: boolean;
}

export interface PdfCalloutContent {
  readonly type: "CALLOUT";
  readonly message: string;
  readonly level?: "INFO" | "WARNING" | "NOTE";
}

export type PdfSectionContent = PdfTableContent | PdfCalloutContent;

export interface PdfReportSection {
  readonly id: string;
  readonly title: string;
  readonly status: "AVAILABLE" | "EMPTY" | "UNSUPPORTED";
  readonly content?: PdfSectionContent;
  readonly emptyReason?: string;
  readonly unsupportedReason?: string;
}

export interface ExecutivePdfReport {
  readonly metadata: PdfExportMetadata;
  readonly summary: PdfExecutiveSummary;
  readonly sections: readonly PdfReportSection[];
}

export interface PdfWritable {
  write(chunk: Uint8Array): Promise<void>;
  end(): Promise<void>;
}

export interface PdfExportResult {
  readonly pageCount: number;
  readonly rowCount: number;
  readonly rowLimit: number;
  readonly truncated: boolean;
}

export type PdfExportErrorCode =
  | "INVALID_REPORT"
  | "REPORT_RANGE_EXCEEDED"
  | "UNSUPPORTED_REPORT_TYPE"
  | "INVALID_SECTION"
  | "NON_FINITE_VALUE"
  | "PAGE_LIMIT_EXCEEDED"
  | "LAYOUT_OVERFLOW"
  | "WRITE_FAILED"
  | "FINALIZATION_FAILED";

export class PdfExportError extends Error {
  public readonly code: PdfExportErrorCode;

  constructor(code: PdfExportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PdfExportError";
    this.code = code;
  }
}
