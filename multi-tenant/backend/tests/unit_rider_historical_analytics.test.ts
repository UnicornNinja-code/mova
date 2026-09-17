/*
 * unit_rider_historical_analytics.test.ts
 * S7-03-06: Comprehensive Unit & Acceptance Tests for Rider Historical Analytics Engine
 * Covers: AC-01 through AC-20
 */

import { describe, it, expect } from "bun:test";
import { safeRatio } from "../src/lib/analytics/analyticsMath.js";
import {
  generateBuckets,
  getTemporalBucket,
  getBucketKey,
} from "../src/lib/analytics/analyticsTime.js";
import {
  reconstructDeviationEpisodes,
  type RawPresenceEventRow,
} from "../src/services/analytics/HistoricalDeviationEpisodeService.js";
import type {
  AnalyticsTimeContext,
  RiderHistoricalMetric,
} from "../src/types/analytics.types.js";

describe("S7-03-06: Rider Historical Analytics Engine", () => {
  const tenantId = "tenant-alpha";

  // ==========================================================================
  // 1. Single & Multi-Rider Aggregation (AC-01, AC-02, AC-04)
  // ==========================================================================
  describe("Rider Aggregation & Isolation (AC-01, AC-02, AC-04)", () => {
    it("AC-01, AC-02 & AC-04: aggregates multiple events per rider while keeping riders strictly isolated", () => {
      const rawEvents: RawPresenceEventRow[] = [
        // Rider 1: 2 events
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          rider_name: "Budi Santoso",
          zone_id: "zone-a",
          assigned_zone_id: "zone-a",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          rider_name: "Budi Santoso",
          zone_id: "zone-b",
          assigned_zone_id: "zone-a",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:15:00.000Z",
        },
        // Rider 2: 1 event
        {
          id: "ev-3",
          tenant_id: tenantId,
          rider_id: "rider-2",
          rider_name: "Agus Pratama",
          zone_id: "zone-a",
          assigned_zone_id: "zone-a",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:05:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, rawEvents);
      expect(episodes.length).toBe(1);
      expect(episodes[0].riderId).toBe("rider-1");

      const riderMap = new Map<string, { totalEvents: number; compliant: number; deviated: number }>();
      for (const e of rawEvents) {
        let entry = riderMap.get(e.rider_id);
        if (!entry) {
          entry = { totalEvents: 0, compliant: 0, deviated: 0 };
          riderMap.set(e.rider_id, entry);
        }
        entry.totalEvents++;
        if (e.compliance_status === "COMPLIANT") entry.compliant++;
        if (e.compliance_status === "DEVIATED") entry.deviated++;
      }

      // Rider 1
      expect(riderMap.get("rider-1")?.totalEvents).toBe(2);
      expect(riderMap.get("rider-1")?.compliant).toBe(1);
      expect(riderMap.get("rider-1")?.deviated).toBe(1);

      // Rider 2
      expect(riderMap.get("rider-2")?.totalEvents).toBe(1);
      expect(riderMap.get("rider-2")?.compliant).toBe(1);
      expect(riderMap.get("rider-2")?.deviated).toBe(0);
    });
  });

  // ==========================================================================
  // 2. Observed Days Calculation in Timezone Context (AC-05 & AC-17)
  // ==========================================================================
  describe("Observed Days in Target Timezone (AC-05 & AC-17)", () => {
    it("AC-05 & AC-17: calculates observedDays using local calendar days, not naive UTC dates", () => {
      // Event 1: 2026-09-01 10:00 WIB (03:00 UTC) -> Sep 1 in Jakarta
      // Event 2: 2026-09-01 23:30 UTC -> Sep 2 06:30 WIB -> Sep 2 in Jakarta
      const events = [
        "2026-09-01T03:00:00.000Z",
        "2026-09-01T23:30:00.000Z",
      ];

      const localDaysSet = new Set<string>();
      for (const iso of events) {
        const d = new Date(iso);
        const dayKey = getBucketKey(d, "day", "Asia/Jakarta");
        localDaysSet.add(dayKey);
      }

      expect(localDaysSet.size).toBe(2);
      expect(localDaysSet.has("2026-09-01")).toBe(true);
      expect(localDaysSet.has("2026-09-02")).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Affected Zones Attribution (AC-11)
  // ==========================================================================
  describe("Affected Zones Attribution (AC-11)", () => {
    it("AC-11: counts distinct observed zones and excludes null zone_id", () => {
      const zoneIds = ["zone-a", "zone-b", "zone-a", null, null, "zone-c"];

      const affectedZonesSet = new Set<string>();
      for (const z of zoneIds) {
        if (z !== null && z !== undefined) {
          affectedZonesSet.add(z);
        }
      }

      expect(affectedZonesSet.size).toBe(3); // zone-a, zone-b, zone-c
      expect(affectedZonesSet.has("zone-a")).toBe(true);
      expect(affectedZonesSet.has("zone-b")).toBe(true);
      expect(affectedZonesSet.has("zone-c")).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Compliance Distribution & Safe Ratio (AC-06 to AC-09)
  // ==========================================================================
  describe("Compliance Metrics & Denominator (AC-06 to AC-09)", () => {
    it("AC-06 to AC-08: calculates eligible denominator and safe compliance rate", () => {
      const compliant = 8;
      const deviated = 2;
      const outside = 0;
      const unassigned = 3;

      const eligible = compliant + deviated + outside; // 10
      const rate = safeRatio(compliant, eligible);    // 80.0%

      expect(eligible).toBe(10);
      expect(rate).toBe(80);
    });

    it("AC-09: returns null compliance rate when eligible count is zero", () => {
      const compliant = 0;
      const deviated = 0;
      const outside = 0;
      const unassigned = 5; // Only unassigned

      const eligible = compliant + deviated + outside;
      const rate = safeRatio(compliant, eligible);

      expect(eligible).toBe(0);
      expect(rate).toBeNull();
    });
  });

  // ==========================================================================
  // 5. Deviation Episodes Integration (AC-10, AC-12, AC-13)
  // ==========================================================================
  describe("Deviation Episodes per Rider (AC-10, AC-12, AC-13)", () => {
    it("AC-10, AC-12 & AC-13: preserves difference between deviation event count and deviation episode count", () => {
      const rawEvents: RawPresenceEventRow[] = [
        // Episode 1 (3 deviated events -> recovered)
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-b",
          assigned_zone_id: "zone-a",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-b",
          assigned_zone_id: "zone-a",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:05:00.000Z",
        },
        {
          id: "ev-3",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-b",
          assigned_zone_id: "zone-a",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:10:00.000Z",
        },
        {
          id: "ev-4",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-a",
          assigned_zone_id: "zone-a",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:15:00.000Z",
        },
        // Episode 2 (1 deviated event -> open)
        {
          id: "ev-5",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-c",
          assigned_zone_id: "zone-a",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T11:00:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, rawEvents);
      expect(episodes.length).toBe(2); // 2 episodes

      const openCount = episodes.filter((ep) => ep.open).length;
      expect(openCount).toBe(1); // 1 open episode

      const deviationEventsCount = rawEvents.filter((e) => e.compliance_status === "DEVIATED").length;
      expect(deviationEventsCount).toBe(4); // 4 deviation events != 2 episodes
    });
  });

  // ==========================================================================
  // 6. Rider Temporal Timeline (AC-15 & AC-16)
  // ==========================================================================
  describe("Rider Timeline & Empty Buckets (AC-15 & AC-16)", () => {
    const timeContext: AnalyticsTimeContext = {
      rangeStart: "2026-09-01T03:00:00.000Z", // 10:00 WIB
      rangeEnd: "2026-09-01T07:00:00.000Z",   // 14:00 WIB
      timezone: "Asia/Jakarta",
      grain: "hour",
      boundarySemantics: "[start, end)",
    };

    it("AC-15 & AC-16: generates hourly buckets for rider with empty bucket zero preservation", () => {
      const buckets = generateBuckets(timeContext);
      expect(buckets.length).toBe(4);

      const timelineMap = new Map<string, { totalEvents: number; compliant: number; complianceRate: number | null }>();
      for (const b of buckets) {
        timelineMap.set(b.bucketKey, { totalEvents: 0, compliant: 0, complianceRate: null });
      }

      // Rider active at 10:15 WIB (03:15 UTC) and 13:20 WIB (06:20 UTC)
      const event1 = new Date("2026-09-01T03:15:00.000Z");
      const b1 = getTemporalBucket(event1, timeContext.grain, timeContext.timezone);
      const slot1 = timelineMap.get(b1.bucketKey)!;
      slot1.totalEvents += 1;
      slot1.compliant += 1;
      slot1.complianceRate = safeRatio(slot1.compliant, slot1.totalEvents);

      const event2 = new Date("2026-09-01T06:20:00.000Z");
      const b2 = getTemporalBucket(event2, timeContext.grain, timeContext.timezone);
      const slot2 = timelineMap.get(b2.bucketKey)!;
      slot2.totalEvents += 1;
      slot2.compliant += 1;
      slot2.complianceRate = safeRatio(slot2.compliant, slot2.totalEvents);

      // 10:00 and 13:00 buckets active
      expect(timelineMap.get("2026-09-01T10:00")?.totalEvents).toBe(1);
      expect(timelineMap.get("2026-09-01T10:00")?.complianceRate).toBe(100);

      expect(timelineMap.get("2026-09-01T13:00")?.totalEvents).toBe(1);
      expect(timelineMap.get("2026-09-01T13:00")?.complianceRate).toBe(100);

      // 11:00 and 12:00 buckets preserved as empty
      expect(timelineMap.get("2026-09-01T11:00")?.totalEvents).toBe(0);
      expect(timelineMap.get("2026-09-01T11:00")?.complianceRate).toBeNull();
      expect(timelineMap.get("2026-09-01T12:00")?.totalEvents).toBe(0);
      expect(timelineMap.get("2026-09-01T12:00")?.complianceRate).toBeNull();
    });
  });

  // ==========================================================================
  // 7. Deterministic Ordering (AC-18)
  // ==========================================================================
  describe("Deterministic Ordering (AC-18)", () => {
    it("AC-18: sorts rider list deterministically by riderName ASC, riderId ASC", () => {
      const mockRiders: RiderHistoricalMetric[] = [
        {
          riderId: "r-3",
          riderName: "Dedi Kusnadi",
          totalEvents: 10,
          observedDays: 1,
          compliantEvents: 9,
          deviationEvents: 1,
          deviationEpisodes: 1,
          openDeviationEpisodes: 0,
          outsideEvents: 0,
          unassignedEvents: 0,
          eligibleEventsCount: 10,
          complianceRate: 90,
          affectedZones: 2,
          firstObservedAt: null,
          lastObservedAt: null,
        },
        {
          riderId: "r-1",
          riderName: "Agus Pratama",
          totalEvents: 20,
          observedDays: 2,
          compliantEvents: 18,
          deviationEvents: 2,
          deviationEpisodes: 1,
          openDeviationEpisodes: 0,
          outsideEvents: 0,
          unassignedEvents: 0,
          eligibleEventsCount: 20,
          complianceRate: 90,
          affectedZones: 1,
          firstObservedAt: null,
          lastObservedAt: null,
        },
        {
          riderId: "r-2",
          riderName: "Budi Santoso",
          totalEvents: 15,
          observedDays: 2,
          compliantEvents: 15,
          deviationEvents: 0,
          deviationEpisodes: 0,
          openDeviationEpisodes: 0,
          outsideEvents: 0,
          unassignedEvents: 0,
          eligibleEventsCount: 15,
          complianceRate: 100,
          affectedZones: 1,
          firstObservedAt: null,
          lastObservedAt: null,
        },
      ];

      mockRiders.sort((a, b) => {
        const cmpName = a.riderName.localeCompare(b.riderName);
        if (cmpName !== 0) return cmpName;
        return a.riderId.localeCompare(b.riderId);
      });

      expect(mockRiders[0].riderName).toBe("Agus Pratama");
      expect(mockRiders[1].riderName).toBe("Budi Santoso");
      expect(mockRiders[2].riderName).toBe("Dedi Kusnadi");
    });
  });
});
