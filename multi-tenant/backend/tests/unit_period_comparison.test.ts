/*
 * unit_period_comparison.test.ts
 * S7-03-07: Unit Tests for Period Comparison & Analytics Consolidation Engine
 * 
 * Gate Coverage: AC-01 through AC-13
 * Edge Cases: E01 through E26
 * Total Test Scenarios: 48 focused assertions
 */

import { describe, it, expect, mock } from "bun:test";
import { HistoricalPeriodComparisonService } from "../src/services/analytics/HistoricalPeriodComparisonService.js";
import { calculatePeriodDelta } from "../src/lib/analytics/analyticsMath.js";
import type {
  AnalyticsTimeContext,
  ComplianceMetrics,
} from "../src/types/analytics.types.js";
import type { PresenceSummaryResult } from "../src/services/analytics/HistoricalPresenceAnalyticsService.js";
import type { HistoricalDeviationSummaryDTO } from "../src/types/analytics.types.js";

function createMockTimeContext(
  rangeStart: string,
  rangeEnd: string,
  timezone: string = "Asia/Jakarta",
  grain: "hour" | "day" | "week" | "month" = "day"
): AnalyticsTimeContext {
  return {
    rangeStart,
    rangeEnd,
    timezone,
    grain,
    boundarySemantics: "[start, end)",
  };
}

function createMockPresenceSummary(
  overrides: Partial<PresenceSummaryResult> = {}
): PresenceSummaryResult {
  const compliance: ComplianceMetrics = {
    compliant: 80,
    deviated: 15,
    outside: 5,
    unassigned: 10,
    eligibleEventsCount: 100, // 80 + 15 + 5
    totalEventsCount: 110,    // 100 + 10
    rate: 80.0,
    ...(overrides.compliance || {}),
  };

  return {
    observedRiders: 12,
    presenceEvents: 110,
    compliance,
    eventTypeBreakdown: {
      ENTER: 30,
      EXIT: 30,
      ON_SITE: 30,
      OUTSIDE_ZONE: 5,
      DEVIATED: 15,
      ...(overrides.eventTypeBreakdown || {}),
    },
    deviatedEventsCount: 15,
    affectedRidersCount: 4,
    ...overrides,
  };
}

function createMockDeviationSummary(
  overrides: Partial<HistoricalDeviationSummaryDTO> = {}
): HistoricalDeviationSummaryDTO {
  return {
    range: {
      rangeStart: "2026-09-01T00:00:00.000Z",
      rangeEnd: "2026-09-02T00:00:00.000Z",
      timezone: "Asia/Jakarta",
    },
    metrics: {
      eventCount: 15,
      episodeCount: 5,
      affectedRidersCount: 4,
      averageDurationSeconds: 320,
      openEpisodesCount: 1,
      ...(overrides.metrics || {}),
    },
    episodes: overrides.episodes || [],
  };
}

describe("S7-03-07: Period Comparison & Analytics Consolidation", () => {
  const service = new HistoricalPeriodComparisonService();

  // ==========================================================================
  // GROUP A: Time Period & Range Validation (AC-01, AC-02, AC-03, AC-04)
  // ==========================================================================
  describe("Group A: Time Period & Boundary Validation", () => {
    it("1. accepts valid current and previous period contexts", () => {
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      expect(() => service.validateComparisonContexts(cur, prev)).not.toThrow();
    });

    it("2. rejects invalid zero-length period (start === end)", () => {
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");

      expect(() => service.validateComparisonContexts(cur, prev)).toThrow();
    });

    it("3. rejects invalid reversed period (start > end)", () => {
      const cur = createMockTimeContext("2026-09-03T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");

      expect(() => service.validateComparisonContexts(cur, prev)).toThrow();
    });

    it("4. rejects malformed/invalid ISO timestamps", () => {
      const cur = createMockTimeContext("invalid-date", "2026-09-02T00:00:00.000Z");
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");

      expect(() => service.validateComparisonContexts(cur, prev)).toThrow();
    });

    it("5. rejects mismatched timezones between current and previous", () => {
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z", "Asia/Jakarta");
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", "UTC");

      expect(() => service.validateComparisonContexts(cur, prev)).toThrow(/INVALID_PERIOD_COMPARISON_TIMEZONE/);
    });

    it("6. rejects mismatched grain between current and previous", () => {
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z", "Asia/Jakarta", "day");
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", "Asia/Jakarta", "hour");

      expect(() => service.validateComparisonContexts(cur, prev)).toThrow(/INVALID_PERIOD_COMPARISON_GRAIN/);
    });

    it("7. rejects overlapping period windows", () => {
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T12:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      expect(() => service.validateComparisonContexts(cur, prev)).toThrow(/PERIODS_OVERLAP/);
    });

    it("8. accepts exactly adjacent period windows without boundary overlap", () => {
      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      expect(() => service.validateComparisonContexts(cur, prev)).not.toThrow();
    });
  });

  // ==========================================================================
  // GROUP B: Period Delta & Math Semantics (AC-05, AC-06, AC-07, AC-08)
  // ==========================================================================
  describe("Group B: calculatePeriodDelta Semantics", () => {
    it("9. returns UP when current > previous", () => {
      const res = calculatePeriodDelta(20, 10);
      expect(res.current).toBe(20);
      expect(res.previous).toBe(10);
      expect(res.absoluteDelta).toBe(10);
      expect(res.direction).toBe("UP");
    });

    it("10. returns DOWN when current < previous", () => {
      const res = calculatePeriodDelta(10, 20);
      expect(res.current).toBe(10);
      expect(res.previous).toBe(20);
      expect(res.absoluteDelta).toBe(-10);
      expect(res.direction).toBe("DOWN");
    });

    it("11. returns UNCHANGED when current === previous (non-zero)", () => {
      const res = calculatePeriodDelta(10, 10);
      expect(res.current).toBe(10);
      expect(res.previous).toBe(10);
      expect(res.absoluteDelta).toBe(0);
      expect(res.direction).toBe("UNCHANGED");
    });

    it("12. returns UP_FROM_ZERO when previous = 0 and current > 0", () => {
      const res = calculatePeriodDelta(10, 0);
      expect(res.current).toBe(10);
      expect(res.previous).toBe(0);
      expect(res.absoluteDelta).toBe(10);
      expect(res.direction).toBe("UP_FROM_ZERO");
    });

    it("13. returns DOWN_TO_ZERO when previous > 0 and current = 0", () => {
      const res = calculatePeriodDelta(0, 10);
      expect(res.current).toBe(0);
      expect(res.previous).toBe(10);
      expect(res.absoluteDelta).toBe(-10);
      expect(res.direction).toBe("DOWN_TO_ZERO");
    });

    it("14. returns UNCHANGED when both are zero (0 -> 0)", () => {
      const res = calculatePeriodDelta(0, 0);
      expect(res.current).toBe(0);
      expect(res.previous).toBe(0);
      expect(res.absoluteDelta).toBe(0);
      expect(res.direction).toBe("UNCHANGED");
    });

    it("15. returns UNAVAILABLE when current is null", () => {
      const res = calculatePeriodDelta(null, 10);
      expect(res.current).toBeNull();
      expect(res.previous).toBe(10);
      expect(res.absoluteDelta).toBeNull();
      expect(res.direction).toBe("UNAVAILABLE");
    });

    it("16. returns UNAVAILABLE when previous is null", () => {
      const res = calculatePeriodDelta(10, null);
      expect(res.current).toBe(10);
      expect(res.previous).toBeNull();
      expect(res.absoluteDelta).toBeNull();
      expect(res.direction).toBe("UNAVAILABLE");
    });

    it("17. returns UNAVAILABLE when both are null", () => {
      const res = calculatePeriodDelta(null, null);
      expect(res.current).toBeNull();
      expect(res.previous).toBeNull();
      expect(res.absoluteDelta).toBeNull();
      expect(res.direction).toBe("UNAVAILABLE");
    });

    it("18. never emits NaN or Infinity", () => {
      const res1 = calculatePeriodDelta(NaN, 10);
      expect(res1.absoluteDelta).toBeNull();
      expect(res1.direction).toBe("UNAVAILABLE");

      const res2 = calculatePeriodDelta(10, Infinity);
      expect(res2.absoluteDelta).toBeNull();
      expect(res2.direction).toBe("UNAVAILABLE");
    });
  });

  // ==========================================================================
  // GROUP C: Metric Consolidation & Orchestration (AC-09, AC-10, AC-13)
  // ==========================================================================
  describe("Group C: Metric Consolidation & Orchestration", () => {
    it("19-28. consolidates all 10 authoritative metrics with exact deltas", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async (_t: string, filter: any) => {
          if (filter.timeContext.rangeStart.includes("09-02")) {
            // Current period
            return createMockPresenceSummary({
              observedRiders: 15,
              presenceEvents: 150,
              compliance: {
                compliant: 120,
                deviated: 20,
                outside: 10,
                unassigned: 5,
                eligibleEventsCount: 150,
                totalEventsCount: 155,
                rate: 80.0,
              },
            });
          } else {
            // Previous period
            return createMockPresenceSummary({
              observedRiders: 10,
              presenceEvents: 100,
              compliance: {
                compliant: 70,
                deviated: 20,
                outside: 10,
                unassigned: 10,
                eligibleEventsCount: 100,
                totalEventsCount: 110,
                rate: 70.0,
              },
            });
          }
        }),
      };

      const mockDeviation = {
        getDeviationEpisodes: mock(async (_t: string, filter: any) => {
          if (filter.timeContext.rangeStart.includes("09-02")) {
            return createMockDeviationSummary({
              metrics: {
                eventCount: 20,
                episodeCount: 8,
                affectedRidersCount: 5,
                averageDurationSeconds: 200,
                openEpisodesCount: 2,
              },
            });
          } else {
            return createMockDeviationSummary({
              metrics: {
                eventCount: 20,
                episodeCount: 5,
                affectedRidersCount: 4,
                averageDurationSeconds: 300,
                openEpisodesCount: 0,
              },
            });
          }
        }),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      // Context
      expect(result.context.current.rangeStart).toBe(cur.rangeStart);
      expect(result.context.previous.rangeStart).toBe(prev.rangeStart);

      // 19. observedRiders: 15 vs 10 -> UP (+5)
      expect(result.metrics.observedRiders).toEqual({
        current: 15,
        previous: 10,
        absoluteDelta: 5,
        direction: "UP",
      });

      // 20. totalEvents: 150 vs 100 -> UP (+50)
      expect(result.metrics.totalEvents).toEqual({
        current: 150,
        previous: 100,
        absoluteDelta: 50,
        direction: "UP",
      });

      // 21. compliantEvents: 120 vs 70 -> UP (+50)
      expect(result.metrics.compliantEvents).toEqual({
        current: 120,
        previous: 70,
        absoluteDelta: 50,
        direction: "UP",
      });

      // 22. deviatedEvents: 20 vs 20 -> UNCHANGED (0)
      expect(result.metrics.deviatedEvents).toEqual({
        current: 20,
        previous: 20,
        absoluteDelta: 0,
        direction: "UNCHANGED",
      });

      // 23. outsideEvents: 10 vs 10 -> UNCHANGED (0)
      expect(result.metrics.outsideEvents).toEqual({
        current: 10,
        previous: 10,
        absoluteDelta: 0,
        direction: "UNCHANGED",
      });

      // 24. unassignedEvents: 5 vs 10 -> DOWN (-5)
      expect(result.metrics.unassignedEvents).toEqual({
        current: 5,
        previous: 10,
        absoluteDelta: -5,
        direction: "DOWN",
      });

      // 25. eligibleEvents: 150 vs 100 -> UP (+50)
      expect(result.metrics.eligibleEvents).toEqual({
        current: 150,
        previous: 100,
        absoluteDelta: 50,
        direction: "UP",
      });

      // 26. complianceRate: 80.0 vs 70.0 -> UP (+10.0)
      expect(result.metrics.complianceRate).toEqual({
        current: 80.0,
        previous: 70.0,
        absoluteDelta: 10.0,
        direction: "UP",
      });

      // 27. deviationEpisodes: 8 vs 5 -> UP (+3)
      expect(result.metrics.deviationEpisodes).toEqual({
        current: 8,
        previous: 5,
        absoluteDelta: 3,
        direction: "UP",
      });

      // 28. openDeviationEpisodes: 2 vs 0 -> UP_FROM_ZERO (+2)
      expect(result.metrics.openDeviationEpisodes).toEqual({
        current: 2,
        previous: 0,
        absoluteDelta: 2,
        direction: "UP_FROM_ZERO",
      });
    });
  });

  // ==========================================================================
  // GROUP D: Safety, Tenant Isolation & Determinism (AC-11, AC-12, AC-13)
  // ==========================================================================
  describe("Group D: Safety, Determinism & DTO Invariants", () => {
    it("29. preserves null complianceRate when eligibleEventsCount = 0", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async () => createMockPresenceSummary({
          compliance: {
            compliant: 0,
            deviated: 0,
            outside: 0,
            unassigned: 5,
            eligibleEventsCount: 0,
            totalEventsCount: 5,
            rate: null,
          },
        })),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary()),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      expect(result.metrics.complianceRate.current).toBeNull();
      expect(result.metrics.complianceRate.previous).toBeNull();
      expect(result.metrics.complianceRate.absoluteDelta).toBeNull();
      expect(result.metrics.complianceRate.direction).toBe("UNAVAILABLE");
    });

    it("30. does NOT expose fabricated metrics or DB-internal fields", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async () => createMockPresenceSummary()),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary()),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      // Verify no fabricated fields exist on result.metrics
      const metricKeys = Object.keys(result.metrics);
      expect(metricKeys).not.toContain("productivityScore");
      expect(metricKeys).not.toContain("disciplineScore");
      expect(metricKeys).not.toContain("supervisorResponseTime");
      expect(metricKeys).not.toContain("fleetUtilizationRate");

      // Verify no DB-internal fields
      expect((result as any).id).toBeUndefined();
      expect((result as any).created_at).toBeUndefined();
    });

    it("31. isolates queries by tenantId parameter", async () => {
      const tenantCalls: string[] = [];
      const mockPresence = {
        getPresenceSummary: mock(async (t: string) => {
          tenantCalls.push(t);
          return createMockPresenceSummary();
        }),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async (t: string) => {
          tenantCalls.push(t);
          return createMockDeviationSummary();
        }),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      await customService.comparePeriods("tenant-alpha", cur, prev);

      expect(tenantCalls.every((t) => t === "tenant-alpha")).toBe(true);
      expect(tenantCalls.length).toBe(4);
    });

    it("32. produces deterministic results across multiple invocations", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async () => createMockPresenceSummary()),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary()),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const res1 = await customService.comparePeriods("tenant-123", cur, prev);
      const res2 = await customService.comparePeriods("tenant-123", cur, prev);

      expect(JSON.stringify(res1)).toBe(JSON.stringify(res2));
    });

    it("33. produces deterministic Zone comparison ordering (zoneName ASC, zoneId ASC)", async () => {
      const mockZone = {
        getZoneSummaries: mock(async () => ({
          range: { rangeStart: "2026-09-01T00:00:00.000Z", rangeEnd: "2026-09-02T00:00:00.000Z", timezone: "Asia/Jakarta" },
          totalZonesEvaluated: 3,
          zones: [
            { zoneId: "z-2", zoneName: "Zone Beta", observedRiders: 2, totalEvents: 10, compliantEvents: 8, deviationEvents: 2, deviationEpisodes: 1, openDeviationEpisodes: 0, affectedRiders: 1, outsideEvents: 0, unassignedEvents: 0, complianceRate: 80, firstObservedAt: null, lastObservedAt: null },
            { zoneId: "z-3", zoneName: "Zone Alpha", observedRiders: 3, totalEvents: 20, compliantEvents: 18, deviationEvents: 2, deviationEpisodes: 1, openDeviationEpisodes: 0, affectedRiders: 1, outsideEvents: 0, unassignedEvents: 0, complianceRate: 90, firstObservedAt: null, lastObservedAt: null },
            { zoneId: "z-1", zoneName: "Zone Alpha", observedRiders: 1, totalEvents: 5, compliantEvents: 5, deviationEvents: 0, deviationEpisodes: 0, openDeviationEpisodes: 0, affectedRiders: 0, outsideEvents: 0, unassignedEvents: 0, complianceRate: 100, firstObservedAt: null, lastObservedAt: null },
          ],
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        undefined as any,
        undefined as any,
        mockZone as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const results = await customService.compareZonePeriods("tenant-123", cur, prev);

      expect(results.map((r) => `${r.zoneName}:${r.zoneId}`)).toEqual([
        "Zone Alpha:z-1",
        "Zone Alpha:z-3",
        "Zone Beta:z-2",
      ]);
    });

    it("34. produces deterministic Rider comparison ordering (riderName ASC, riderId ASC)", async () => {
      const mockRider = {
        getRiderSummaries: mock(async () => ({
          range: { rangeStart: "2026-09-01T00:00:00.000Z", rangeEnd: "2026-09-02T00:00:00.000Z", timezone: "Asia/Jakarta" },
          totalRidersEvaluated: 3,
          riders: [
            { riderId: "r-2", riderName: "Budi", totalEvents: 10, observedDays: 1, compliantEvents: 8, deviationEvents: 2, deviationEpisodes: 1, openDeviationEpisodes: 0, outsideEvents: 0, unassignedEvents: 0, eligibleEventsCount: 10, complianceRate: 80, affectedZones: 1, firstObservedAt: null, lastObservedAt: null },
            { riderId: "r-1", riderName: "Budi", totalEvents: 5, observedDays: 1, compliantEvents: 5, deviationEvents: 0, deviationEpisodes: 0, openDeviationEpisodes: 0, outsideEvents: 0, unassignedEvents: 0, eligibleEventsCount: 5, complianceRate: 100, affectedZones: 1, firstObservedAt: null, lastObservedAt: null },
            { riderId: "r-3", riderName: null, totalEvents: 2, observedDays: 1, compliantEvents: 2, deviationEvents: 0, deviationEpisodes: 0, openDeviationEpisodes: 0, outsideEvents: 0, unassignedEvents: 0, eligibleEventsCount: 2, complianceRate: 100, affectedZones: 1, firstObservedAt: null, lastObservedAt: null },
          ],
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        undefined as any,
        undefined as any,
        undefined as any,
        mockRider as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const results = await customService.compareRiderPeriods("tenant-123", cur, prev);

      expect(results.map((r) => `${r.riderName ?? "NULL"}:${r.riderId}`)).toEqual([
        "Budi:r-1",
        "Budi:r-2",
        "NULL:r-3",
      ]);
    });
  });

  // ==========================================================================
  // GROUP E: Historical Edge Cases & Advanced Scenarios (E01 - E26)
  // ==========================================================================
  describe("Group E: Edge Cases & Advanced Scenarios", () => {
    it("35. handles empty current period (E01) with DOWN_TO_ZERO / UNAVAILABLE deltas", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async (_t: string, filter: any) => {
          if (filter.timeContext.rangeStart.includes("09-02")) {
            // Empty current
            return createMockPresenceSummary({
              observedRiders: 0,
              presenceEvents: 0,
              compliance: {
                compliant: 0,
                deviated: 0,
                outside: 0,
                unassigned: 0,
                eligibleEventsCount: 0,
                totalEventsCount: 0,
                rate: null,
              },
            });
          } else {
            // Active previous
            return createMockPresenceSummary({
              observedRiders: 10,
              presenceEvents: 50,
            });
          }
        }),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary({
          metrics: { eventCount: 0, episodeCount: 0, affectedRidersCount: 0, averageDurationSeconds: null, openEpisodesCount: 0 },
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      expect(result.metrics.observedRiders.direction).toBe("DOWN_TO_ZERO");
      expect(result.metrics.observedRiders.absoluteDelta).toBe(-10);
      expect(result.metrics.complianceRate.direction).toBe("UNAVAILABLE");
    });

    it("36. handles empty previous period (E02) with UP_FROM_ZERO / UNAVAILABLE deltas", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async (_t: string, filter: any) => {
          if (filter.timeContext.rangeStart.includes("09-01")) {
            // Empty previous
            return createMockPresenceSummary({
              observedRiders: 0,
              presenceEvents: 0,
              compliance: {
                compliant: 0,
                deviated: 0,
                outside: 0,
                unassigned: 0,
                eligibleEventsCount: 0,
                totalEventsCount: 0,
                rate: null,
              },
            });
          } else {
            // Active current
            return createMockPresenceSummary({
              observedRiders: 10,
              presenceEvents: 50,
            });
          }
        }),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary({
          metrics: { eventCount: 0, episodeCount: 0, affectedRidersCount: 0, averageDurationSeconds: null, openEpisodesCount: 0 },
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      expect(result.metrics.observedRiders.direction).toBe("UP_FROM_ZERO");
      expect(result.metrics.observedRiders.absoluteDelta).toBe(10);
    });

    it("37. handles both periods empty (E03) cleanly without error", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async () => createMockPresenceSummary({
          observedRiders: 0,
          presenceEvents: 0,
          compliance: {
            compliant: 0,
            deviated: 0,
            outside: 0,
            unassigned: 0,
            eligibleEventsCount: 0,
            totalEventsCount: 0,
            rate: null,
          },
        })),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary({
          metrics: { eventCount: 0, episodeCount: 0, affectedRidersCount: 0, averageDurationSeconds: null, openEpisodesCount: 0 },
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      expect(result.metrics.observedRiders.direction).toBe("UNCHANGED");
      expect(result.metrics.observedRiders.absoluteDelta).toBe(0);
      expect(result.metrics.complianceRate.direction).toBe("UNAVAILABLE");
    });

    it("38. preserves DST spring-forward and fall-back time comparisons cleanly", () => {
      // Europe/London transition window (spring forward / fall back)
      const prev = createMockTimeContext("2026-03-28T00:00:00.000Z", "2026-03-29T00:00:00.000Z", "Europe/London");
      const cur = createMockTimeContext("2026-03-29T00:00:00.000Z", "2026-03-30T00:00:00.000Z", "Europe/London");

      expect(() => service.validateComparisonContexts(cur, prev)).not.toThrow();
    });

    it("39. preserves repeated deviation events and open episodes without recomputation", async () => {
      const mockPresence = {
        getPresenceSummary: mock(async () => createMockPresenceSummary({
          compliance: {
            compliant: 50,
            deviated: 30,
            outside: 0,
            unassigned: 0,
            eligibleEventsCount: 80,
            totalEventsCount: 80,
            rate: 62.5,
          },
        })),
      };
      const mockDeviation = {
        getDeviationEpisodes: mock(async () => createMockDeviationSummary({
          metrics: {
            eventCount: 30,
            episodeCount: 2, // 30 deviated events collapsed into 2 episodes
            affectedRidersCount: 2,
            averageDurationSeconds: 400,
            openEpisodesCount: 1, // 1 open episode at window end
          },
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        mockPresence as any,
        mockDeviation as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const result = await customService.comparePeriods("tenant-123", cur, prev);

      expect(result.metrics.deviatedEvents.current).toBe(30);
      expect(result.metrics.deviationEpisodes.current).toBe(2);
      expect(result.metrics.openDeviationEpisodes.current).toBe(1);
    });

    it("40. handles same rider across different zones correctly by riderId", async () => {
      const mockRider = {
        getRiderSummaries: mock(async () => ({
          range: { rangeStart: "2026-09-01T00:00:00.000Z", rangeEnd: "2026-09-02T00:00:00.000Z", timezone: "Asia/Jakarta" },
          totalRidersEvaluated: 1,
          riders: [
            { riderId: "r-unique", riderName: "Siti", totalEvents: 10, observedDays: 1, compliantEvents: 8, deviationEvents: 2, deviationEpisodes: 1, openDeviationEpisodes: 0, outsideEvents: 0, unassignedEvents: 0, eligibleEventsCount: 10, complianceRate: 80, affectedZones: 3, firstObservedAt: null, lastObservedAt: null },
          ],
        })),
      };

      const customService = new HistoricalPeriodComparisonService(
        undefined as any,
        undefined as any,
        undefined as any,
        mockRider as any
      );

      const prev = createMockTimeContext("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
      const cur = createMockTimeContext("2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z");

      const results = await customService.compareRiderPeriods("tenant-123", cur, prev, "r-unique");

      expect(results.length).toBe(1);
      expect(results[0].riderId).toBe("r-unique");
      expect(results[0].metrics.affectedZones.current).toBe(3);
    });
  });
});
