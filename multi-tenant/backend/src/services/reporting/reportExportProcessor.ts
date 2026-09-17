/*
 * reportExportProcessor.ts
 * S7-05-07: Asynchronous Report Export Execution Processor
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Orchestrates Assembler -> Exporters -> Repository -> Artifact Persistence.
 * 2. Fail-Closed Failure Handling: Unlinks partial corrupted artifact files on failure.
 * 3. 24-Hour TTL Expiration Calculation.
 * 4. Atomic Canonical State Machine Transitions: QUEUED -> PROCESSING -> COMPLETED | FAILED.
 */

import fs from "fs";
import { ReportType, ReportFormat } from "../../types/reporting.types.js";
import { reportJobRepository } from "../../repositories/reportJobRepository.js";
import { reportResourceGovernor } from "./reportResourceGovernor.js";
import {
  reportDataAssembler,
  PresenceComplianceReportData,
  ZonePerformanceReportData,
  RiderDutyReportData,
} from "./reportDataAssembler.js";
import {
  streamingCsvExporter,
  PRESENCE_COMPLIANCE_CSV_COLUMNS,
  ZONE_PERFORMANCE_CSV_COLUMNS,
  RIDER_DUTY_CSV_COLUMNS,
} from "./exporters/streamingCsvExporter.js";
import { FileStreamCsvWritable } from "./exporters/csvWritableAdapters.js";
import { streamingXlsxExporter } from "./exporters/streamingXlsxExporter.js";
import { FileStreamXlsxWritable } from "./exporters/xlsxWritableAdapters.js";
import { executivePdfExporter } from "./exporters/executivePdfExporter.js";
import { FileStreamPdfWritable } from "./exporters/pdfWritableAdapters.js";
import type { ExecutivePdfReport } from "./exporters/pdfTypes.js";
import { PresenceEventRow } from "./reportDataFetcher.js";

export class ReportExportProcessor {
  /**
   * Main processor function executed by BullMQ Worker
   */
  public async processExportJob(jobId: string, tenantId: string): Promise<void> {
    // 1. Fetch persisted job record
    const job = await reportJobRepository.findById(jobId, tenantId);
    if (!job) {
      throw new Error(`Export job '${jobId}' for tenant '${tenantId}' not found.`);
    }

    // 2. Atomically transition state: QUEUED -> PROCESSING
    await reportJobRepository.markProcessing(jobId, tenantId);

    // 3. Resolve physical artifact storage path
    const artifactPath = reportResourceGovernor.resolveArtifactPath(tenantId, jobId, job.format);

    try {
      const filter = {
        rangeStart: job.rangeStart,
        rangeEnd: job.rangeEnd,
        timezone: job.timezone,
        zoneId: job.zoneId || undefined,
        riderId: job.riderId || undefined,
      };

      // 4. Assemble authoritative report data
      const assembledData = await reportDataAssembler.assembleReport(
        job.reportType,
        tenantId,
        filter
      );

      let rowCount = 0;
      let truncated = false;

      // 5. Execute format-specific streaming export
      switch (job.format) {
        case ReportFormat.CSV: {
          const destination = new FileStreamCsvWritable(artifactPath);
          const result = await this.exportCsv(job.reportType, assembledData, destination);
          rowCount = result.rowCount;
          truncated = result.truncated;
          break;
        }

        case ReportFormat.XLSX: {
          const destination = new FileStreamXlsxWritable(artifactPath);
          const result = await this.exportXlsx(job.reportType, assembledData, destination);
          rowCount = result.rowCount;
          truncated = result.truncated;
          break;
        }

        case ReportFormat.PDF: {
          const destination = new FileStreamPdfWritable(artifactPath);
          const result = await this.exportPdf(job.reportType, assembledData, destination);
          rowCount = result.rowCount;
          truncated = result.truncated;
          break;
        }

        default:
          throw new Error(`Unsupported format: ${job.format}`);
      }

      // 6. Calculate 24h expiration timestamp and mark job as COMPLETED
      const artifactExpiresAt = reportResourceGovernor.calculateArtifactExpiration();
      await reportJobRepository.markCompleted(jobId, tenantId, {
        rowCount,
        rowLimit: job.rowLimit,
        truncated,
        artifactPath,
        artifactExpiresAt,
      });
    } catch (err: any) {
      // Clean up partial artifact file on disk to maintain zero corrupted artifacts rule
      if (fs.existsSync(artifactPath)) {
        try {
          fs.unlinkSync(artifactPath);
        } catch {
          // ignore unlink error
        }
      }

      // Atomically mark job as FAILED
      const errorCode = err.code || "EXPORT_PROCESSING_FAILED";
      const errorMessage = err.message || String(err);
      await reportJobRepository.markFailed(jobId, tenantId, errorCode, errorMessage);

      throw err;
    }
  }

  // ==========================================================================
  // Format Exporter Bridges
  // ==========================================================================

  private async exportCsv(
    reportType: ReportType,
    data: any,
    destination: FileStreamCsvWritable
  ): Promise<{ rowCount: number; truncated: boolean }> {
    switch (reportType) {
      case ReportType.PRESENCE_COMPLIANCE_REPORT: {
        const presenceData = data as PresenceComplianceReportData;
        let isTruncated = false;
        let total = 0;

        const source = {
          columns: PRESENCE_COMPLIANCE_CSV_COLUMNS,
          async *rows() {
            let buffer: PresenceEventRow[] = [];
            const result = await presenceData.streamPresenceRows(async (chunk) => {
              buffer.push(...chunk);
            });
            isTruncated = result.truncated;
            total = result.totalRows;

            for (const row of buffer) {
              yield row;
            }
          },
          get truncated() {
            return isTruncated;
          },
          get totalCount() {
            return total;
          },
        };

        return await streamingCsvExporter.export({ source }, destination);
      }

      case ReportType.ZONE_PERFORMANCE_REPORT: {
        const zoneData = data as ZonePerformanceReportData;
        const source = {
          columns: ZONE_PERFORMANCE_CSV_COLUMNS,
          async *rows() {
            for (const zone of zoneData.zones) {
              yield zone;
            }
          },
          truncated: false,
          totalCount: zoneData.totalZones,
        };

        return await streamingCsvExporter.export({ source }, destination);
      }

      case ReportType.RIDER_DUTY_REPORT: {
        const riderData = data as RiderDutyReportData;
        const source = {
          columns: RIDER_DUTY_CSV_COLUMNS,
          async *rows() {
            for (const rider of riderData.riders) {
              yield rider;
            }
          },
          truncated: false,
          totalCount: riderData.totalRiders,
        };

        return await streamingCsvExporter.export({ source }, destination);
      }

      default:
        throw new Error(`Unsupported report type for CSV: ${reportType}`);
    }
  }

  private async exportXlsx(
    reportType: ReportType,
    data: any,
    destination: FileStreamXlsxWritable
  ): Promise<{ rowCount: number; truncated: boolean }> {
    switch (reportType) {
      case ReportType.PRESENCE_COMPLIANCE_REPORT: {
        const presenceData = data as PresenceComplianceReportData;
        let isTruncated = false;
        let total = 0;

        const source = {
          columns: PRESENCE_COMPLIANCE_CSV_COLUMNS.map((c) => ({
            key: c.key,
            header: c.header,
            getValue: (row: any) => c.getValue(row),
          })),
          async *rows() {
            let buffer: PresenceEventRow[] = [];
            const result = await presenceData.streamPresenceRows(async (chunk) => {
              buffer.push(...chunk);
            });
            isTruncated = result.truncated;
            total = result.totalRows;

            for (const row of buffer) {
              yield row;
            }
          },
          get truncated() {
            return isTruncated;
          },
          get totalCount() {
            return total;
          },
        };

        return await streamingXlsxExporter.export(
          {
            source,
            metadata: {
              reportType,
              generatedAt: presenceData.metadata.generatedAt,
              rangeStart: presenceData.metadata.rangeStart,
              rangeEnd: presenceData.metadata.rangeEnd,
              timezone: presenceData.metadata.timezone,
            },
          },
          destination
        );
      }

      case ReportType.ZONE_PERFORMANCE_REPORT: {
        const zoneData = data as ZonePerformanceReportData;
        const source = {
          columns: ZONE_PERFORMANCE_CSV_COLUMNS.map((c) => ({
            key: c.key,
            header: c.header,
            getValue: (row: any) => c.getValue(row),
          })),
          async *rows() {
            for (const zone of zoneData.zones) {
              yield zone;
            }
          },
          truncated: false,
          totalCount: zoneData.totalZones,
        };

        return await streamingXlsxExporter.export(
          {
            source,
            metadata: {
              reportType,
              generatedAt: zoneData.metadata.generatedAt,
              rangeStart: zoneData.metadata.rangeStart,
              rangeEnd: zoneData.metadata.rangeEnd,
              timezone: zoneData.metadata.timezone,
            },
          },
          destination
        );
      }

      case ReportType.RIDER_DUTY_REPORT: {
        const riderData = data as RiderDutyReportData;
        const source = {
          columns: RIDER_DUTY_CSV_COLUMNS.map((c) => ({
            key: c.key,
            header: c.header,
            getValue: (row: any) => c.getValue(row),
          })),
          async *rows() {
            for (const rider of riderData.riders) {
              yield rider;
            }
          },
          truncated: false,
          totalCount: riderData.totalRiders,
        };

        return await streamingXlsxExporter.export(
          {
            source,
            metadata: {
              reportType,
              generatedAt: riderData.metadata.generatedAt,
              rangeStart: riderData.metadata.rangeStart,
              rangeEnd: riderData.metadata.rangeEnd,
              timezone: riderData.metadata.timezone,
            },
          },
          destination
        );
      }

      default:
        throw new Error(`Unsupported report type for XLSX: ${reportType}`);
    }
  }

  private async exportPdf(
    reportType: ReportType,
    data: any,
    destination: FileStreamPdfWritable
  ): Promise<{ rowCount: number; truncated: boolean }> {
    let pdfReport: ExecutivePdfReport;

    switch (reportType) {
      case ReportType.PRESENCE_COMPLIANCE_REPORT: {
        const presenceData = data as PresenceComplianceReportData;
        pdfReport = {
          metadata: {
            reportType,
            reportTitle: presenceData.metadata.reportTitle,
            tenantName: presenceData.metadata.tenantName,
            generatedAt: presenceData.metadata.generatedAt,
            rangeStart: presenceData.metadata.rangeStart,
            rangeEnd: presenceData.metadata.rangeEnd,
            timezone: presenceData.metadata.timezone,
            rowCount: presenceData.kpi.totalEvents,
            rowLimit: 100000,
            truncated: false,
          },
          summary: {
            headline: "Ringkasan Eksekutif Kehadiran & Kepatuhan Operasional",
            kpis: [
              { label: "Total Events", value: presenceData.kpi.totalEvents },
              { label: "Compliant Events", value: presenceData.kpi.compliantEvents },
              { label: "Deviated Events", value: presenceData.kpi.deviatedEvents },
              {
                label: "Compliance Rate",
                value: presenceData.kpi.complianceRateFormatted,
              },
            ],
          },
          sections: [
            {
              id: "presence-summary",
              title: "Status Observasi Rider",
              status: "AVAILABLE",
              content: {
                type: "CALLOUT",
                message: `Sebanyak ${presenceData.kpi.observedRiders} rider terobservasi aktif dengan ${presenceData.kpi.affectedRiders} rider terdampak deviasi geofence.`,
                level: "INFO",
              },
            },
          ],
        };
        break;
      }

      case ReportType.ZONE_PERFORMANCE_REPORT: {
        const zoneData = data as ZonePerformanceReportData;
        const rows = zoneData.zones.map((z) => ({
          cells: [
            z.zoneName,
            z.status,
            z.totalEvents,
            z.compliantCount,
            z.deviatedCount,
            z.complianceRate !== null ? `${(z.complianceRate * 100).toFixed(1)}%` : "N/A",
          ],
        }));

        pdfReport = {
          metadata: {
            reportType,
            reportTitle: zoneData.metadata.reportTitle,
            tenantName: zoneData.metadata.tenantName,
            generatedAt: zoneData.metadata.generatedAt,
            rangeStart: zoneData.metadata.rangeStart,
            rangeEnd: zoneData.metadata.rangeEnd,
            timezone: zoneData.metadata.timezone,
            rowCount: zoneData.totalZones,
            rowLimit: 100000,
            truncated: false,
          },
          summary: {
            headline: "Evaluasi Kinerja Zona Operasional",
            kpis: [
              { label: "Total Zones", value: zoneData.totalZones },
              { label: "Overall Compliance", value: zoneData.overallComplianceRateFormatted },
            ],
          },
          sections: [
            {
              id: "zone-performance-table",
              title: "Peringkat Kepatuhan Zona Operasional (Top 50)",
              status: rows.length > 0 ? "AVAILABLE" : "EMPTY",
              emptyReason: "Tidak ada zona operasional yang tercatat.",
              content: {
                type: "TABLE",
                headers: ["Zona", "Status", "Events", "Compliant", "Deviated", "Compliance Rate"],
                rows,
              },
            },
          ],
        };
        break;
      }

      case ReportType.RIDER_DUTY_REPORT: {
        const riderData = data as RiderDutyReportData;
        const rows = riderData.riders.map((r) => ({
          cells: [
            r.riderName,
            r.activeDutyDays,
            r.assignedZones.join(", ") || "-",
            r.totalEvents,
            r.complianceRate !== null ? `${(r.complianceRate * 100).toFixed(1)}%` : "N/A",
          ],
        }));

        pdfReport = {
          metadata: {
            reportType,
            reportTitle: riderData.metadata.reportTitle,
            tenantName: riderData.metadata.tenantName,
            generatedAt: riderData.metadata.generatedAt,
            rangeStart: riderData.metadata.rangeStart,
            rangeEnd: riderData.metadata.rangeEnd,
            timezone: riderData.metadata.timezone,
            rowCount: riderData.totalRiders,
            rowLimit: 100000,
            truncated: false,
          },
          summary: {
            headline: "Evaluasi Aktivitas Dinas & Kepatuhan Rider",
            kpis: [
              { label: "Total Active Riders", value: riderData.totalRiders },
              { label: "Overall Compliance", value: riderData.overallComplianceRateFormatted },
            ],
          },
          sections: [
            {
              id: "rider-duty-table",
              title: "Log Kedinasan & Kepatuhan Rider (Top 50)",
              status: rows.length > 0 ? "AVAILABLE" : "EMPTY",
              emptyReason: "Tidak ada rider yang bertugas pada periode ini.",
              content: {
                type: "TABLE",
                headers: ["Rider Name", "Duty Days", "Assigned Zones", "Events", "Compliance Rate"],
                rows,
              },
            },
          ],
        };
        break;
      }

      default:
        throw new Error(`Unsupported report type for PDF: ${reportType}`);
    }

    const result = await executivePdfExporter.export(pdfReport, destination);
    return {
      rowCount: result.rowCount,
      truncated: result.truncated,
    };
  }
}

export const reportExportProcessor = new ReportExportProcessor();
