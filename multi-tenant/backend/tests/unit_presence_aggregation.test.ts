/*
 * unit_presence_aggregation.test.ts
 * S7-03-03: Unit & Aggregation Logic Tests for HistoricalPresenceAnalyticsService
 */

import { describe, it, expect } from "bun:test";
import { safeRatio } from "../src/lib/analytics/analyticsMath.js";
import {
  generateBuckets,
  getTemporalBucket,
  isWithinBoundary,
} from "../src/lib/analytics/analyticsTime.js";
import type {
  AnalyticsTimeContext,
  ComplianceMetrics,
} from "../src/types/analytics.types.js";

describe("S7-03-03: Presence & Compliance Aggregation Engine", () => {
  describe("Event-Level Presence Metrics Aggregation Logic", () => {
    it("correctly computes compliance rate and eligible denominator", () => {
      const events = [
        { rider_id: "r1", compliance_status: "COMPLIANT" },
        { rider_id: "r1", compliance_status: "COMPLIANT" },
        { rider_id: "r2", compliance_status: "DEVIATED" },
        { rider_id: "r3", compliance_status: "OUTSIDE" },
        { rider_id: "r4", compliance_status: "UNASSIGNED" },
      ];

      let compliant = 0;
      let deviated = 0;
      let outside = 0;
      let unassigned = 0;
      const observedRiders = new Set<string>();

      for (const e of events) {
        observedRiders.add(e.rider_id);
        if (e.compliance_status === "COMPLIANT") compliant++;
        else if (e.compliance_status === "DEVIATED") deviated++;
        else if (e.compliance_status === "OUTSIDE") outside++;
        else if (e.compliance_status === "UNASSIGNED") unassigned++;
      }

      const eligible = compliant + deviated + outside; // 2 + 1 + 1 = 4
      const rate = safeRatio(compliant, eligible);    // (2 / 4) * 100 = 50.0

      const metrics: ComplianceMetrics = {
        compliant,
        deviated,
        outside,
        unassigned,
        eligibleEventsCount: eligible,
        totalEventsCount: events.length,
        rate,
      };

      expect(observedRiders.size).toBe(4);
      expect(metrics.totalEventsCount).toBe(5);
      expect(metrics.eligibleEventsCount).toBe(4);
      expect(metrics.compliant).toBe(2);
      expect(metrics.deviated).toBe(1);
      expect(metrics.outside).toBe(1);
      expect(metrics.unassigned).toBe(1);
      expect(metrics.rate).toBe(50);
    });

    it("returns null compliance rate when only UNASSIGNED events exist (zero denominator)", () => {
      const events = [
        { rider_id: "r1", compliance_status: "UNASSIGNED" },
        { rider_id: "r2", compliance_status: "UNASSIGNED" },
      ];

      let compliant = 0;
      let eligible = 0;
      for (const e of events) {
        if (e.compliance_status === "COMPLIANT") compliant++;
      }

      const rate = safeRatio(compliant, eligible);
      expect(rate).toBeNull();
    });

    it("returns null compliance rate when event list is empty", () => {
      const rate = safeRatio(0, 0);
      expect(rate).toBeNull();
    });
  });

  describe("Timeline Bucketing & Deterministic Empty Bucket Filling", () => {
    const timeContext: AnalyticsTimeContext = {
      rangeStart: "2026-09-01T03:00:00.000Z", // 10:00 WIB
      rangeEnd: "2026-09-01T07:00:00.000Z",   // 14:00 WIB
      timezone: "Asia/Jakarta",
      grain: "hour",
      boundarySemantics: "[start, end)",
    };

    it("generates exact 4 hourly buckets and maps events correctly into target buckets", () => {
      const buckets = generateBuckets(timeContext);
      expect(buckets.length).toBe(4);
      expect(buckets[0].bucketKey).toBe("2026-09-01T10:00");
      expect(buckets[1].bucketKey).toBe("2026-09-01T11:00");
      expect(buckets[2].bucketKey).toBe("2026-09-01T12:00");
      expect(buckets[3].bucketKey).toBe("2026-09-01T13:00");

      // Simulated historical events
      const simulatedEvents = [
        // In 10:00 bucket (03:15 UTC)
        { rider_id: "r1", compliance_status: "COMPLIANT", captured_at: "2026-09-01T03:15:00.000Z" },
        { rider_id: "r2", compliance_status: "COMPLIANT", captured_at: "2026-09-01T03:45:00.000Z" },
        // In 12:00 bucket (05:20 UTC) - skipping 11:00 bucket
        { rider_id: "r1", compliance_status: "DEVIATED", captured_at: "2026-09-01T05:20:00.000Z" },
      ];

      const bucketMap = new Map<string, { count: number; compliant: number; deviated: number }>();
      for (const b of buckets) {
        bucketMap.set(b.bucketKey, { count: 0, compliant: 0, deviated: 0 });
      }

      for (const e of simulatedEvents) {
        const tb = getTemporalBucket(e.captured_at, timeContext.grain, timeContext.timezone);
        const slot = bucketMap.get(tb.bucketKey);
        if (slot) {
          slot.count++;
          if (e.compliance_status === "COMPLIANT") slot.compliant++;
          if (e.compliance_status === "DEVIATED") slot.deviated++;
        }
      }

      // Check 10:00 bucket: 2 compliant events
      expect(bucketMap.get("2026-09-01T10:00")?.count).toBe(2);
      expect(bucketMap.get("2026-09-01T10:00")?.compliant).toBe(2);

      // Check 11:00 bucket: preserved with 0 events
      expect(bucketMap.get("2026-09-01T11:00")?.count).toBe(0);

      // Check 12:00 bucket: 1 deviated event
      expect(bucketMap.get("2026-09-01T12:00")?.count).toBe(1);
      expect(bucketMap.get("2026-09-01T12:00")?.deviated).toBe(1);

      // Check 13:00 bucket: preserved with 0 events
      expect(bucketMap.get("2026-09-01T13:00")?.count).toBe(0);
    });

    it("strictly excludes events outside [rangeStart, rangeEnd)", () => {
      // Event before range (09:59 WIB = 02:59 UTC)
      expect(isWithinBoundary("2026-09-01T02:59:59.000Z", timeContext.rangeStart, timeContext.rangeEnd)).toBe(false);

      // Event exactly on rangeEnd (14:00 WIB = 07:00 UTC)
      expect(isWithinBoundary("2026-09-01T07:00:00.000Z", timeContext.rangeStart, timeContext.rangeEnd)).toBe(false);
    });
  });
});
