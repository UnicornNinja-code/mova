/*
 * analyticsTime.ts
 * S7-03-02: Time Range, Timezone & Temporal Bucketing Engine
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Half-Open Boundaries: [start, end) where rangeStart <= eventTime < rangeEnd.
 * 2. Pure IANA Timezone Validation: Uses runtime Intl capabilities (zero hardcoded lists).
 * 3. Instant Continuity: Timestamps are immutable instants in time; timezone dictates local grouping.
 * 4. ISO Week: Monday is day 1; ISO week-year rule (first Thursday / Jan 4th).
 * 5. Deterministic & Server-Independent: Same input + same context timezone = identical bucket.
 * 6. Zero synthetic events and zero DB alterations.
 */

import type {
  AnalyticsGrain,
  AnalyticsTimeContext,
  AnalyticsTimeRange,
} from "../../types/analytics.types.js";

export interface TemporalBucket {
  bucketKey: string;     // e.g. "2026-09-01T10:00:00+07:00", "2026-09-01", "2026-W36", "2026-09"
  bucketStart: string;   // ISO 8601 UTC timestamp of bucket start (inclusive)
  bucketEnd: string;     // ISO 8601 UTC timestamp of bucket end (exclusive)
  label: string;         // Human-readable formatted label in target timezone
}

export interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Validate IANA timezone identifier dynamically using Intl.DateTimeFormat
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string" || timeZone.trim() === "") {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse an ISO timestamp or date safely, returning null if invalid
 */
export function parseIsoTimestamp(isoString: any): Date | null {
  if (!isoString) return null;
  if (isoString instanceof Date) {
    return isNaN(isoString.getTime()) ? null : isoString;
  }
  if (typeof isoString !== "string" && typeof isoString !== "number") {
    return null;
  }

  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return null;
  }
  return d;
}

/**
 * Validate AnalyticsTimeContext according to S7-03-02 AC-01 to AC-07 & AC-25
 */
export function validateAnalyticsTimeContext(context: AnalyticsTimeContext): ValidationResult {
  if (!context) {
    return { valid: false, errorCode: "MISSING_CONTEXT", errorMessage: "AnalyticsTimeContext is required" };
  }

  // 1. Validate Timezone
  if (!isValidIanaTimezone(context.timezone)) {
    return {
      valid: false,
      errorCode: "INVALID_TIMEZONE",
      errorMessage: `Timezone '${context.timezone}' is not a valid IANA timezone identifier`,
    };
  }

  // 2. Validate Grain
  const validGrains: AnalyticsGrain[] = ["hour", "day", "week", "month"];
  if (!validGrains.includes(context.grain)) {
    return {
      valid: false,
      errorCode: "INVALID_GRAIN",
      errorMessage: `Grain '${context.grain}' is invalid. Supported grains: hour, day, week, month`,
    };
  }

  // 3. Validate Timestamps
  const start = parseIsoTimestamp(context.rangeStart);
  const end = parseIsoTimestamp(context.rangeEnd);

  if (!start) {
    return {
      valid: false,
      errorCode: "INVALID_TIMESTAMP",
      errorMessage: `rangeStart '${context.rangeStart}' is not a valid ISO 8601 timestamp`,
    };
  }

  if (!end) {
    return {
      valid: false,
      errorCode: "INVALID_TIMESTAMP",
      errorMessage: `rangeEnd '${context.rangeEnd}' is not a valid ISO 8601 timestamp`,
    };
  }

  // 4. Validate Range Order (rangeStart < rangeEnd)
  if (start.getTime() === end.getTime()) {
    return {
      valid: false,
      errorCode: "INVALID_TIME_RANGE",
      errorMessage: "rangeStart and rangeEnd cannot be equal in [start, end) half-open semantics",
    };
  }

  if (start.getTime() > end.getTime()) {
    return {
      valid: false,
      errorCode: "INVALID_TIME_RANGE",
      errorMessage: `rangeStart (${context.rangeStart}) must be strictly earlier than rangeEnd (${context.rangeEnd})`,
    };
  }

  return { valid: true };
}

/**
 * Check if a timestamp falls within half-open interval [start, end)
 * rangeStart <= eventTime < rangeEnd
 */
export function isWithinBoundary(
  timestamp: Date | string | number,
  rangeStart: Date | string | number,
  rangeEnd: Date | string | number
): boolean {
  const t = parseIsoTimestamp(timestamp);
  const s = parseIsoTimestamp(rangeStart);
  const e = parseIsoTimestamp(rangeEnd);

  if (!t || !s || !e) return false;

  const tMs = t.getTime();
  const sMs = s.getTime();
  const eMs = e.getTime();

  return tMs >= sMs && tMs < eMs;
}

export interface ZonedDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
  second: number;// 0-59
  millisecond: number;
  weekday: number; // 1 (Mon) to 7 (Sun) - ISO day of week
}

/**
 * Extract zoned calendar parts for a UTC Date in a given IANA timezone
 */
export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    millisecond: date.getUTCMilliseconds(),
    weekday: weekdayMap[map.weekday] || 1,
  };
}

/**
 * Convert local date-time components in target timezone to exact UTC Date
 * Uses 2-pass iterative convergence to handle daylight saving time (DST) shifts correctly.
 */
export function createUtcFromZonedParts(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  // Pass 0: Baseline UTC estimate
  let guessMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Pass 1 & 2: Iterative error correction against target timezone
  for (let iter = 0; iter < 3; iter++) {
    const zoned = getZonedDateParts(new Date(guessMs), timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const actualMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
    const diff = targetMs - actualMs;
    if (diff === 0) break;
    guessMs += diff;
  }

  return new Date(guessMs);
}

/**
 * Calculate ISO Week Year and Week Number (ISO 8601)
 * Week 1 is the week with the year's first Thursday (Jan 4th rule).
 */
export function getIsoWeekDetails(year: number, month: number, day: number, timeZone: string): { isoYear: number; isoWeek: number } {
  const currentUtc = createUtcFromZonedParts(year, month, day, 12, 0, 0, timeZone);
  const parts = getZonedDateParts(currentUtc, timeZone);

  // Target Thursday in the current week (ISO weekday 4)
  const daysToThursday = 4 - parts.weekday;
  const thursdayUtc = new Date(currentUtc.getTime() + daysToThursday * 86400000);
  const thursdayParts = getZonedDateParts(thursdayUtc, timeZone);

  const isoYear = thursdayParts.year;

  // Jan 4th of the ISO year is always in Week 1
  const jan4Utc = createUtcFromZonedParts(isoYear, 1, 4, 12, 0, 0, timeZone);
  const jan4Parts = getZonedDateParts(jan4Utc, timeZone);
  const jan4ThursdayUtc = new Date(jan4Utc.getTime() + (4 - jan4Parts.weekday) * 86400000);

  const weekNum = 1 + Math.round((thursdayUtc.getTime() - jan4ThursdayUtc.getTime()) / (7 * 86400000));

  return {
    isoYear,
    isoWeek: weekNum,
  };
}

/**
 * Compute the exact UTC start instant for a temporal bucket
 */
export function getBucketStart(dateInput: Date | string | number, grain: AnalyticsGrain, timeZone: string): Date {
  const d = parseIsoTimestamp(dateInput);
  if (!d) throw new Error(`Invalid date input for getBucketStart: ${dateInput}`);

  const p = getZonedDateParts(d, timeZone);

  switch (grain) {
    case "hour":
      return createUtcFromZonedParts(p.year, p.month, p.day, p.hour, 0, 0, timeZone);

    case "day":
      return createUtcFromZonedParts(p.year, p.month, p.day, 0, 0, 0, timeZone);

    case "week": {
      // Find Monday of the current ISO week (subtract (p.weekday - 1) days)
      const daysBack = p.weekday - 1;
      const refMs = d.getTime() - daysBack * 86400000;
      const refParts = getZonedDateParts(new Date(refMs), timeZone);
      return createUtcFromZonedParts(refParts.year, refParts.month, refParts.day, 0, 0, 0, timeZone);
    }

    case "month":
      return createUtcFromZonedParts(p.year, p.month, 1, 0, 0, 0, timeZone);
  }
}

/**
 * Compute the exact UTC end instant for a temporal bucket (exclusive boundary)
 */
export function getBucketEnd(bucketStart: Date, grain: AnalyticsGrain, timeZone: string): Date {
  const p = getZonedDateParts(bucketStart, timeZone);

  switch (grain) {
    case "hour": {
      // Add 1 hour in target timezone
      let nextHour = p.hour + 1;
      let nextDay = p.day;
      let nextMonth = p.month;
      let nextYear = p.year;

      if (nextHour >= 24) {
        nextHour = 0;
        nextDay += 1;
      }
      return createUtcFromZonedParts(nextYear, nextMonth, nextDay, nextHour, 0, 0, timeZone);
    }

    case "day": {
      // Next calendar day at 00:00:00 local time
      const nextDayEst = new Date(bucketStart.getTime() + 26 * 3600000); // Step into next day safely across DST
      const nextP = getZonedDateParts(nextDayEst, timeZone);
      return createUtcFromZonedParts(nextP.year, nextP.month, nextP.day, 0, 0, 0, timeZone);
    }

    case "week": {
      // Add 7 days to bucketStart (Monday -> Next Monday at 00:00:00)
      const nextWeekEst = new Date(bucketStart.getTime() + 7 * 86400000 + 3600000);
      const nextP = getZonedDateParts(nextWeekEst, timeZone);
      // Align to exact Monday
      const daysBack = nextP.weekday - 1;
      const alignEst = new Date(nextWeekEst.getTime() - daysBack * 86400000);
      const alignP = getZonedDateParts(alignEst, timeZone);
      return createUtcFromZonedParts(alignP.year, alignP.month, alignP.day, 0, 0, 0, timeZone);
    }

    case "month": {
      // Next calendar month on 1st at 00:00:00 local time
      let nextMonth = p.month + 1;
      let nextYear = p.year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      return createUtcFromZonedParts(nextYear, nextMonth, 1, 0, 0, 0, timeZone);
    }
  }
}

/**
 * Generate canonical, deterministic bucket key
 */
export function getBucketKey(bucketStart: Date, grain: AnalyticsGrain, timeZone: string): string {
  const p = getZonedDateParts(bucketStart, timeZone);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  switch (grain) {
    case "hour":
      return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:00`;

    case "day":
      return `${p.year}-${pad(p.month)}-${pad(p.day)}`;

    case "week": {
      const { isoYear, isoWeek } = getIsoWeekDetails(p.year, p.month, p.day, timeZone);
      return `${isoYear}-W${pad(isoWeek)}`;
    }

    case "month":
      return `${p.year}-${pad(p.month)}`;
  }
}

/**
 * Generate human-readable label for charts and UI presentation
 */
export function getBucketLabel(bucketStart: Date, grain: AnalyticsGrain, timeZone: string): string {
  const p = getZonedDateParts(bucketStart, timeZone);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  switch (grain) {
    case "hour":
      return `${pad(p.hour)}:00 (${pad(p.day)} ${monthNames[p.month - 1]})`;

    case "day":
      return `${pad(p.day)} ${monthNames[p.month - 1]} ${p.year}`;

    case "week": {
      const { isoYear, isoWeek } = getIsoWeekDetails(p.year, p.month, p.day, timeZone);
      return `Mgg ${isoWeek}, ${isoYear}`;
    }

    case "month":
      return `${monthNames[p.month - 1]} ${p.year}`;
  }
}

/**
 * Get single temporal bucket for a given timestamp
 */
export function getTemporalBucket(dateInput: Date | string | number, grain: AnalyticsGrain, timeZone: string): TemporalBucket {
  const start = getBucketStart(dateInput, grain, timeZone);
  const end = getBucketEnd(start, grain, timeZone);
  const bucketKey = getBucketKey(start, grain, timeZone);
  const label = getBucketLabel(start, grain, timeZone);

  return {
    bucketKey,
    bucketStart: start.toISOString(),
    bucketEnd: end.toISOString(),
    label,
  };
}

/**
 * Generate deterministic sequence of temporal buckets spanning [rangeStart, rangeEnd)
 */
export function generateBuckets(context: AnalyticsTimeContext): TemporalBucket[] {
  const validation = validateAnalyticsTimeContext(context);
  if (!validation.valid) {
    throw new Error(`Invalid AnalyticsTimeContext: [${validation.errorCode}] ${validation.errorMessage}`);
  }

  const rangeStart = new Date(context.rangeStart);
  const rangeEnd = new Date(context.rangeEnd);
  const buckets: TemporalBucket[] = [];

  let currentStart = getBucketStart(rangeStart, context.grain, context.timezone);

  // Safety loop guard (max 10,000 buckets)
  let loopCount = 0;
  while (currentStart.getTime() < rangeEnd.getTime() && loopCount < 10000) {
    loopCount++;
    const currentEnd = getBucketEnd(currentStart, context.grain, context.timezone);
    
    // Only include bucket if its start is strictly before rangeEnd
    if (currentStart.getTime() < rangeEnd.getTime()) {
      buckets.push({
        bucketKey: getBucketKey(currentStart, context.grain, context.timezone),
        bucketStart: currentStart.toISOString(),
        bucketEnd: currentEnd.toISOString(),
        label: getBucketLabel(currentStart, context.grain, context.timezone),
      });
    }

    currentStart = currentEnd;
  }

  return buckets;
}

/**
 * Calculate true elapsed physical duration in seconds based on absolute instants (DST-safe)
 */
export function calculateElapsedDurationSeconds(
  startedAt: Date | string | number,
  endedAt: Date | string | number
): number | null {
  const s = parseIsoTimestamp(startedAt);
  const e = parseIsoTimestamp(endedAt);

  if (!s || !e) return null;

  const diffMs = e.getTime() - s.getTime();
  if (diffMs < 0) return null;

  return Math.round(diffMs / 1000);
}
