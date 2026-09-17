/*
 * executivePdfExporter.ts
 * S7-05-06: Executive Presentation PDF Exporter Engine
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Pure Presentation Boundary: Never queries DB/Redis, no business computation.
 * 2. Executive Scope: Only handles READY reports (PRESENCE_COMPLIANCE, ZONE_PERFORMANCE, RIDER_DUTY).
 * 3. 90-Day Range Guard: Defensive validation against date range overflow.
 * 4. Top 50 Cap: Maximum 50 items per ranking/episode section.
 * 5. Hard Page Ceiling: Maximum 50 pages hard stop (PDF_PAGE_LIMIT_EXCEEDED).
 * 6. Zero-Fake-Data & N/A Semantics: null/unsupported metrics rendered as 'N/A' (never 0%).
 * 7. Multi-Page Streaming & Bounded Memory.
 */

import PDFDocument from "pdfkit";
import {
  isExecutableReportType,
  REPORT_GOVERNANCE,
} from "../../../types/reporting.types.js";
import {
  ExecutivePdfReport,
  PdfWritable,
  PdfExportResult,
  PdfExportError,
  PDF_LAYOUT,
  PDF_TOP_N_LIMIT,
  PDF_MAX_PAGES,
  MAX_REPORT_RANGE_DAYS,
  PdfReportSection,
  PdfTableContent,
} from "./pdfTypes.js";

export class ExecutivePdfExporter {
  /**
   * Helper to format cell values according to Zero-Fake-Data rules
   */
  public static formatCellValue(value: any): string {
    if (value === null || value === undefined) {
      return "N/A";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new PdfExportError(
          "NON_FINITE_VALUE",
          `Non-finite numeric value (${value}) encountered in PDF export.`
        );
      }
      return String(value);
    }
    return String(value);
  }

  /**
   * Defensive validation of report metadata, date ranges, and capability status
   */
  private validateReport(report: ExecutivePdfReport): void {
    if (!report || !report.metadata) {
      throw new PdfExportError("INVALID_REPORT", "Report or report metadata is missing.");
    }

    const { reportType, rangeStart, rangeEnd } = report.metadata;

    if (!isExecutableReportType(reportType)) {
      throw new PdfExportError(
        "UNSUPPORTED_REPORT_TYPE",
        `Report type '${reportType}' is deferred or unsupported by PDF exporter.`
      );
    }

    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new PdfExportError("INVALID_REPORT", "Invalid ISO timestamp in rangeStart or rangeEnd.");
    }

    if (start.getTime() >= end.getTime()) {
      throw new PdfExportError(
        "INVALID_REPORT",
        "rangeStart must be strictly before rangeEnd ([start, end) boundary)."
      );
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      throw new PdfExportError(
        "REPORT_RANGE_EXCEEDED",
        `Report range (${diffDays.toFixed(1)} days) exceeds maximum limit of ${MAX_REPORT_RANGE_DAYS} days.`
      );
    }

    // Defensive check on all KPIs for non-finite values
    if (report.summary?.kpis) {
      for (const kpi of report.summary.kpis) {
        if (typeof kpi.value === "number" && !Number.isFinite(kpi.value)) {
          throw new PdfExportError(
            "NON_FINITE_VALUE",
            `KPI '${kpi.label}' contains non-finite number: ${kpi.value}`
          );
        }
      }
    }
  }

  /**
   * Exports an assembled ExecutivePdfReport into the destination PdfWritable stream.
   */
  public async export(
    report: ExecutivePdfReport,
    destination: PdfWritable
  ): Promise<PdfExportResult> {
    this.validateReport(report);

    return new Promise<PdfExportResult>((resolve, reject) => {
      let isAborted = false;
      let recordedPageCount = 1;

      const doc = new PDFDocument({
        size: PDF_LAYOUT.pageSize,
        layout: PDF_LAYOUT.orientation,
        margins: PDF_LAYOUT.margins,
        bufferPages: true,
        info: {
          Title: report.metadata.reportTitle || "MOVA Executive Operational Report",
          Author: "MOVA Operational Intelligence Platform",
          Subject: report.metadata.reportType,
          CreationDate: new Date(report.metadata.generatedAt || Date.now()),
        },
      });

      // Abort helper
      const abort = (err: PdfExportError) => {
        if (isAborted) return;
        isAborted = true;
        doc.removeAllListeners();
        reject(err);
      };

      // Hook page added to enforce hard page ceiling (PDF_MAX_PAGES = 50)
      doc.on("pageAdded", () => {
        const currentCount = doc.bufferedPageRange().count;
        if (currentCount > PDF_MAX_PAGES) {
          abort(
            new PdfExportError(
              "PAGE_LIMIT_EXCEEDED",
              `Executive PDF exceeded safety ceiling of ${PDF_MAX_PAGES} pages.`
            )
          );
        }
      });

      // Pipe output chunks to destination
      doc.on("data", (chunk: Buffer) => {
        if (isAborted) return;
        destination.write(new Uint8Array(chunk)).catch((err) => {
          abort(
            new PdfExportError("WRITE_FAILED", `PDF write failed: ${err.message}`, {
              cause: err,
            })
          );
        });
      });

      doc.on("error", (err: Error) => {
        abort(
          new PdfExportError(
            "FINALIZATION_FAILED",
            `PDF rendering error: ${err.message}`,
            { cause: err }
          )
        );
      });

      doc.on("end", async () => {
        if (isAborted) return;
        try {
          await destination.end();
          resolve({
            pageCount: Math.max(1, recordedPageCount),
            rowCount: report.metadata.rowCount,
            rowLimit: report.metadata.rowLimit || REPORT_GOVERNANCE.MAX_ROW_LIMIT,
            truncated: Boolean(report.metadata.truncated),
          });
        } catch (err: any) {
          reject(
            new PdfExportError("WRITE_FAILED", `PDF stream end failed: ${err.message}`, {
              cause: err,
            })
          );
        }
      });

      try {
        // --------------------------------------------------------------------
        // 1. Executive Header & Branding
        // --------------------------------------------------------------------
        this.renderHeader(doc, report);

        // --------------------------------------------------------------------
        // 2. Global Truncation Warning Callout
        // --------------------------------------------------------------------
        if (report.metadata.truncated) {
          this.renderTruncationBanner(doc);
        }

        // --------------------------------------------------------------------
        // 3. Executive KPI Cards Grid
        // --------------------------------------------------------------------
        if (report.summary && report.summary.kpis && report.summary.kpis.length > 0) {
          this.renderKpiCards(doc, report.summary);
        }

        // --------------------------------------------------------------------
        // 4. Report Sections (Top Rankings, Deviations, Tables)
        // --------------------------------------------------------------------
        if (report.sections) {
          for (const section of report.sections) {
            if (isAborted) break;
            this.renderSection(doc, section);
          }
        }

        if (isAborted) return;

        // Capture total page count from buffered range before doc.end()
        recordedPageCount = doc.bufferedPageRange().count;

        // --------------------------------------------------------------------
        // 5. Post-Processing: Page Numbering & Footer ("Page X of Y")
        // --------------------------------------------------------------------
        this.renderFooters(doc, report);

        // Finalize document stream
        doc.end();
      } catch (err: any) {
        if (err instanceof PdfExportError) {
          abort(err);
        } else {
          abort(
            new PdfExportError(
              "FINALIZATION_FAILED",
              `Unexpected PDF rendering failure: ${err.message || String(err)}`,
              { cause: err }
            )
          );
        }
      }
    });
  }

  // ==========================================================================
  // Layout Rendering Modules
  // ==========================================================================

  private renderHeader(doc: typeof PDFDocument, report: ExecutivePdfReport): void {
    const { metadata } = report;
    const contentWidth = PDF_LAYOUT.contentWidth;

    // Header Title
    doc.fillColor("#0f172a").fontSize(18).font("Helvetica-Bold");
    doc.text(metadata.reportTitle || "MOVA Executive Operational Report", {
      width: contentWidth,
      align: "left",
    });

    doc.fillColor("#64748b").fontSize(9).font("Helvetica");
    doc.text(`Tenant: ${metadata.tenantName || "Sejuta Jiwa Coffee"} | Timezone: ${metadata.timezone}`, {
      width: contentWidth,
    });

    doc.text(`Period: ${metadata.rangeStart} to ${metadata.rangeEnd}`, {
      width: contentWidth,
    });

    doc.moveDown(0.8);
    // Divider line
    doc.strokeColor("#e2e8f0").lineWidth(1);
    doc.moveTo(PDF_LAYOUT.margins.left, doc.y).lineTo(PDF_LAYOUT.margins.left + contentWidth, doc.y).stroke();
    doc.moveDown(0.8);
  }

  private renderTruncationBanner(doc: typeof PDFDocument): void {
    const startX = PDF_LAYOUT.margins.left;
    const startY = doc.y;
    const width = PDF_LAYOUT.contentWidth;
    const height = 36;

    doc.rect(startX, startY, width, height).fill("#fffbeb").strokeColor("#fde68a").stroke();

    doc.fillColor("#b45309").fontSize(9).font("Helvetica-Bold");
    doc.text("⚠️ DATASET TRUNCATED AT 100,000 ROWS", startX + 10, startY + 8);

    doc.fillColor("#92400e").fontSize(8).font("Helvetica");
    doc.text(
      "This executive report represents a capped subset of 100,000 records. For complete raw access, consult data administrator.",
      startX + 10,
      startY + 20,
      { width: width - 20 }
    );

    doc.y = startY + height + 10;
  }

  private renderKpiCards(doc: typeof PDFDocument, summary: ExecutivePdfReport["summary"]): void {
    const kpis = summary.kpis;
    const contentWidth = PDF_LAYOUT.contentWidth;
    const cardWidth = (contentWidth - 12 * (Math.min(kpis.length, 4) - 1)) / Math.min(kpis.length, 4);
    const cardHeight = 52;

    doc.fillColor("#1e293b").fontSize(11).font("Helvetica-Bold");
    doc.text(summary.headline || "Executive Performance Summary", { width: contentWidth });
    doc.moveDown(0.4);

    let startX = PDF_LAYOUT.margins.left;
    const startY = doc.y;

    kpis.slice(0, 4).forEach((kpi, idx) => {
      const x = startX + idx * (cardWidth + 12);
      doc.rect(x, startY, cardWidth, cardHeight).fill("#f8fafc").strokeColor("#e2e8f0").stroke();

      doc.fillColor("#64748b").fontSize(8).font("Helvetica");
      doc.text(kpi.label, x + 8, startY + 8, { width: cardWidth - 16 });

      const displayVal = ExecutivePdfExporter.formatCellValue(kpi.value);
      doc.fillColor("#0f172a").fontSize(14).font("Helvetica-Bold");
      doc.text(displayVal + (kpi.unit ? ` ${kpi.unit}` : ""), x + 8, startY + 22, { width: cardWidth - 16 });
    });

    doc.y = startY + cardHeight + 14;
  }

  private renderSection(doc: typeof PDFDocument, section: PdfReportSection): void {
    const maxY = PDF_LAYOUT.pageHeight - PDF_LAYOUT.margins.bottom - 40;
    const headingHeight = 25;

    // Orphan Prevention Check
    if (doc.y + headingHeight + 40 > maxY) {
      doc.addPage();
    }

    // Section Title
    doc.fillColor("#0f172a").fontSize(12).font("Helvetica-Bold");
    doc.text(section.title, { width: PDF_LAYOUT.contentWidth });
    doc.moveDown(0.3);

    // Section State Handling
    if (section.status === "EMPTY") {
      this.renderCalloutBox(
        doc,
        "No Data Recorded",
        section.emptyReason || "No records or events were found for the selected time range.",
        "#f1f5f9",
        "#cbd5e1",
        "#475569"
      );
      return;
    }

    if (section.status === "UNSUPPORTED") {
      this.renderCalloutBox(
        doc,
        "Metric Unsupported (N/A)",
        section.unsupportedReason || "This metric is currently unsupported because underlying facts are not persistently logged.",
        "#fef2f2",
        "#fecaca",
        "#991b1b"
      );
      return;
    }

    if (section.content && section.content.type === "TABLE") {
      this.renderTable(doc, section.content);
    }
  }

  private renderCalloutBox(
    doc: typeof PDFDocument,
    title: string,
    message: string,
    bgColor: string,
    borderColor: string,
    textColor: string
  ): void {
    const startX = PDF_LAYOUT.margins.left;
    const startY = doc.y;
    const width = PDF_LAYOUT.contentWidth;
    const height = 36;

    doc.rect(startX, startY, width, height).fill(bgColor).strokeColor(borderColor).stroke();

    doc.fillColor(textColor).fontSize(9).font("Helvetica-Bold");
    doc.text(title, startX + 10, startY + 8);

    doc.fillColor(textColor).fontSize(8).font("Helvetica");
    doc.text(message, startX + 10, startY + 20, { width: width - 20 });

    doc.y = startY + height + 10;
  }

  private renderTable(doc: typeof PDFDocument, content: PdfTableContent): void {
    const headers = content.headers;
    // Cap table rows strictly at PDF_TOP_N_LIMIT (50)
    const rows = content.rows.slice(0, PDF_TOP_N_LIMIT);
    const contentWidth = PDF_LAYOUT.contentWidth;
    const colCount = headers.length;
    const colWidth = contentWidth / colCount;
    const rowHeight = 18;
    const maxY = PDF_LAYOUT.pageHeight - PDF_LAYOUT.margins.bottom - 20;

    // Header Row
    let startY = doc.y;
    doc.rect(PDF_LAYOUT.margins.left, startY, contentWidth, rowHeight).fill("#1e293b");

    doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
    headers.forEach((h, idx) => {
      doc.text(h, PDF_LAYOUT.margins.left + idx * colWidth + 4, startY + 5, {
        width: colWidth - 8,
        ellipsis: true,
      });
    });

    doc.y = startY + rowHeight;

    // Data Rows
    rows.forEach((r, rIdx) => {
      if (doc.y + rowHeight > maxY) {
        doc.addPage();
        // Redraw Header on new page
        startY = doc.y;
        doc.rect(PDF_LAYOUT.margins.left, startY, contentWidth, rowHeight).fill("#1e293b");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        headers.forEach((h, idx) => {
          doc.text(h, PDF_LAYOUT.margins.left + idx * colWidth + 4, startY + 5, {
            width: colWidth - 8,
            ellipsis: true,
          });
        });
        doc.y = startY + rowHeight;
      }

      const currentY = doc.y;
      const bg = rIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
      doc.rect(PDF_LAYOUT.margins.left, currentY, contentWidth, rowHeight).fill(bg).strokeColor("#e2e8f0").stroke();

      doc.fillColor("#1e293b").fontSize(8).font("Helvetica");
      r.cells.forEach((cell, cIdx) => {
        if (cIdx < colCount) {
          const displayVal = ExecutivePdfExporter.formatCellValue(cell);
          doc.text(displayVal, PDF_LAYOUT.margins.left + cIdx * colWidth + 4, currentY + 5, {
            width: colWidth - 8,
            ellipsis: true,
          });
        }
      });

      doc.y = currentY + rowHeight;
    });

    if (content.truncated || content.rows.length > PDF_TOP_N_LIMIT) {
      doc.moveDown(0.3);
      doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique");
      doc.text(`* Showing Top ${Math.min(content.rows.length, PDF_TOP_N_LIMIT)} records (Rankings capped).`, {
        width: contentWidth,
      });
    }

    doc.moveDown(0.8);
  }

  private renderFooters(doc: typeof PDFDocument, report: ExecutivePdfReport): void {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);

      const footerY = PDF_LAYOUT.pageHeight - PDF_LAYOUT.margins.bottom + 15;
      const contentWidth = PDF_LAYOUT.contentWidth;

      doc.strokeColor("#e2e8f0").lineWidth(0.5);
      doc.moveTo(PDF_LAYOUT.margins.left, footerY - 5).lineTo(PDF_LAYOUT.margins.left + contentWidth, footerY - 5).stroke();

      doc.fillColor("#94a3b8").fontSize(7).font("Helvetica");
      doc.text(
        `MOVA Operational Intelligence | Confidential Executive Report | Generated: ${report.metadata.generatedAt || "N/A"}`,
        PDF_LAYOUT.margins.left,
        footerY,
        { width: contentWidth / 2, align: "left" }
      );

      doc.text(
        `Page ${i + 1} of ${totalPages}`,
        PDF_LAYOUT.margins.left + contentWidth / 2,
        footerY,
        { width: contentWidth / 2, align: "right" }
      );
    }
  }
}

export const executivePdfExporter = new ExecutivePdfExporter();
