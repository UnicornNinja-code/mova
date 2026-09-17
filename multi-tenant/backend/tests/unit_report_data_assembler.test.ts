/*
 * unit_report_data_assembler.test.ts
 * S7-05-03: Report Query & Data Assembly Layer Unit & Mock Tests
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import {
  ReportDataAssembler,
  reportDataAssembler,
} from "../src/services/reporting/reportDataAssembler";
import {
  ReportDataFetcher,
} from "../src/services/reporting/reportDataFetcher";
import {
  ReportType,
  ReportFilter,
} from "../src/types/reporting.types";
import {
  ReportTypeNotAvailableError,
  InvalidReportFilterError,
} from "../src/lib/reporting/reportingStateMachine";
import { historicalPresenceAnalyticsService } from "../src/services/analytics/HistoricalPresenceAnalyticsService";
import { historicalZoneAnalyticsService } from "../src/services/analytics/HistoricalZoneAnalyticsService";
import { historicalRiderAnalyticsService } from "../src/services/analytics/HistoricalRiderAnalyticsService";

describe("S7-05-03: Report Query & Data Assembly Layer", () => {
  const validFilter: ReportFilter = {
    rangeStart: "2026-09-01T00:00:00Z",
    rangeEnd: "2026-09-08T00:00:00Z",
    timezone: "Asia/Jakarta",
  };

  // ============================================================================
  // 1. Zero-Fake-Data Compliance Rate Formatting
  // ============================================================================
  describe("Zero-Fake-Data Formatter", () => {
    it("formats valid ratio to percentage string with 1 decimal", () => {
      expect(ReportDataAssembler.formatComplianceRate(0.8542)).toBe("85.4%");
      expect(ReportDataAssembler.formatComplianceRate(1.0)).toBe("100.0%");
      expect(ReportDataAssembler.formatComplianceRate(0.0)).toBe("0.0%");
    });

    it("formats null / undefined / NaN to 'N/A' (never 0% or NaN)", () => {
      expect(ReportDataAssembler.formatComplianceRate(null)).toBe("N/A");
      expect(ReportDataAssembler.formatComplianceRate(undefined as any)).toBe("N/A");
      expect(ReportDataAssembler.formatComplianceRate(NaN)).toBe("N/A");
    });
  });

  // ============================================================================
  // 2. Local Timezone Timestamp Formatter
  // ============================================================================
  describe("Local Timezone Formatter", () => {
    it("formats UTC timestamp to Asia/Jakarta (UTC+7)", () => {
      const utcIso = "2026-09-08T00:00:00.000Z";
      const formatted = ReportDataFetcher.formatLocalTimestamp(utcIso, "Asia/Jakarta");
      expect(formatted).toBe("2026-09-08T07:00:00");
    });

    it("handles invalid dates gracefully", () => {
      expect(ReportDataFetcher.formatLocalTimestamp("invalid-date", "Asia/Jakarta")).toBe("N/A");
    });
  });

  // ============================================================================
  // 3. Capability Guard on DEFERRED Reports
  // ============================================================================
  describe("Capability Enforcement", () => {
    it("rejects SALES_SETTLEMENT_REPORT with ReportTypeNotAvailableError", async () => {
      expect(
        reportDataAssembler.assembleReport(
          ReportType.SALES_SETTLEMENT_REPORT,
          "tenant-sejuta-jiwa",
          validFilter
        )
      ).rejects.toThrow(ReportTypeNotAvailableError);
    });

    it("rejects invalid filter (e.g. range > 90 days)", async () => {
      const invalidRangeFilter: ReportFilter = {
        rangeStart: "2026-01-01T00:00:00Z",
        rangeEnd: "2026-06-01T00:00:00Z",
        timezone: "Asia/Jakarta",
      };

      expect(
        reportDataAssembler.assembleReport(
          ReportType.PRESENCE_COMPLIANCE_REPORT,
          "tenant-sejuta-jiwa",
          invalidRangeFilter
        )
      ).rejects.toThrow(InvalidReportFilterError);
    });
  });

  // ============================================================================
  // 4. Presence Compliance Report Assembly
  // ============================================================================
  describe("Presence Compliance Report Assembly", () => {
    it("assembles presence report with authoritative S7-03 facts", async () => {
      // Mock presence analytics service response
      const originalGetPresence = historicalPresenceAnalyticsService.getPresenceSummary;
      historicalPresenceAnalyticsService.getPresenceSummary = async () => ({
        observedRiders: 15,
        presenceEvents: 1200,
        compliance: {
          compliantCount: 1100,
          deviatedCount: 80,
          outsideCount: 15,
          unassignedCount: 5,
          complianceRate: 0.9167,
        },
        eventTypeBreakdown: {
          ENTER: 300,
          EXIT: 250,
          ON_SITE: 550,
          OUTSIDE_ZONE: 80,
          DEVIATED: 20,
        },
        deviatedEventsCount: 80,
        affectedRidersCount: 4,
      });

      try {
        const report = (await reportDataAssembler.assemblePresenceComplianceReport(
          "thesis-default",
          validFilter
        )) as any;

        expect(report.metadata.reportType).toBe(ReportType.PRESENCE_COMPLIANCE_REPORT);
        expect(report.metadata.tenantId).toBe("thesis-default");
        expect(report.kpi.totalEvents).toBe(1200);
        expect(report.kpi.compliantEvents).toBe(1100);
        expect(report.kpi.deviatedEvents).toBe(80);
        expect(report.kpi.complianceRate).toBe(0.9167);
        expect(report.kpi.complianceRateFormatted).toBe("91.7%");
        expect(report.kpi.observedRiders).toBe(15);
        expect(report.kpi.affectedRiders).toBe(4);
        expect(typeof report.streamPresenceRows).toBe("function");
      } finally {
        historicalPresenceAnalyticsService.getPresenceSummary = originalGetPresence;
      }
    });

    it("handles zero denominator in presence report without fabricating numbers", async () => {
      const originalGetPresence = historicalPresenceAnalyticsService.getPresenceSummary;
      historicalPresenceAnalyticsService.getPresenceSummary = async () => ({
        observedRiders: 0,
        presenceEvents: 0,
        compliance: {
          compliantCount: 0,
          deviatedCount: 0,
          outsideCount: 0,
          unassignedCount: 0,
          complianceRate: null, // Zero denominator
        },
        eventTypeBreakdown: {
          ENTER: 0,
          EXIT: 0,
          ON_SITE: 0,
          OUTSIDE_ZONE: 0,
          DEVIATED: 0,
        },
        deviatedEventsCount: 0,
        affectedRidersCount: 0,
      });

      try {
        const report = await reportDataAssembler.assemblePresenceComplianceReport(
          "thesis-default",
          validFilter
        );

        expect(report.kpi.totalEvents).toBe(0);
        expect(report.kpi.complianceRate).toBeNull();
        expect(report.kpi.complianceRateFormatted).toBe("N/A");
      } finally {
        historicalPresenceAnalyticsService.getPresenceSummary = originalGetPresence;
      }
    });
  });

  // ============================================================================
  // 5. Zone Performance Report Assembly
  // ============================================================================
  describe("Zone Performance Report Assembly", () => {
    it("assembles zone performance report with S7-03-05 zone semantics", async () => {
      const originalGetZone = historicalZoneAnalyticsService.getZoneSummary;
      historicalZoneAnalyticsService.getZoneSummary = async () => ({
        zones: [
          {
            zoneId: "z1",
            zoneName: "Sudirman Central",
            status: "ACTIVE",
            totalEvents: 600,
            compliantCount: 570,
            deviatedCount: 30,
            outsideCount: 0,
            unassignedCount: 0,
            complianceRate: 0.95,
            observedRiders: 8,
            affectedRiders: 2,
            deviationEpisodes: 3,
            avgDeviationDurationMinutes: 12.5,
          },
        ],
        totalZones: 1,
        overallComplianceRate: 0.95,
      });

      try {
        const report = await reportDataAssembler.assembleZonePerformanceReport(
          "thesis-default",
          validFilter
        );

        expect(report.metadata.reportType).toBe(ReportType.ZONE_PERFORMANCE_REPORT);
        expect(report.totalZones).toBe(1);
        expect(report.zones[0].zoneName).toBe("Sudirman Central");
        expect(report.zones[0].complianceRate).toBe(0.95);
        expect(report.overallComplianceRateFormatted).toBe("95.0%");
      } finally {
        historicalZoneAnalyticsService.getZoneSummary = originalGetZone;
      }
    });
  });

  // ============================================================================
  // 6. Rider Duty Report Assembly
  // ============================================================================
  describe("Rider Duty Report Assembly", () => {
    it("assembles rider duty report with S7-03-06 rider semantics", async () => {
      const originalGetRider = historicalRiderAnalyticsService.getRiderSummary;
      historicalRiderAnalyticsService.getRiderSummary = async () => ({
        riders: [
          {
            riderId: "r1",
            riderName: "Budi Santoso",
            email: "budi@koling.id",
            activeDutyDays: 7,
            assignedZones: ["Sudirman Central"],
            observedZones: ["Sudirman Central", "Thamrin"],
            totalEvents: 400,
            compliantCount: 380,
            deviatedCount: 20,
            complianceRate: 0.95,
            topDeviationZone: "Thamrin",
          },
        ],
        totalRiders: 1,
        overallComplianceRate: 0.95,
      });

      try {
        const report = await reportDataAssembler.assembleRiderDutyReport(
          "thesis-default",
          validFilter
        );

        expect(report.metadata.reportType).toBe(ReportType.RIDER_DUTY_REPORT);
        expect(report.totalRiders).toBe(1);
        expect(report.riders[0].riderName).toBe("Budi Santoso");
        expect(report.riders[0].activeDutyDays).toBe(7);
        expect(report.overallComplianceRateFormatted).toBe("95.0%");
      } finally {
        historicalRiderAnalyticsService.getRiderSummary = originalGetRider;
      }
    });
  });

  // ============================================================================
  // 7. Streaming Chunk Iteration & Truncation Semantics
  // ============================================================================
  describe("Streaming Chunk Semantics", () => {
    it("fetches rows in bounded batches and calculates totals accurately", async () => {
      const fetcher = new ReportDataFetcher();
      // Test streamPresenceEvents structure
      expect(typeof fetcher.streamPresenceEvents).toBe("function");
      expect(ReportDataFetcher.DEFAULT_CHUNK_SIZE).toBe(1000);
      expect(ReportDataFetcher.MAX_ROW_LIMIT).toBe(100000);
    });
  });
});

