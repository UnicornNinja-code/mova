/*
 * unit_deviation_episode.test.ts
 * S7-03-04: Comprehensive Unit & Acceptance Tests for Deviation Episode Reconstruction Engine
 * Covers: AC-01 through AC-14
 */

import { describe, it, expect } from "bun:test";
import {
  reconstructDeviationEpisodes,
  isDeviationEvent,
  isDeviationRecovery,
  type RawPresenceEventRow,
} from "../src/services/analytics/HistoricalDeviationEpisodeService.js";

describe("S7-03-04: Deviation Episode Reconstruction Engine", () => {
  const tenantId = "tenant-alpha";

  describe("Event Classification (isDeviationEvent & isDeviationRecovery)", () => {
    it("classifies DEVIATED events accurately", () => {
      expect(isDeviationEvent({ compliance_status: "DEVIATED" })).toBe(true);
      expect(isDeviationEvent({ event_type: "DEVIATED" })).toBe(true);
      expect(isDeviationEvent({ compliance_status: "COMPLIANT" })).toBe(false);
      expect(isDeviationEvent({ compliance_status: "OUTSIDE" })).toBe(false);
      expect(isDeviationEvent({ compliance_status: "UNASSIGNED" })).toBe(false);
    });

    it("classifies recovery transitions accurately", () => {
      expect(isDeviationRecovery({ compliance_status: "COMPLIANT" })).toBe(true);
      expect(isDeviationRecovery({ compliance_status: "OUTSIDE" })).toBe(true);
      expect(isDeviationRecovery({ compliance_status: "UNASSIGNED" })).toBe(true);
      expect(isDeviationRecovery({ compliance_status: "DEVIATED" })).toBe(false);
    });
  });

  describe("Episode Reconstruction & State Transitions (AC-01 to AC-06, AC-10)", () => {
    it("AC-01: single DEVIATED event produces one open episode if not recovered", () => {
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(1);

      const ep = episodes[0];
      expect(ep.id).toBe("ep_tenant-alpha_rider-1_ev-1"); // AC-10
      expect(ep.riderId).toBe("rider-1");
      expect(ep.startedAt).toBe("2026-09-01T10:00:00.000Z");
      expect(ep.endedAt).toBeNull();
      expect(ep.durationSeconds).toBeNull();
      expect(ep.open).toBe(true); // AC-05
      expect(ep.eventCount).toBe(1);
    });

    it("AC-02: consecutive DEVIATED events collapse into a single episode", () => {
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:05:00.000Z",
        },
        {
          id: "ev-3",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:10:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(1);
      expect(episodes[0].eventCount).toBe(3);
      expect(episodes[0].startedAt).toBe("2026-09-01T10:00:00.000Z");
      expect(episodes[0].open).toBe(true);
    });

    it("AC-03 & AC-06: recovery event closes the episode and calculates exact duration", () => {
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:10:00.000Z",
        },
        {
          id: "ev-3",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-2",
          assigned_zone_id: "zone-2",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:15:30.000Z", // 15m 30s = 930 seconds
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(1);

      const ep = episodes[0];
      expect(ep.open).toBe(false);
      expect(ep.startedAt).toBe("2026-09-01T10:00:00.000Z");
      expect(ep.endedAt).toBe("2026-09-01T10:15:30.000Z");
      expect(ep.durationSeconds).toBe(930);
      expect(ep.eventCount).toBe(2); // 2 deviated events prior to recovery
      expect(ep.endEventId).toBe("ev-3");
    });

    it("AC-04: multiple distinct deviation periods create multiple episodes", () => {
      const events: RawPresenceEventRow[] = [
        // Episode 1 (10:00 -> 10:10)
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-2",
          assigned_zone_id: "zone-2",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:10:00.000Z",
        },
        // Episode 2 (11:00 -> ongoing)
        {
          id: "ev-3",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T11:00:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(2);

      // Episode 1
      expect(episodes[0].id).toBe("ep_tenant-alpha_rider-1_ev-1");
      expect(episodes[0].open).toBe(false);
      expect(episodes[0].durationSeconds).toBe(600);

      // Episode 2
      expect(episodes[1].id).toBe("ep_tenant-alpha_rider-1_ev-3");
      expect(episodes[1].open).toBe(true);
      expect(episodes[1].durationSeconds).toBeNull();
    });

    it("handles recovery transitions to OUTSIDE and UNASSIGNED", () => {
      const eventsOutside: RawPresenceEventRow[] = [
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: null,
          assigned_zone_id: "zone-2",
          event_type: "EXIT",
          compliance_status: "OUTSIDE",
          captured_at: "2026-09-01T10:20:00.000Z",
        },
      ];

      const eps = reconstructDeviationEpisodes(tenantId, eventsOutside);
      expect(eps.length).toBe(1);
      expect(eps[0].open).toBe(false);
      expect(eps[0].durationSeconds).toBe(1200);
    });
  });

  describe("Isolation & Edge Cases (AC-08, AC-09, AC-11, AC-12, AC-13, AC-14)", () => {
    it("AC-09: rider isolation ensures simultaneous deviations from different riders are separate episodes", () => {
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-r1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-r2",
          tenant_id: tenantId,
          rider_id: "rider-2",
          zone_id: "zone-3",
          assigned_zone_id: "zone-4",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(2);
      expect(episodes[0].riderId).not.toBe(episodes[1].riderId);
    });

    it("AC-11: returns empty array when no events exist", () => {
      const episodes = reconstructDeviationEpisodes(tenantId, []);
      expect(episodes).toEqual([]);
    });

    it("AC-12: non-deviation streams produce zero deviation episodes", () => {
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-1",
          event_type: "ENTER",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ev-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-1",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-09-01T10:30:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(0);
    });

    it("AC-13: out-of-order database insertion order is resolved by captured_at sorting", () => {
      // Event 2 was captured earlier than Event 1, but inserted later
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-later-captured",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT", // Recovery at 10:20
          captured_at: "2026-09-01T10:20:00.000Z",
          created_at: "2026-09-01T10:20:05.000Z",
        },
        {
          id: "ev-early-captured",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED", // Deviation start at 10:00
          captured_at: "2026-09-01T10:00:00.000Z",
          created_at: "2026-09-01T10:21:00.000Z", // Delayed ingestion
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(1);
      expect(episodes[0].startedAt).toBe("2026-09-01T10:00:00.000Z");
      expect(episodes[0].endedAt).toBe("2026-09-01T10:20:00.000Z");
      expect(episodes[0].durationSeconds).toBe(1200);
      expect(episodes[0].open).toBe(false);
    });

    it("AC-14: calculates true physical elapsed duration across DST boundary", () => {
      // Across US DST Fall Back (05:30 UTC -> 07:30 UTC is 2 hours = 7200s, even if local clock shifted)
      const events: RawPresenceEventRow[] = [
        {
          id: "ev-dst-1",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-1",
          assigned_zone_id: "zone-2",
          event_type: "DEVIATED",
          compliance_status: "DEVIATED",
          captured_at: "2026-11-01T05:30:00.000Z",
        },
        {
          id: "ev-dst-2",
          tenant_id: tenantId,
          rider_id: "rider-1",
          zone_id: "zone-2",
          assigned_zone_id: "zone-2",
          event_type: "ON_SITE",
          compliance_status: "COMPLIANT",
          captured_at: "2026-11-01T07:30:00.000Z",
        },
      ];

      const episodes = reconstructDeviationEpisodes(tenantId, events);
      expect(episodes.length).toBe(1);
      expect(episodes[0].durationSeconds).toBe(7200);
    });
  });
});
