/*
 * unit_analytics_math.test.ts
 * S7-03-01: Unit Tests for Historical Analytics Math & Primitives
 */

import { describe, it, expect } from "bun:test";
import {
  safeRatio,
  calculatePeriodDelta,
  buildDeterministicEpisodeId,
  getDefaultAnalyticsCapabilities,
  AUTHORITATIVE_EVENT_ORDERING,
} from "../src/lib/analytics/analyticsMath.js";

describe("S7-03-01: Analytics Mathematical Primitives", () => {
  describe("safeRatio()", () => {
    it("calculates exact percentage for normal positive values", () => {
      expect(safeRatio(85, 100)).toBe(85);
      expect(safeRatio(1, 3)).toBe(33.33);
      expect(safeRatio(2, 3, 3)).toBe(66.667);
      expect(safeRatio(0, 50)).toBe(0);
    });

    it("returns null when denominator is zero, negative, or invalid", () => {
      expect(safeRatio(10, 0)).toBeNull();
      expect(safeRatio(10, -5)).toBeNull();
      expect(safeRatio(NaN, 100)).toBeNull();
      expect(safeRatio(100, NaN)).toBeNull();
      expect(safeRatio(Infinity, 100)).toBeNull();
      expect(safeRatio(100, Infinity)).toBeNull();
    });
  });

  describe("calculatePeriodDelta()", () => {
    it("handles standard period-over-period positive and negative trends", () => {
      // 100 -> 150 (+50)
      const up = calculatePeriodDelta(150, 100);
      expect(up.current).toBe(150);
      expect(up.previous).toBe(100);
      expect(up.absoluteDelta).toBe(50);
      expect(up.direction).toBe("UP");

      // 100 -> 80 (-20)
      const down = calculatePeriodDelta(80, 100);
      expect(down.current).toBe(80);
      expect(down.previous).toBe(100);
      expect(down.absoluteDelta).toBe(-20);
      expect(down.direction).toBe("DOWN");

      // 100 -> 100 (0)
      const unchanged = calculatePeriodDelta(100, 100);
      expect(unchanged.current).toBe(100);
      expect(unchanged.previous).toBe(100);
      expect(unchanged.absoluteDelta).toBe(0);
      expect(unchanged.direction).toBe("UNCHANGED");
    });

    it("handles zero baseline correctly (UP_FROM_ZERO)", () => {
      const upFromZero = calculatePeriodDelta(25, 0);
      expect(upFromZero.current).toBe(25);
      expect(upFromZero.previous).toBe(0);
      expect(upFromZero.absoluteDelta).toBe(25);
      expect(upFromZero.direction).toBe("UP_FROM_ZERO");
    });

    it("handles zero to zero correctly (UNCHANGED)", () => {
      const zeroToZero = calculatePeriodDelta(0, 0);
      expect(zeroToZero.current).toBe(0);
      expect(zeroToZero.previous).toBe(0);
      expect(zeroToZero.absoluteDelta).toBe(0);
      expect(zeroToZero.direction).toBe("UNCHANGED");
    });

    it("handles positive to zero correctly (DOWN_TO_ZERO)", () => {
      const downToZero = calculatePeriodDelta(0, 50);
      expect(downToZero.current).toBe(0);
      expect(downToZero.previous).toBe(50);
      expect(downToZero.absoluteDelta).toBe(-50);
      expect(downToZero.direction).toBe("DOWN_TO_ZERO");
    });

    it("handles null / missing previous periods (UNAVAILABLE)", () => {
      const noPrevious = calculatePeriodDelta(120, null);
      expect(noPrevious.current).toBe(120);
      expect(noPrevious.previous).toBeNull();
      expect(noPrevious.absoluteDelta).toBeNull();
      expect(noPrevious.direction).toBe("UNAVAILABLE");
    });

    it("handles null current period (UNAVAILABLE)", () => {
      const noCurrent = calculatePeriodDelta(null, 120);
      expect(noCurrent.current).toBeNull();
      expect(noCurrent.previous).toBe(120);
      expect(noCurrent.absoluteDelta).toBeNull();
      expect(noCurrent.direction).toBe("UNAVAILABLE");
    });

    it("handles both null periods (UNAVAILABLE)", () => {
      const bothNull = calculatePeriodDelta(null, null);
      expect(bothNull.current).toBeNull();
      expect(bothNull.previous).toBeNull();
      expect(bothNull.absoluteDelta).toBeNull();
      expect(bothNull.direction).toBe("UNAVAILABLE");
    });
  });

  describe("buildDeterministicEpisodeId()", () => {
    it("builds consistent predictable episode IDs", () => {
      const epId = buildDeterministicEpisodeId("tenant-a", "rider-123", "event-abc");
      expect(epId).toBe("ep_tenant-a_rider-123_event-abc");
    });
  });

  describe("getDefaultAnalyticsCapabilities()", () => {
    it("reports honest capability bounds without false promises", () => {
      const caps = getDefaultAnalyticsCapabilities();
      expect(caps.presenceHistory).toBe(true);
      expect(caps.riderActivity).toBe(true);
      expect(caps.zoneAnalytics).toBe(true);
      expect(caps.deviationEpisodes).toBe(true);
      expect(caps.fleetUtilizationHistory).toBe(false);
      expect(caps.alertResponseHistory).toBe(false);
      expect(caps.unsupportedReasons.alertResponseHistory).toBeDefined();
    });
  });

  describe("AUTHORITATIVE_EVENT_ORDERING invariant", () => {
    it("has the strict 4-tuple ordering sequence", () => {
      expect(AUTHORITATIVE_EVENT_ORDERING).toBe("ORDER BY rider_id ASC, captured_at ASC, created_at ASC, id ASC");
    });
  });
});
