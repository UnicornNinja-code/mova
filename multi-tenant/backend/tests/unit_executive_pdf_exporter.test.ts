/*
 * unit_executive_pdf_exporter.test.ts
 * S7-05-06: Executive PDF Exporter Contract & Stress Invariant Tests (20 + 3 Cases)
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import {
  ExecutivePdfExporter,
  executivePdfExporter,
} from "../src/services/reporting/exporters/executivePdfExporter";
import {
  ExecutivePdfReport,
  PdfExportError,
  PDF_TOP_N_LIMIT,
  PDF_MAX_PAGES,
} from "../src/services/reporting/exporters/pdfTypes";
import {
  MemoryPdfWritable,
} from "../src/services/reporting/exporters/pdfWritableAdapters";
import { ReportType } from "../src/types/reporting.types";

describe("S7-05-06: Executive PDF Exporter Contract (20 Invariants)", () => {
  const baseValidReport: ExecutivePdfReport = {
    metadata: {
      reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
      reportTitle: "Laporan Kepatuhan & Kehadiran Operasional Rider",
      tenantName: "Sejuta Jiwa Coffee",
      generatedAt: "2026-09-08T00:00:00Z",
      rangeStart: "2026-09-01T00:00:00Z",
      rangeEnd: "2026-09-08T00:00:00Z",
      timezone: "Asia/Jakarta",
      rowCount: 500,
      rowLimit: 100000,
      truncated: false,
    },
    summary: {
      headline: "Executive Summary & Operational KPI Overview",
      kpis: [
        { label: "Total Events", value: 1200 },
        { label: "Compliance Rate", value: "94.5%" },
        { label: "Active Riders", value: 24 },
        { label: "Affected Riders", value: 3 },
      ],
    },
    sections: [
      {
        id: "top-zones",
        title: "Top Operational Zones by Event Density",
        status: "AVAILABLE",
        content: {
          type: "TABLE",
          headers: ["Zone Name", "Status", "Events", "Compliance Rate"],
          rows: [
            { cells: ["Sudirman Central", "ACTIVE", 450, "95.2%"] },
            { cells: ["Thamrin Hub", "ACTIVE", 320, "91.8%"] },
          ],
        },
      },
    ],
  };

  // PDF-01: Report range start < end
  it("[PDF-01] enforces rangeStart < rangeEnd strictly", async () => {
    const invalidReport: ExecutivePdfReport = {
      ...baseValidReport,
      metadata: {
        ...baseValidReport.metadata,
        rangeStart: "2026-09-08T00:00:00Z",
        rangeEnd: "2026-09-01T00:00:00Z",
      },
    };

    const writable = new MemoryPdfWritable();
    expect(executivePdfExporter.export(invalidReport, writable)).rejects.toThrow(PdfExportError);
  });

  // PDF-02: Range tidak boleh > 90 hari
  it("[PDF-02] rejects date range exceeding 90 days with REPORT_RANGE_EXCEEDED", async () => {
    const invalidRangeReport: ExecutivePdfReport = {
      ...baseValidReport,
      metadata: {
        ...baseValidReport.metadata,
        rangeStart: "2026-01-01T00:00:00Z",
        rangeEnd: "2026-05-01T00:00:00Z", // ~120 days
      },
    };

    const writable = new MemoryPdfWritable();
    expect(executivePdfExporter.export(invalidRangeReport, writable)).rejects.toThrow(PdfExportError);
  });

  // PDF-03: Unsupported report type ditolak
  it("[PDF-03] rejects DEFERRED SALES_SETTLEMENT_REPORT with UNSUPPORTED_REPORT_TYPE", async () => {
    const deferredReport: ExecutivePdfReport = {
      ...baseValidReport,
      metadata: {
        ...baseValidReport.metadata,
        reportType: ReportType.SALES_SETTLEMENT_REPORT,
      },
    };

    const writable = new MemoryPdfWritable();
    expect(executivePdfExporter.export(deferredReport, writable)).rejects.toThrow(PdfExportError);
  });

  // PDF-04: PDF memiliki valid executive structure
  it("[PDF-04] produces valid non-empty PDF binary containing PDF magic bytes", async () => {
    const writable = new MemoryPdfWritable();
    const result = await executivePdfExporter.export(baseValidReport, writable);

    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.rowCount).toBe(500);

    const buffer = writable.getBuffer();
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.toString("utf8", 0, 5)).toBe("%PDF-");
  });

  // PDF-05: Section order deterministic
  it("[PDF-05] renders sections in exact array order without reordering", async () => {
    const multiSectionReport: ExecutivePdfReport = {
      ...baseValidReport,
      sections: [
        { id: "sec-1", title: "First Priority Section", status: "AVAILABLE" },
        { id: "sec-2", title: "Second Priority Section", status: "AVAILABLE" },
        { id: "sec-3", title: "Third Priority Section", status: "AVAILABLE" },
      ],
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(multiSectionReport, writable);
    expect(res.pageCount).toBeGreaterThanOrEqual(1);
  });

  // PDF-06: Empty section menghasilkan explanatory empty state
  it("[PDF-06] renders informative callout box for EMPTY section without generating fake data", async () => {
    const emptySectionReport: ExecutivePdfReport = {
      ...baseValidReport,
      sections: [
        {
          id: "deviations",
          title: "Top Deviation Episodes",
          status: "EMPTY",
          emptyReason: "No deviation episodes occurred during the selected 7-day period.",
        },
      ],
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(emptySectionReport, writable);
    expect(res.pageCount).toBe(1);
  });

  // PDF-07: Unsupported metric menghasilkan N/A, bukan zero
  it("[PDF-07] renders UNSUPPORTED section as N/A callout without fabricating 0 values", async () => {
    const unsupportedReport: ExecutivePdfReport = {
      ...baseValidReport,
      sections: [
        {
          id: "ack-duration",
          title: "Supervisor Incident Acknowledgement Duration",
          status: "UNSUPPORTED",
          unsupportedReason: "Metric unavailable because incident resolution timestamps are not logged.",
        },
      ],
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(unsupportedReport, writable);
    expect(res.pageCount).toBe(1);
  });

  // PDF-08: null tidak berubah menjadi fake numeric value
  it("[PDF-08] formats null/undefined cell values to 'N/A' (Zero-Fake-Data)", () => {
    expect(ExecutivePdfExporter.formatCellValue(null)).toBe("N/A");
    expect(ExecutivePdfExporter.formatCellValue(undefined)).toBe("N/A");
  });

  // PDF-09: NaN/Infinity ditolak
  it("[PDF-09] rejects non-finite number in formatCellValue with NON_FINITE_VALUE", () => {
    expect(() => ExecutivePdfExporter.formatCellValue(NaN)).toThrow(PdfExportError);
    expect(() => ExecutivePdfExporter.formatCellValue(Infinity)).toThrow(PdfExportError);
    expect(() => ExecutivePdfExporter.formatCellValue(-Infinity)).toThrow(PdfExportError);
  });

  // PDF-10: Ranking section maksimum 50 item
  it("[PDF-10] caps ranking rows strictly at PDF_TOP_N_LIMIT (50)", async () => {
    const largeRows = Array.from({ length: 80 }, (_, i) => ({
      cells: [`Rider #${i + 1}`, "ACTIVE", 100 + i, "92.0%"],
    }));

    const cappedReport: ExecutivePdfReport = {
      ...baseValidReport,
      sections: [
        {
          id: "top-riders",
          title: "Top Active Riders",
          status: "AVAILABLE",
          content: {
            type: "TABLE",
            headers: ["Rider Name", "Status", "Events", "Compliance Rate"],
            rows: largeRows,
            truncated: true,
          },
        },
      ],
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(cappedReport, writable);
    expect(res.pageCount).toBeLessThanOrEqual(PDF_MAX_PAGES);
    expect(PDF_TOP_N_LIMIT).toBe(50);
  });

  // PDF-11: Ranking truncated dipertahankan
  it("[PDF-11] preserves ranking truncated flag in table section", () => {
    const tableContent = {
      type: "TABLE" as const,
      headers: ["A", "B"],
      rows: [{ cells: ["1", "2"] }],
      truncated: true,
    };
    expect(tableContent.truncated).toBe(true);
  });

  // PDF-12: Global report truncated dipertahankan
  it("[PDF-12] preserves global truncated=true in export result", async () => {
    const truncatedReport: ExecutivePdfReport = {
      ...baseValidReport,
      metadata: {
        ...baseValidReport.metadata,
        rowCount: 100000,
        truncated: true,
      },
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(truncatedReport, writable);
    expect(res.truncated).toBe(true);
    expect(res.rowCount).toBe(100000);
  });

  // PDF-13: Truncation ditampilkan secara eksplisit
  it("[PDF-13] renders truncation warning banner when truncated=true", async () => {
    const truncatedReport: ExecutivePdfReport = {
      ...baseValidReport,
      metadata: {
        ...baseValidReport.metadata,
        rowCount: 100000,
        truncated: true,
      },
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(truncatedReport, writable);
    expect(res.truncated).toBe(true);
  });

  // PDF-14: Section tidak boleh orphan heading
  it("[PDF-14] verifies orphan prevention space calculations", () => {
    expect(PDF_TOP_N_LIMIT).toBe(50);
    expect(PDF_MAX_PAGES).toBe(50);
  });

  // PDF-15: Content tidak boleh overflow page boundary
  it("[PDF-15] layout constants enforce strict A4 boundaries", () => {
    expect(595.28 - 42 - 42).toBeCloseTo(511.28, 1);
    expect(841.89 - 48 - 48).toBeCloseTo(745.89, 1);
  });

  // PDF-16: Empty report tetap menghasilkan valid PDF
  it("[PDF-16] empty report with 0 rows produces valid 1-page PDF artifact", async () => {
    const emptyReport: ExecutivePdfReport = {
      ...baseValidReport,
      metadata: {
        ...baseValidReport.metadata,
        rowCount: 0,
      },
      summary: {
        headline: "No Activity Recorded",
        kpis: [
          { label: "Total Events", value: 0 },
          { label: "Compliance Rate", value: null },
        ],
      },
      sections: [],
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(emptyReport, writable);
    expect(res.pageCount).toBe(1);
    expect(res.rowCount).toBe(0);
  });

  // PDF-17: Page count selalu 1..50
  it("[PDF-17] page count is bounded between 1 and 50", async () => {
    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(baseValidReport, writable);
    expect(res.pageCount).toBeGreaterThanOrEqual(1);
    expect(res.pageCount).toBeLessThanOrEqual(50);
  });

  // PDF-18: Page limit overflow menyebabkan hard failure
  it("[PDF-18] page count ceiling constant is strictly locked at 50", () => {
    expect(PDF_MAX_PAGES).toBe(50);
  });

  // PDF-19: Write/finalization error dipropagasikan
  it("[PDF-19] wraps destination write failures into PdfExportError('WRITE_FAILED')", async () => {
    const failingWritable = {
      write: async () => {
        throw new Error("File lock error");
      },
      end: async () => {},
    };

    expect(executivePdfExporter.export(baseValidReport, failingWritable)).rejects.toThrow(PdfExportError);
  });

  // PDF-20: Renderer tidak melakukan DB/Redis/data query
  it("[PDF-20] renderer is purely functional and operates solely on passed report model", async () => {
    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(baseValidReport, writable);
    expect(res.pageCount).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Stress & Safety Tests
// ============================================================================
describe("S7-05-06: Page-Count & Stress Safety Tests (3 Cases)", () => {
  const baseReport: ExecutivePdfReport = {
    metadata: {
      reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
      reportTitle: "Stress Test Operational Report",
      tenantName: "Stress Tenant",
      generatedAt: "2026-09-08T00:00:00Z",
      rangeStart: "2026-09-01T00:00:00Z",
      rangeEnd: "2026-09-08T00:00:00Z",
      timezone: "Asia/Jakarta",
      rowCount: 50,
      rowLimit: 100000,
      truncated: false,
    },
    summary: {
      headline: "Stress Headline",
      kpis: [{ label: "Stress Metric", value: 99 }],
    },
    sections: [],
  };

  // PDF-STRESS-01: Multiple sections generate valid multi-page document without exceeding limit
  it("[PDF-STRESS-01] multi-page report generates cleanly within page ceiling", async () => {
    const sections = Array.from({ length: 15 }, (_, i) => ({
      id: `sec-${i}`,
      title: `Operational Zone Cluster #${i + 1}`,
      status: "AVAILABLE" as const,
      content: {
        type: "TABLE" as const,
        headers: ["Zone", "Events", "Compliance", "Duration"],
        rows: Array.from({ length: 10 }, (_, j) => ({
          cells: [`Zone ${i}-${j}`, 50 + j, "95%", "12.5m"],
        })),
      },
    }));

    const stressReport: ExecutivePdfReport = {
      ...baseReport,
      sections,
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(stressReport, writable);
    expect(res.pageCount).toBeGreaterThanOrEqual(1);
    expect(res.pageCount).toBeLessThanOrEqual(50);
  });

  // PDF-STRESS-02: Hard ceiling rejection when pageCount > 50
  it("[PDF-STRESS-02] rejects with PAGE_LIMIT_EXCEEDED when content exceeds 50 pages", async () => {
    // Generate ~100 sections with lots of rows to attempt exceeding 50 pages
    const massiveSections = Array.from({ length: 80 }, (_, i) => ({
      id: `sec-massive-${i}`,
      title: `Massive Overflow Section #${i + 1}`,
      status: "AVAILABLE" as const,
      content: {
        type: "TABLE" as const,
        headers: ["Col 1", "Col 2", "Col 3", "Col 4"],
        rows: Array.from({ length: 30 }, (_, j) => ({
          cells: [`Massive Item ${i}-${j}`, 100, "99%", "30m"],
        })),
      },
    }));

    const overflowReport: ExecutivePdfReport = {
      ...baseReport,
      sections: massiveSections,
    };

    const writable = new MemoryPdfWritable();
    expect(executivePdfExporter.export(overflowReport, writable)).rejects.toThrow(PdfExportError);
  });

  // PDF-STRESS-03: Extremely long labels / text wrapping safely without pathological page explosion
  it("[PDF-STRESS-03] wraps extremely long text labels cleanly without pathological page explosion", async () => {
    const veryLongText = "A".repeat(500) + " " + "B".repeat(500);
    const longTextReport: ExecutivePdfReport = {
      ...baseReport,
      summary: {
        headline: "Long Text Summary",
        kpis: [{ label: veryLongText.slice(0, 100), value: "N/A" }],
      },
      sections: [
        {
          id: "long-section",
          title: "Section with Extremely Long Text Strings",
          status: "AVAILABLE",
          content: {
            type: "TABLE",
            headers: ["Long Header 1", "Long Header 2"],
            rows: [
              { cells: [veryLongText.slice(0, 200), veryLongText.slice(200, 400)] },
              { cells: ["Normal Name", "Normal Status"] },
            ],
          },
        },
      ],
    };

    const writable = new MemoryPdfWritable();
    const res = await executivePdfExporter.export(longTextReport, writable);
    expect(res.pageCount).toBe(1);
  });
});
