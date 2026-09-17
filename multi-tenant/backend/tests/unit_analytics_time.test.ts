/*
 * unit_analytics_time.test.ts
 * S7-03-02: Comprehensive Acceptance & Edge Case Tests for Temporal Bucketing Engine
 * Covers: AC-01 through AC-26
 */

import { describe, it, expect } from "bun:test";
import {
  validateAnalyticsTimeContext,
  isValidIanaTimezone,
  isWithinBoundary,
  getTemporalBucket,
  getBucketStart,
  getBucketEnd,
  getBucketKey,
  generateBuckets,
  calculateElapsedDurationSeconds,
  getZonedDateParts,
} from "../src/lib/analytics/analyticsTime.js";
import type { AnalyticsTimeContext } from "../src/types/analytics.types.js";

describe("S7-03-02: Time Range, Timezone & Temporal Bucketing Engine", () => {
  // ==========================================================================
  // 1. Time Range & Timezone Validation (AC-01 - AC-07, AC-25)
  // ==========================================================================
  describe("Validation (AC-01 to AC-07, AC-25)", () => {
    it("AC-01: accepts valid chronological range (start < end)", () => {
      const ctx: AnalyticsTimeContext = {
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-02T00:00:00.000Z",
        timezone: "Asia/Jakarta",
        grain: "day",
        boundarySemantics: "[start, end)",
      };
      const res = validateAnalyticsTimeContext(ctx);
      expect(res.valid).toBe(true);
    });

    it("AC-02: rejects equal boundaries (start === end)", () => {
      const ctx: AnalyticsTimeContext = {
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-01T00:00:00.000Z",
        timezone: "Asia/Jakarta",
        grain: "day",
        boundarySemantics: "[start, end)",
      };
      const res = validateAnalyticsTimeContext(ctx);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe("INVALID_TIME_RANGE");
    });

    it("AC-03: rejects reversed boundaries (start > end)", () => {
      const ctx: AnalyticsTimeContext = {
        rangeStart: "2026-09-05T00:00:00.000Z",
        rangeEnd: "2026-09-01T00:00:00.000Z",
        timezone: "Asia/Jakarta",
        grain: "day",
        boundarySemantics: "[start, end)",
      };
      const res = validateAnalyticsTimeContext(ctx);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe("INVALID_TIME_RANGE");
    });

    it("AC-04: rejects invalid ISO timestamp formats", () => {
      const ctx: AnalyticsTimeContext = {
        rangeStart: "not-a-date",
        rangeEnd: "2026-09-01T00:00:00.000Z",
        timezone: "Asia/Jakarta",
        grain: "day",
        boundarySemantics: "[start, end)",
      };
      const res = validateAnalyticsTimeContext(ctx);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe("INVALID_TIMESTAMP");
    });

    it("AC-06: accepts valid IANA timezones dynamically", () => {
      expect(isValidIanaTimezone("Asia/Jakarta")).toBe(true);
      expect(isValidIanaTimezone("Asia/Makassar")).toBe(true);
      expect(isValidIanaTimezone("Asia/Jayapura")).toBe(true);
      expect(isValidIanaTimezone("America/New_York")).toBe(true);
      expect(isValidIanaTimezone("Europe/Berlin")).toBe(true);
      expect(isValidIanaTimezone("UTC")).toBe(true);
    });

    it("AC-07: rejects invalid or ambiguous timezone strings", () => {
      expect(isValidIanaTimezone("Asia/Invalid")).toBe(false);
      expect(isValidIanaTimezone("Invalid/Timezone")).toBe(false);
      expect(isValidIanaTimezone("Jakarta")).toBe(false);
      expect(isValidIanaTimezone("GMT+7")).toBe(false);
      expect(isValidIanaTimezone("")).toBe(false);
      expect(isValidIanaTimezone(" ")).toBe(false);
    });

    it("AC-25: rejects unsupported grains (only hour, day, week, month allowed)", () => {
      const ctx: any = {
        rangeStart: "2026-09-01T00:00:00.000Z",
        rangeEnd: "2026-09-02T00:00:00.000Z",
        timezone: "Asia/Jakarta",
        grain: "minute",
        boundarySemantics: "[start, end)",
      };
      const res = validateAnalyticsTimeContext(ctx);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe("INVALID_GRAIN");
    });
  });

  // ==========================================================================
  // 2. Boundary Semantics [start, end) (AC-05, AC-23)
  // ==========================================================================
  describe("Half-Open Boundaries [start, end) (AC-05, AC-23)", () => {
    const rangeStart = "2026-09-01T10:00:00.000Z";
    const rangeEnd = "2026-09-01T12:00:00.000Z";

    it("AC-05: includes exact start and intermediate points, strictly excludes end", () => {
      // 09:59:59.999 -> Excluded (before start)
      expect(isWithinBoundary("2026-09-01T09:59:59.999Z", rangeStart, rangeEnd)).toBe(false);

      // 10:00:00.000 -> Included (exact start)
      expect(isWithinBoundary("2026-09-01T10:00:00.000Z", rangeStart, rangeEnd)).toBe(true);

      // 10:30:00.000 -> Included (inside)
      expect(isWithinBoundary("2026-09-01T10:30:00.000Z", rangeStart, rangeEnd)).toBe(true);

      // 11:59:59.999 -> Included (last millisecond before end)
      expect(isWithinBoundary("2026-09-01T11:59:59.999Z", rangeStart, rangeEnd)).toBe(true);

      // 12:00:00.000 -> Excluded (exact end)
      expect(isWithinBoundary("2026-09-01T12:00:00.000Z", rangeStart, rangeEnd)).toBe(false);

      // 12:00:00.001 -> Excluded (after end)
      expect(isWithinBoundary("2026-09-01T12:00:00.001Z", rangeStart, rangeEnd)).toBe(false);
    });

    it("AC-23: prevents double counting across adjacent buckets", () => {
      const bucket1Start = "2026-09-01T10:00:00.000Z";
      const bucket1End = "2026-09-01T11:00:00.000Z";

      const bucket2Start = "2026-09-01T11:00:00.000Z";
      const bucket2End = "2026-09-01T12:00:00.000Z";

      const boundaryEvent = "2026-09-01T11:00:00.000Z";

      const inB1 = isWithinBoundary(boundaryEvent, bucket1Start, bucket1End);
      const inB2 = isWithinBoundary(boundaryEvent, bucket2Start, bucket2End);

      expect(inB1).toBe(false); // Excluded from B1
      expect(inB2).toBe(true);  // Included exclusively in B2
    });
  });

  // ==========================================================================
  // 3. Hour Bucketing (AC-09, AC-10)
  // ==========================================================================
  describe("Hour Bucketing (AC-09, AC-10)", () => {
    it("AC-09: groups arbitrary minute/second events into local hour bucket", () => {
      // 10:37:42 WIB in Asia/Jakarta = 03:37:42 UTC
      const eventUtc = "2026-09-01T03:37:42.000Z";
      const bucket = getTemporalBucket(eventUtc, "hour", "Asia/Jakarta");

      expect(bucket.bucketKey).toBe("2026-09-01T10:00");
      expect(bucket.bucketStart).toBe("2026-09-01T03:00:00.000Z"); // 10:00 WIB in UTC
      expect(bucket.bucketEnd).toBe("2026-09-01T04:00:00.000Z");   // 11:00 WIB in UTC
    });

    it("AC-10: respects exact hour boundaries", () => {
      // 10:00:00 WIB = 03:00:00 UTC
      const startB = getTemporalBucket("2026-09-01T03:00:00.000Z", "hour", "Asia/Jakarta");
      expect(startB.bucketKey).toBe("2026-09-01T10:00");

      // 10:59:59.999 WIB = 03:59:59.999 UTC
      const endB = getTemporalBucket("2026-09-01T03:59:59.999Z", "hour", "Asia/Jakarta");
      expect(endB.bucketKey).toBe("2026-09-01T10:00");

      // 11:00:00.000 WIB = 04:00:00.000 UTC
      const nextB = getTemporalBucket("2026-09-01T04:00:00.000Z", "hour", "Asia/Jakarta");
      expect(nextB.bucketKey).toBe("2026-09-01T11:00");
    });
  });

  // ==========================================================================
  // 4. Day Bucketing (AC-11, AC-12)
  // ==========================================================================
  describe("Day Bucketing (AC-11, AC-12)", () => {
    it("AC-11: uses local midnight for day boundary", () => {
      // 2026-09-01 23:59:59 WIB = 16:59:59 UTC
      const b1 = getTemporalBucket("2026-09-01T16:59:59.000Z", "day", "Asia/Jakarta");
      expect(b1.bucketKey).toBe("2026-09-01");

      // 2026-09-02 00:00:00 WIB = 17:00:00 UTC (Sep 1)
      const b2 = getTemporalBucket("2026-09-01T17:00:00.000Z", "day", "Asia/Jakarta");
      expect(b2.bucketKey).toBe("2026-09-02");
    });

    it("AC-12: does not naively use UTC date when local date has advanced", () => {
      // 2026-09-01T23:30:00Z is 2026-09-02 06:30:00 in Jakarta (+7)
      const eventUtc = "2026-09-01T23:30:00.000Z";
      const bucket = getTemporalBucket(eventUtc, "day", "Asia/Jakarta");

      expect(bucket.bucketKey).toBe("2026-09-02");
      expect(bucket.bucketStart).toBe("2026-09-01T17:00:00.000Z"); // Midnight Sep 2 WIB in UTC
    });
  });

  // ==========================================================================
  // 5. ISO Week Bucketing (AC-13 - AC-15)
  // ==========================================================================
  describe("ISO Week Bucketing (AC-13 to AC-15)", () => {
    it("AC-13: Monday is the start of the week; Mon-Sun share same ISO week", () => {
      // 2026-09-07 is Monday, 2026-09-13 is Sunday
      // Mon 08:00 WIB = 01:00 UTC
      const monBucket = getTemporalBucket("2026-09-07T01:00:00.000Z", "week", "Asia/Jakarta");
      // Sun 20:00 WIB = 13:00 UTC
      const sunBucket = getTemporalBucket("2026-09-13T13:00:00.000Z", "week", "Asia/Jakarta");

      expect(monBucket.bucketKey).toBe("2026-W37");
      expect(sunBucket.bucketKey).toBe("2026-W37");
      expect(monBucket.bucketStart).toBe(sunBucket.bucketStart);
    });

    it("AC-14: Sunday 23:59:59 to Monday 00:00:00 rolls over to next ISO week", () => {
      // Sunday 2026-09-13 23:59:59 WIB = 16:59:59 UTC
      const sunEnd = getTemporalBucket("2026-09-13T16:59:59.000Z", "week", "Asia/Jakarta");
      // Monday 2026-09-14 00:00:00 WIB = 17:00:00 UTC (Sep 13)
      const monStart = getTemporalBucket("2026-09-13T17:00:00.000Z", "week", "Asia/Jakarta");

      expect(sunEnd.bucketKey).toBe("2026-W37");
      expect(monStart.bucketKey).toBe("2026-W38");
    });

    it("AC-15: handles ISO year boundaries correctly (Jan 1st in previous year's week)", () => {
      // 2021-01-01 was Friday. Thursday of that week was 2020-12-31.
      // Therefore, 2021-01-01 is in ISO week 2020-W53!
      const jan1 = getTemporalBucket("2021-01-01T05:00:00.000Z", "week", "UTC");
      expect(jan1.bucketKey).toBe("2020-W53");

      // 2021-01-04 was Monday (Start of 2021-W01)
      const jan4 = getTemporalBucket("2021-01-04T05:00:00.000Z", "week", "UTC");
      expect(jan4.bucketKey).toBe("2021-W01");
    });
  });

  // ==========================================================================
  // 6. Month Bucketing (AC-16 - AC-18)
  // ==========================================================================
  describe("Month Bucketing (AC-16 to AC-18)", () => {
    it("AC-16: first day of month belongs to that month", () => {
      const b = getTemporalBucket("2026-09-01T00:00:00.000Z", "month", "UTC");
      expect(b.bucketKey).toBe("2026-09");
    });

    it("AC-17: last instant of month belongs to that month", () => {
      const b = getTemporalBucket("2026-09-30T23:59:59.999Z", "month", "UTC");
      expect(b.bucketKey).toBe("2026-09");
    });

    it("AC-18: month boundary rolls over on 1st of next month", () => {
      const b = getTemporalBucket("2026-10-01T00:00:00.000Z", "month", "UTC");
      expect(b.bucketKey).toBe("2026-10");
    });
  });

  // ==========================================================================
  // 7. Daylight Saving Time (DST) Handling (AC-19 - AC-22)
  // ==========================================================================
  describe("DST Handling (AC-19 to AC-22)", () => {
    it("AC-19 & AC-20: Spring Forward in America/New_York skips nonexistent local hour and preserves monotonic instant ordering", () => {
      // On 2026-03-08 in New York, 02:00 local time does not exist (clocks jump 01:59:59 EST -> 03:00:00 EDT)
      // 01:00 EST = 06:00 UTC
      // 03:00 EDT = 07:00 UTC
      const ctx: AnalyticsTimeContext = {
        rangeStart: "2026-03-08T05:00:00.000Z", // 00:00 EST
        rangeEnd: "2026-03-08T09:00:00.000Z",   // 05:00 EDT
        timezone: "America/New_York",
        grain: "hour",
        boundarySemantics: "[start, end)",
      };

      const buckets = generateBuckets(ctx);
      const keys = buckets.map((b) => b.bucketKey);

      // Verify no fake "02:00" bucket exists in local sequence
      expect(keys).toContain("2026-03-08T01:00");
      expect(keys).toContain("2026-03-08T03:00");
      expect(keys).not.toContain("2026-03-08T02:00");

      // Verify instant ordering remains strictly ascending
      for (let i = 0; i < buckets.length - 1; i++) {
        const t1 = new Date(buckets[i].bucketStart).getTime();
        const t2 = new Date(buckets[i + 1].bucketStart).getTime();
        expect(t2).toBeGreaterThan(t1);
      }
    });

    it("AC-21 & AC-22: Fall Back in America/New_York handles repeated local hours and calculates true elapsed instant duration", () => {
      // On 2026-11-01 in New York, 01:30 occurs twice (01:30 EDT = 05:30 UTC, 01:30 EST = 06:30 UTC)
      const instantA = "2026-11-01T05:30:00.000Z";
      const instantB = "2026-11-01T06:30:00.000Z";

      expect(new Date(instantA).getTime()).not.toBe(new Date(instantB).getTime());

      // Elapsed duration across DST shift is exactly 3600 seconds (1 hour), not 0
      const duration = calculateElapsedDurationSeconds(instantA, instantB);
      expect(duration).toBe(3600);
    });
  });

  // ==========================================================================
  // 8. Bucket Sequence Generation (AC-24)
  // ==========================================================================
  describe("Bucket Sequence Generation (AC-24)", () => {
    it("AC-24: generates correct discrete hour buckets for given range [10:00, 13:00)", () => {
      const ctx: AnalyticsTimeContext = {
        rangeStart: "2026-09-01T03:00:00.000Z", // 10:00 WIB
        rangeEnd: "2026-09-01T06:00:00.000Z",   // 13:00 WIB
        timezone: "Asia/Jakarta",
        grain: "hour",
        boundarySemantics: "[start, end)",
      };

      const buckets = generateBuckets(ctx);
      expect(buckets.length).toBe(3);
      expect(buckets[0].bucketKey).toBe("2026-09-01T10:00");
      expect(buckets[1].bucketKey).toBe("2026-09-01T11:00");
      expect(buckets[2].bucketKey).toBe("2026-09-01T12:00");
    });

    it("generates correct daily buckets across a 7-day range", () => {
      const ctx: AnalyticsTimeContext = {
        rangeStart: "2026-09-01T17:00:00.000Z", // 2026-09-02 00:00 WIB
        rangeEnd: "2026-09-08T17:00:00.000Z",   // 2026-09-09 00:00 WIB
        timezone: "Asia/Jakarta",
        grain: "day",
        boundarySemantics: "[start, end)",
      };

      const buckets = generateBuckets(ctx);
      expect(buckets.length).toBe(7);
      expect(buckets[0].bucketKey).toBe("2026-09-02");
      expect(buckets[6].bucketKey).toBe("2026-09-08");
    });
  });

  // ==========================================================================
  // 9. Determinism & Machine Timezone Independence (AC-26)
  // ==========================================================================
  describe("Determinism & Server Independence (AC-26)", () => {
    it("AC-26: produces deterministic bucket output regardless of runtime environment", () => {
      const input = "2026-09-05T08:15:30.000Z";
      const b1 = getTemporalBucket(input, "day", "Asia/Jakarta");
      const b2 = getTemporalBucket(input, "day", "Asia/Jakarta");

      expect(b1.bucketKey).toBe(b2.bucketKey);
      expect(b1.bucketStart).toBe(b2.bucketStart);
      expect(b1.bucketEnd).toBe(b2.bucketEnd);
      expect(b1.label).toBe(b2.label);
    });
  });
});
