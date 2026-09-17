/*
 * analyticsMath.ts
 * S7-03-01: Deterministic Mathematical Utilities for Historical Analytics
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Safe Ratio: Never divide by zero, returns null if denominator === 0.
 * 2. Safe Comparison: Period deltas handle zero/null previous periods explicitly.
 * 3. Deterministic IDs: Episode identifiers are computed from tenant, rider, and start event.
 * 4. Authoritative Invariant: SQL ordering must be (rider_id, captured_at, created_at, id).
 */

import type {
  AnalyticsCapabilities,
  PeriodMetricComparison,
  PeriodDeltaDirection,
} from "../../types/analytics.types.js";

/**
 * SQL Invariant for all time-series and state-transition queries
 */
export const AUTHORITATIVE_EVENT_ORDERING = "ORDER BY rider_id ASC, captured_at ASC, created_at ASC, id ASC";

/**
 * Calculate safe percentage ratio without division by zero or NaN/Infinity.
 * @param numerator - Count of positive instances (e.g. compliant count)
 * @param denominator - Total eligible count
 * @param decimals - Decimal precision (default: 2)
 * @returns number (e.g. 95.42) or null if denominator is 0 or non-positive
 */
export function safeRatio(
  numerator: number,
  denominator: number,
  decimals: number = 2
): number | null {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    isNaN(numerator) ||
    isNaN(denominator) ||
    !isFinite(numerator) ||
    !isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  const rawPercent = (numerator / denominator) * 100;
  const factor = Math.pow(10, decimals);
  return Math.round(rawPercent * factor) / factor;
}

/**
 * Calculate period-over-period comparison delta with strict guardrails (S7-03-07).
 * Absolute Delta = current - previous (if both available)
 * 
 * Strict Semantic Rules:
 * - current is null OR previous is null -> UNAVAILABLE, absoluteDelta = null
 * - previous === 0 and current > 0 -> UP_FROM_ZERO, absoluteDelta = current
 * - previous > 0 and current === 0 -> DOWN_TO_ZERO, absoluteDelta = -previous
 * - current === previous -> UNCHANGED, absoluteDelta = 0
 * - current > previous -> UP, absoluteDelta = current - previous
 * - current < previous -> DOWN, absoluteDelta = current - previous
 */
export function calculatePeriodDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  decimals: number = 2
): PeriodMetricComparison {
  const isCurrentValid =
    typeof current === "number" && !isNaN(current) && isFinite(current);
  const isPreviousValid =
    typeof previous === "number" && !isNaN(previous) && isFinite(previous);

  if (!isCurrentValid || !isPreviousValid) {
    return {
      current: isCurrentValid ? current : null,
      previous: isPreviousValid ? previous : null,
      absoluteDelta: null,
      direction: "UNAVAILABLE",
    };
  }

  const factor = Math.pow(10, decimals);
  const rawAbsoluteDelta = current - previous;
  const absoluteDelta = Math.round(rawAbsoluteDelta * factor) / factor;

  // Previous was zero
  if (previous === 0) {
    if (current > 0) {
      return {
        current,
        previous: 0,
        absoluteDelta,
        direction: "UP_FROM_ZERO",
      };
    }
    if (current === 0) {
      return {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        direction: "UNCHANGED",
      };
    }
    if (current < 0) {
      return {
        current,
        previous: 0,
        absoluteDelta,
        direction: "DOWN",
      };
    }
  }

  // Previous was non-zero
  if (current === 0 && previous > 0) {
    return {
      current: 0,
      previous,
      absoluteDelta,
      direction: "DOWN_TO_ZERO",
    };
  }

  let direction: PeriodDeltaDirection = "UNCHANGED";
  if (rawAbsoluteDelta > 0) {
    direction = "UP";
  } else if (rawAbsoluteDelta < 0) {
    direction = "DOWN";
  }

  return {
    current,
    previous,
    absoluteDelta,
    direction,
  };
}

/**
 * Build deterministic analytical identity for a deviation episode
 */
export function buildDeterministicEpisodeId(
  tenantId: string,
  riderId: string,
  startEventId: string
): string {
  return `ep_${tenantId}_${riderId}_${startEventId}`;
}

/**
 * Get static capabilities configuration for S7-03 Analytics Engine
 */
export function getDefaultAnalyticsCapabilities(): AnalyticsCapabilities {
  return {
    presenceHistory: true,
    riderActivity: true,
    zoneAnalytics: true,
    deviationEpisodes: true,
    fleetUtilizationHistory: false, // continuous state log not persisted in Stage 4
    alertResponseHistory: false,    // supervisor ACK audit log not in DB
    unsupportedReasons: {
      fleetUtilizationHistory: "Historical continuous fleet state durations are not logged as a time series in Stage 4 schema.",
      alertResponseHistory: "Supervisor acknowledgement timestamps are not persisted in database (emitted over ephemeral websocket).",
      riderPerformanceScore: "Arbitrary rider performance scoring is deferred to S7-06 with a formal mathematical model.",
    },
  };
}
