/*
 * reportDataAssembler.ts
 * S7-05-03: Authoritative Report Query & Data Assembly Layer
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Consumes S7-03 Authoritative Semantics (HistoricalPresence, Zone, Rider Services).
 * 2. Zero-Fake-Data: Compliance rate is null when denominator is 0 (formatted as 'N/A', never '0%').
 * 3. Enforces Capability Registry: SALES_SETTLEMENT_REPORT is strictly rejected (DEFERRED).
 * 4. Memory-Safe Chunked Streaming for tabular exports up to 100,000 rows.
 * 5. Strict Session Multi-Tenant Isolation.
 */

import {
  ReportType,
  ReportFilter,
  REPORT_GOVERNANCE,
  isExecutableReportType,
} from "../../types/reporting.types.js";
import {
  ReportTypeNotAvailableError,
  validateReportFilter,
} from "../../lib/reporting/reportingStateMachine.js";
import { reportDataFetcher, PresenceEventRow } from "./reportDataFetcher.js";
import { historicalPresenceAnalyticsService } from "../analytics/HistoricalPresenceAnalyticsService.js";
import { historicalZoneAnalyticsService } from "../analytics/HistoricalZoneAnalyticsService.js";
import { historicalRiderAnalyticsService } from "../analytics/HistoricalRiderAnalyticsService.js";
import type {
  HistoricalAnalyticsFilter,
  ZoneHistoricalMetric,
  RiderHistoricalMetric,
} from "../../types/analytics.types.js";

export interface ReportHeaderMetadata {
  tenantName: string;
  tenantId: string;
  reportType: ReportType;
  reportTitle: string;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  generatedAt: string;
}

export interface PresenceComplianceSummaryKpi {
  totalEvents: number;
  compliantEvents: number;
  deviatedEvents: number;
  outsideEvents: number;
  unassignedEvents: number;
  complianceRate: number | null;
  complianceRateFormatted: string; // "94.5%" or "N/A"
  observedRiders: number;
  affectedRiders: number;
}

export interface PresenceComplianceReportData {
  metadata: ReportHeaderMetadata;
  kpi: PresenceComplianceSummaryKpi;
  streamPresenceRows: (
    onChunk: (chunk: PresenceEventRow[], index: number) => Promise<void> | void
  ) => Promise<{ totalRows: number; truncated: boolean }>;
}

export interface ZonePerformanceReportData {
  metadata: ReportHeaderMetadata;
  zones: ZoneHistoricalMetric[];
  totalZones: number;
  overallComplianceRate: number | null;
  overallComplianceRateFormatted: string;
}

export interface RiderDutyReportData {
  metadata: ReportHeaderMetadata;
  riders: RiderHistoricalMetric[];
  totalRiders: number;
  overallComplianceRate: number | null;
  overallComplianceRateFormatted: string;
}

export class ReportDataAssembler {
  /**
   * Helper to format compliance percentage with Zero-Fake-Data rule
   */
  public static formatComplianceRate(rate: number | null): string {
    if (rate === null || rate === undefined || isNaN(rate)) {
      return "N/A";
    }
    return `${(rate * 100).toFixed(1)}%`;
  }

  /**
   * Helper to convert ReportFilter to HistoricalAnalyticsFilter for S7-03 services
   */
  private toHistoricalFilter(filter: ReportFilter): HistoricalAnalyticsFilter {
    return {
      timeContext: {
        preset: "custom",
        grain: "day",
        rangeStart: filter.rangeStart,
        rangeEnd: filter.rangeEnd,
        timezone: filter.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE,
      },
      zoneId: filter.zoneId,
      riderId: filter.riderId,
    };
  }

  /**
   * Assemble PRESENCE_COMPLIANCE_REPORT dataset & metadata
   */
  public async assemblePresenceComplianceReport(
    tenantId: string,
    filter: ReportFilter
  ): Promise<PresenceComplianceReportData> {
    validateReportFilter(filter);
    const tz = filter.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;

    const [tenantName, summaryResult] = await Promise.all([
      reportDataFetcher.getTenantName(tenantId),
      historicalPresenceAnalyticsService.getPresenceSummary(
        tenantId,
        this.toHistoricalFilter(filter)
      ),
    ]);

    const metadata: ReportHeaderMetadata = {
      tenantName,
      tenantId,
      reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
      reportTitle: "Laporan Kepatuhan & Kehadiran Operasional Rider",
      rangeStart: filter.rangeStart,
      rangeEnd: filter.rangeEnd,
      timezone: tz,
      generatedAt: new Date().toISOString(),
    };

    const kpi: PresenceComplianceSummaryKpi = {
      totalEvents: summaryResult.presenceEvents,
      compliantEvents: summaryResult.compliance.compliantCount,
      deviatedEvents: summaryResult.compliance.deviatedCount,
      outsideEvents: summaryResult.compliance.outsideCount,
      unassignedEvents: summaryResult.compliance.unassignedCount,
      complianceRate: summaryResult.compliance.complianceRate,
      complianceRateFormatted: ReportDataAssembler.formatComplianceRate(
        summaryResult.compliance.complianceRate
      ),
      observedRiders: summaryResult.observedRiders,
      affectedRiders: summaryResult.affectedRidersCount,
    };

    return {
      metadata,
      kpi,
      streamPresenceRows: async (onChunk) => {
        return await reportDataFetcher.streamPresenceEvents(
          tenantId,
          filter,
          onChunk
        );
      },
    };
  }

  /**
   * Assemble ZONE_PERFORMANCE_REPORT dataset & metadata
   */
  public async assembleZonePerformanceReport(
    tenantId: string,
    filter: ReportFilter
  ): Promise<ZonePerformanceReportData> {
    validateReportFilter(filter);
    const tz = filter.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;

    const [tenantName, zoneSummary] = await Promise.all([
      reportDataFetcher.getTenantName(tenantId),
      historicalZoneAnalyticsService.getZoneSummary(
        tenantId,
        this.toHistoricalFilter(filter)
      ),
    ]);

    const metadata: ReportHeaderMetadata = {
      tenantName,
      tenantId,
      reportType: ReportType.ZONE_PERFORMANCE_REPORT,
      reportTitle: "Laporan Evaluasi Performa & Kepatuhan Zona Operasional",
      rangeStart: filter.rangeStart,
      rangeEnd: filter.rangeEnd,
      timezone: tz,
      generatedAt: new Date().toISOString(),
    };

    return {
      metadata,
      zones: zoneSummary.zones,
      totalZones: zoneSummary.totalZones,
      overallComplianceRate: zoneSummary.overallComplianceRate,
      overallComplianceRateFormatted: ReportDataAssembler.formatComplianceRate(
        zoneSummary.overallComplianceRate
      ),
    };
  }

  /**
   * Assemble RIDER_DUTY_REPORT dataset & metadata
   */
  public async assembleRiderDutyReport(
    tenantId: string,
    filter: ReportFilter
  ): Promise<RiderDutyReportData> {
    validateReportFilter(filter);
    const tz = filter.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;

    const [tenantName, riderSummary] = await Promise.all([
      reportDataFetcher.getTenantName(tenantId),
      historicalRiderAnalyticsService.getRiderSummary(
        tenantId,
        this.toHistoricalFilter(filter)
      ),
    ]);

    const metadata: ReportHeaderMetadata = {
      tenantName,
      tenantId,
      reportType: ReportType.RIDER_DUTY_REPORT,
      reportTitle: "Laporan Aktivitas Dinas & Kepatuhan Rider",
      rangeStart: filter.rangeStart,
      rangeEnd: filter.rangeEnd,
      timezone: tz,
      generatedAt: new Date().toISOString(),
    };

    return {
      metadata,
      riders: riderSummary.riders,
      totalRiders: riderSummary.totalRiders,
      overallComplianceRate: riderSummary.overallComplianceRate,
      overallComplianceRateFormatted: ReportDataAssembler.formatComplianceRate(
        riderSummary.overallComplianceRate
      ),
    };
  }

  /**
   * Unified Entry Point for Report Assembly
   * Guards against DEFERRED report types like SALES_SETTLEMENT_REPORT
   */
  public async assembleReport(
    reportType: ReportType,
    tenantId: string,
    filter: ReportFilter
  ): Promise<PresenceComplianceReportData | ZonePerformanceReportData | RiderDutyReportData> {
    if (!isExecutableReportType(reportType)) {
      throw new ReportTypeNotAvailableError(reportType);
    }

    switch (reportType) {
      case ReportType.PRESENCE_COMPLIANCE_REPORT:
        return await this.assemblePresenceComplianceReport(tenantId, filter);
      case ReportType.ZONE_PERFORMANCE_REPORT:
        return await this.assembleZonePerformanceReport(tenantId, filter);
      case ReportType.RIDER_DUTY_REPORT:
        return await this.assembleRiderDutyReport(tenantId, filter);
      default:
        throw new ReportTypeNotAvailableError(reportType);
    }
  }
}

export const reportDataAssembler = new ReportDataAssembler();
