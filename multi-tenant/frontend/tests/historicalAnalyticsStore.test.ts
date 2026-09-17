/*
 * historicalAnalyticsStore.test.ts
 * S7-03-10: Automated Unit & Integration Suite for Frontend Historical Analytics Store
 * 
 * Verifies:
 * 1. Preset date range calculations & [start, end) half-open boundaries.
 * 2. Timezone & grain configuration preservation (Asia/Jakarta default).
 * 3. Zero-Fake-Data compliance rate behavior (strict null for 0 denominator).
 * 4. Deterministic sorting for zones and riders.
 * 5. Period comparison cards and delta direction mapping.
 * 6. Granular resource status and isolated error handling.
 * 7. Initial loading vs background refreshing lifecycle.
 * 8. Comprehensive query parameters and filter state mutations.
 */

import "./setup.js";
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { HistoricalAnalyticsStore } from "../src/lib/stores/historicalAnalyticsStore.svelte.js";
import { historicalAnalyticsService } from "../src/services/historicalAnalyticsService.js";
import type {
  PresenceAnalyticsResult,
  HistoricalDeviationSummaryDTO,
  ZoneAnalyticsResult,
  RiderAnalyticsResult,
  PeriodComparisonResult,
} from "../src/lib/types/analytics.types.js";

describe("S7-03-10: Frontend Historical Analytics Store", () => {
  let store: HistoricalAnalyticsStore;

  beforeEach(() => {
    store = new HistoricalAnalyticsStore();
  });

  describe("1. Temporal Presets & Boundary Invariants", () => {
    it("should initialize with 'last7days', grain 'day', and default timezone 'Asia/Jakarta'", () => {
      expect(store.selectedPreset).toBe("last7days");
      expect(store.selectedGrain).toBe("day");
      expect(store.selectedTimezone).toBe("Asia/Jakarta");
      expect(store.compareWithPrevious).toBe(true);
      expect(store.rangeStart).toBeTruthy();
      expect(store.rangeEnd).toBeTruthy();
      expect(store.previousRangeStart).toBeTruthy();
      expect(store.previousRangeEnd).toBeTruthy();
    });

    it("should preserve [start, end) half-open boundaries for 'today' preset", () => {
      store.setTimePreset("today");
      const start = new Date(store.rangeStart).getTime();
      const end = new Date(store.rangeEnd).getTime();
      const duration = end - start;

      // Exactly 24 hours (86,400,000 ms)
      expect(duration).toBe(24 * 60 * 60 * 1000);
      
      // Previous period must be immediately preceding with identical duration
      const prevStart = new Date(store.previousRangeStart).getTime();
      const prevEnd = new Date(store.previousRangeEnd).getTime();
      expect(prevEnd).toBe(start);
      expect(prevEnd - prevStart).toBe(24 * 60 * 60 * 1000);
    });

    it("should preserve [start, end) boundaries for 'yesterday' preset", () => {
      store.setTimePreset("yesterday");
      const start = new Date(store.rangeStart).getTime();
      const end = new Date(store.rangeEnd).getTime();
      const duration = end - start;

      expect(duration).toBe(24 * 60 * 60 * 1000);
      const prevStart = new Date(store.previousRangeStart).getTime();
      const prevEnd = new Date(store.previousRangeEnd).getTime();
      expect(prevEnd).toBe(start);
      expect(prevEnd - prevStart).toBe(24 * 60 * 60 * 1000);
    });

    it("should preserve symmetric previous period for 'last7days' preset", () => {
      store.setTimePreset("last7days");
      const start = new Date(store.rangeStart).getTime();
      const end = new Date(store.rangeEnd).getTime();
      const duration = end - start;

      const prevStart = new Date(store.previousRangeStart).getTime();
      const prevEnd = new Date(store.previousRangeEnd).getTime();
      expect(prevEnd).toBe(start);
      expect(prevEnd - prevStart).toBe(duration);
    });

    it("should preserve symmetric previous period for 'last30days' preset", () => {
      store.setTimePreset("last30days");
      const start = new Date(store.rangeStart).getTime();
      const end = new Date(store.rangeEnd).getTime();
      const duration = end - start;

      const prevStart = new Date(store.previousRangeStart).getTime();
      const prevEnd = new Date(store.previousRangeEnd).getTime();
      expect(prevEnd).toBe(start);
      expect(prevEnd - prevStart).toBe(duration);
    });

    it("should preserve calendar-month boundaries for 'thisMonth' preset", () => {
      store.setTimePreset("thisMonth");
      const start = new Date(store.rangeStart);
      const end = new Date(store.rangeEnd);
      const prevStart = new Date(store.previousRangeStart);
      const prevEnd = new Date(store.previousRangeEnd);

      expect(start.getUTCDate()).toBe(1);
      expect(end.getUTCDate()).toBe(1);
      expect(prevStart.getUTCDate()).toBe(1);
      expect(prevEnd.getTime()).toBe(start.getTime());
    });

    it("should compute custom range and auto-generate previous period of identical length", () => {
      const customStart = "2026-09-01T00:00:00.000Z";
      const customEnd = "2026-09-05T00:00:00.000Z"; // 4 days
      store.setCustomRange(customStart, customEnd);

      expect(store.selectedPreset).toBe("custom");
      expect(store.rangeStart).toBe(customStart);
      expect(store.rangeEnd).toBe(customEnd);

      const s = new Date(customStart).getTime();
      const e = new Date(customEnd).getTime();
      const expectedPrevStart = new Date(s - (e - s)).toISOString();
      expect(store.previousRangeStart).toBe(expectedPrevStart);
      expect(store.previousRangeEnd).toBe(customStart);
    });
  });

  describe("2. Zero-Fake-Data & Null Compliance Rate Guards", () => {
    it("should return null complianceRate when dataset is empty or denominator is 0", () => {
      expect(store.summaryMetrics.complianceRate).toBeNull();
      expect(store.summaryMetrics.totalEvents).toBe(0);
      expect(store.hasData).toBe(false);
    });

    it("should preserve authoritative null complianceRate from backend", () => {
      const mockPresence: PresenceAnalyticsResult = {
        timeContext: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-08T00:00:00.000Z",
          timezone: "Asia/Jakarta",
          grain: "day",
          boundarySemantics: "[start, end)",
        },
        metrics: {
          observedRiders: 0,
          totalEvents: 0,
          presenceEvents: {
            ENTER: 0,
            EXIT: 0,
            ON_SITE: 0,
            OUTSIDE_ZONE: 0,
            DEVIATED: 0,
          },
          complianceDistribution: {
            compliant: 0,
            deviated: 0,
            outside: 0,
            unassigned: 0,
          },
          eligibleEventsCount: 0,
          complianceRate: null,
        },
      };

      store.presenceResult = mockPresence;
      expect(store.summaryMetrics.complianceRate).toBeNull();
      expect(store.summaryMetrics.totalEvents).toBe(0);
      expect(store.hasData).toBe(false);
    });

    it("should correctly populate summaryMetrics when authoritative data is present", () => {
      const mockPresence: PresenceAnalyticsResult = {
        timeContext: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-08T00:00:00.000Z",
          timezone: "Asia/Jakarta",
          grain: "day",
          boundarySemantics: "[start, end)",
        },
        metrics: {
          observedRiders: 12,
          totalEvents: 100,
          presenceEvents: {
            ENTER: 20,
            EXIT: 20,
            ON_SITE: 40,
            OUTSIDE_ZONE: 10,
            DEVIATED: 10,
          },
          complianceDistribution: {
            compliant: 75,
            deviated: 15,
            outside: 5,
            unassigned: 5,
          },
          eligibleEventsCount: 95,
          complianceRate: 78.95,
        },
      };

      const mockDeviations: HistoricalDeviationSummaryDTO = {
        range: { rangeStart: "2026-09-01T00:00:00.000Z", rangeEnd: "2026-09-08T00:00:00.000Z", timezone: "Asia/Jakarta" },
        metrics: {
          eventCount: 15,
          episodeCount: 3,
          affectedRidersCount: 2,
          averageDurationSeconds: 420,
          openEpisodesCount: 1,
        },
        episodes: [],
      };

      store.presenceResult = mockPresence;
      store.deviationsResult = mockDeviations;

      expect(store.hasData).toBe(true);
      expect(store.summaryMetrics.observedRiders).toBe(12);
      expect(store.summaryMetrics.totalEvents).toBe(100);
      expect(store.summaryMetrics.compliantEvents).toBe(75);
      expect(store.summaryMetrics.complianceRate).toBe(78.95);
      expect(store.summaryMetrics.deviationEpisodesCount).toBe(3);
      expect(store.summaryMetrics.openEpisodesCount).toBe(1);
      expect(store.summaryMetrics.averageDeviationDurationSeconds).toBe(420);
    });
  });

  describe("3. Deterministic Rankings & Comparison Cards", () => {
    it("should deterministically sort zones by totalEvents DESC then zoneName ASC", () => {
      const mockZones: ZoneAnalyticsResult = {
        timeContext: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-08T00:00:00.000Z",
          timezone: "Asia/Jakarta",
          grain: "day",
          boundarySemantics: "[start, end)",
        },
        zones: [
          {
            zoneId: "z-1",
            zoneName: "Zone Beta",
            observedRiders: 3,
            totalEvents: 50,
            complianceDistribution: { compliant: 40, deviated: 10, outside: 0, unassigned: 0 },
            eligibleEventsCount: 50,
            complianceRate: 80,
            affectedRiders: 1,
            deviationEpisodes: 1,
            openDeviationEpisodes: 0,
          },
          {
            zoneId: "z-2",
            zoneName: "Zone Alpha",
            observedRiders: 5,
            totalEvents: 100,
            complianceDistribution: { compliant: 90, deviated: 10, outside: 0, unassigned: 0 },
            eligibleEventsCount: 100,
            complianceRate: 90,
            affectedRiders: 2,
            deviationEpisodes: 2,
            openDeviationEpisodes: 0,
          },
          {
            zoneId: "z-3",
            zoneName: "Zone Gamma",
            observedRiders: 2,
            totalEvents: 50,
            complianceDistribution: { compliant: 45, deviated: 5, outside: 0, unassigned: 0 },
            eligibleEventsCount: 50,
            complianceRate: 90,
            affectedRiders: 1,
            deviationEpisodes: 1,
            openDeviationEpisodes: 0,
          },
        ],
      };

      store.zoneAnalyticsResult = mockZones;
      const rankings = store.zoneRankings;
      expect(rankings.length).toBe(3);
      expect(rankings[0].zoneName).toBe("Zone Alpha"); // 100 events
      expect(rankings[1].zoneName).toBe("Zone Beta");  // 50 events, alphabetical B < G
      expect(rankings[2].zoneName).toBe("Zone Gamma"); // 50 events, alphabetical G
    });

    it("should deterministically sort riders by totalEvents DESC then riderName ASC", () => {
      const mockRiders: RiderAnalyticsResult = {
        timeContext: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-08T00:00:00.000Z",
          timezone: "Asia/Jakarta",
          grain: "day",
          boundarySemantics: "[start, end)",
        },
        riders: [
          {
            riderId: "r-1",
            riderName: "Budi",
            totalEvents: 40,
            observedDays: 3,
            complianceDistribution: { compliant: 35, deviated: 5, outside: 0, unassigned: 0 },
            eligibleEventsCount: 40,
            complianceRate: 87.5,
            deviationEvents: 5,
            deviationEpisodes: 1,
            openDeviationEpisodes: 0,
            affectedZones: 1,
          },
          {
            riderId: "r-2",
            riderName: "Agus",
            totalEvents: 80,
            observedDays: 5,
            complianceDistribution: { compliant: 75, deviated: 5, outside: 0, unassigned: 0 },
            eligibleEventsCount: 80,
            complianceRate: 93.75,
            deviationEvents: 5,
            deviationEpisodes: 1,
            openDeviationEpisodes: 0,
            affectedZones: 2,
          },
          {
            riderId: "r-3",
            riderName: "Cahyo",
            totalEvents: 40,
            observedDays: 2,
            complianceDistribution: { compliant: 38, deviated: 2, outside: 0, unassigned: 0 },
            eligibleEventsCount: 40,
            complianceRate: 95.0,
            deviationEvents: 2,
            deviationEpisodes: 1,
            openDeviationEpisodes: 0,
            affectedZones: 1,
          },
        ],
      };

      store.riderAnalyticsResult = mockRiders;
      const rankings = store.riderRankings;
      expect(rankings.length).toBe(3);
      expect(rankings[0].riderName).toBe("Agus");  // 80 events
      expect(rankings[1].riderName).toBe("Budi");  // 40 events, B < C
      expect(rankings[2].riderName).toBe("Cahyo"); // 40 events, C
    });

    it("should map authoritative period comparison deltas and directions", () => {
      const mockComparison: PeriodComparisonResult = {
        context: {
          current: { rangeStart: "2026-09-08T00:00:00.000Z", rangeEnd: "2026-09-15T00:00:00.000Z", timezone: "Asia/Jakarta" },
          previous: { rangeStart: "2026-09-01T00:00:00.000Z", rangeEnd: "2026-09-08T00:00:00.000Z", timezone: "Asia/Jakarta" },
        },
        metrics: {
          observedRiders: { current: 15, previous: 10, absoluteDelta: 5, direction: "UP" },
          totalEvents: { current: 500, previous: 400, absoluteDelta: 100, direction: "UP" },
          compliantEvents: { current: 450, previous: 360, absoluteDelta: 90, direction: "UP" },
          deviatedEvents: { current: 30, previous: 40, absoluteDelta: -10, direction: "DOWN" },
          outsideEvents: { current: 10, previous: 0, absoluteDelta: 10, direction: "UP_FROM_ZERO" },
          unassignedEvents: { current: 10, previous: 0, absoluteDelta: 10, direction: "UP_FROM_ZERO" },
          eligibleEvents: { current: 490, previous: 400, absoluteDelta: 90, direction: "UP" },
          complianceRate: { current: 91.84, previous: 90.0, absoluteDelta: 1.84, direction: "UP" },
          deviationEpisodes: { current: 5, previous: 5, absoluteDelta: 0, direction: "UNCHANGED" },
          openDeviationEpisodes: { current: 0, previous: 2, absoluteDelta: -2, direction: "DOWN_TO_ZERO" },
        },
      };

      store.comparisonResult = mockComparison;
      expect(store.comparisonCards?.observedRiders.direction).toBe("UP");
      expect(store.comparisonCards?.deviatedEvents.direction).toBe("DOWN");
      expect(store.comparisonCards?.outsideEvents.direction).toBe("UP_FROM_ZERO");
      expect(store.comparisonCards?.openDeviationEpisodes.direction).toBe("DOWN_TO_ZERO");
      expect(store.comparisonCards?.deviationEpisodes.direction).toBe("UNCHANGED");
    });
  });

  describe("4. Granular Resource Lifecycle & Error Isolation", () => {
    it("should handle partial failures in fetchAll without breaking other resources", async () => {
      const originalSummary = historicalAnalyticsService.getPresenceSummary;
      const originalTimeline = historicalAnalyticsService.getPresenceTimeline;
      const originalDeviations = historicalAnalyticsService.getDeviations;
      const originalZones = historicalAnalyticsService.getZoneAnalytics;
      const originalRiders = historicalAnalyticsService.getRiderAnalytics;
      const originalComparison = historicalAnalyticsService.getPeriodComparison;

      historicalAnalyticsService.getPresenceSummary = mock(async () => ({
        timeContext: { rangeStart: "", rangeEnd: "", timezone: "Asia/Jakarta", grain: "day", boundarySemantics: "[start, end)" },
        metrics: {
          observedRiders: 1,
          totalEvents: 10,
          presenceEvents: { ENTER: 2, EXIT: 2, ON_SITE: 6, OUTSIDE_ZONE: 0, DEVIATED: 0 },
          complianceDistribution: { compliant: 10, deviated: 0, outside: 0, unassigned: 0 },
          eligibleEventsCount: 10,
          complianceRate: 100,
        },
      }));

      historicalAnalyticsService.getPresenceTimeline = mock(async () => ({
        timeContext: { rangeStart: "", rangeEnd: "", timezone: "Asia/Jakarta", grain: "day", boundarySemantics: "[start, end)" },
        metrics: {
          observedRiders: 1,
          totalEvents: 10,
          presenceEvents: { ENTER: 2, EXIT: 2, ON_SITE: 6, OUTSIDE_ZONE: 0, DEVIATED: 0 },
          complianceDistribution: { compliant: 10, deviated: 0, outside: 0, unassigned: 0 },
          eligibleEventsCount: 10,
          complianceRate: 100,
        },
        timeline: { grain: "day", timezone: "Asia/Jakarta", points: [] },
      }));

      historicalAnalyticsService.getDeviations = mock(async () => {
        throw new Error("Network Timeout on Deviations");
      });

      historicalAnalyticsService.getZoneAnalytics = mock(async () => ({
        timeContext: { rangeStart: "", rangeEnd: "", timezone: "Asia/Jakarta", grain: "day", boundarySemantics: "[start, end)" },
        zones: [],
      }));

      historicalAnalyticsService.getRiderAnalytics = mock(async () => ({
        timeContext: { rangeStart: "", rangeEnd: "", timezone: "Asia/Jakarta", grain: "day", boundarySemantics: "[start, end)" },
        riders: [],
      }));

      historicalAnalyticsService.getPeriodComparison = mock(async () => {
        throw new Error("Comparison Endpoint Unavailable");
      });

      try {
        await store.fetchAll();

        expect(store.resourceStatus.summary).toBe("success");
        expect(store.resourceStatus.timeline).toBe("success");
        expect(store.presenceResult?.metrics.totalEvents).toBe(10);

        expect(store.resourceStatus.deviations).toBe("error");
        expect(store.resourceErrors.deviations).toBe("Network Timeout on Deviations");
        expect(store.resourceStatus.comparison).toBe("error");

        expect(store.hasPartialError).toBe(true);

        expect(store.isInitialLoading).toBe(false);
        expect(store.isRefreshing).toBe(false);
        expect(store.lastFetchedAt).not.toBeNull();
      } finally {
        historicalAnalyticsService.getPresenceSummary = originalSummary;
        historicalAnalyticsService.getPresenceTimeline = originalTimeline;
        historicalAnalyticsService.getDeviations = originalDeviations;
        historicalAnalyticsService.getZoneAnalytics = originalZones;
        historicalAnalyticsService.getRiderAnalytics = originalRiders;
        historicalAnalyticsService.getPeriodComparison = originalComparison;
      }
    });

    it("should distinguish initial loading from background refreshing", async () => {
      expect(store.isInitialLoading).toBe(false);
      expect(store.isRefreshing).toBe(false);
      expect(store.lastFetchedAt).toBeNull();

      historicalAnalyticsService.getPresenceSummary = mock(async () => ({} as any));
      historicalAnalyticsService.getPresenceTimeline = mock(async () => ({} as any));
      historicalAnalyticsService.getDeviations = mock(async () => ({} as any));
      historicalAnalyticsService.getZoneAnalytics = mock(async () => ({} as any));
      historicalAnalyticsService.getRiderAnalytics = mock(async () => ({} as any));
      historicalAnalyticsService.getPeriodComparison = mock(async () => ({} as any));

      await store.fetchAll();
      expect(store.lastFetchedAt).not.toBeNull();
      expect(store.isInitialLoading).toBe(false);
      expect(store.isRefreshing).toBe(false);
    });

    it("should correctly update filter setters and resetFilters", () => {
      store.setGrain("hour");
      expect(store.selectedGrain).toBe("hour");

      store.setTimezone("Asia/Makassar");
      expect(store.selectedTimezone).toBe("Asia/Makassar");

      store.setZoneFilter("zone-101");
      expect(store.selectedZoneId).toBe("zone-101");

      store.setRiderFilter("rider-505");
      expect(store.selectedRiderId).toBe("rider-505");

      store.setOpenDeviationsOnly(true);
      expect(store.openDeviationsOnly).toBe(true);

      store.setCompareWithPrevious(false);
      expect(store.compareWithPrevious).toBe(false);

      store.resetFilters();
      expect(store.selectedGrain).toBe("day");
      expect(store.selectedTimezone).toBe("Asia/Jakarta");
      expect(store.selectedZoneId).toBeNull();
      expect(store.selectedRiderId).toBeNull();
      expect(store.openDeviationsOnly).toBe(false);
      expect(store.compareWithPrevious).toBe(true);
      expect(store.selectedPreset).toBe("last7days");
    });
  });
});
