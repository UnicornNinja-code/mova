/*
 * HistoricalPeriodComparisonService.ts
 * S7-03-07: Historical Period Comparison & Analytics Consolidation Engine
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Orchestration & Consolidation Layer: Consumes authoritative outputs from Presence (S7-03-03),
 *    Episode (S7-03-04), Zone (S7-03-05), and Rider (S7-03-06) engines.
 * 2. Strict Half-Open Boundaries [start, end) on both current and previous windows.
 * 3. Identical Timezone & Grain verification (rejection on mismatch).
 * 4. Non-overlapping period isolation.
 * 5. Deterministic Period Metric Comparisons via calculatePeriodDelta (UP, DOWN, UNCHANGED, UP_FROM_ZERO, DOWN_TO_ZERO, UNAVAILABLE).
 * 6. Zero-Fake-Data: Nullable ratios, no fabricated metrics (productivity, response times).
 * 7. Session-bound Parameterized PostgreSQL RLS (withTenantContext).
 */

import {
  calculatePeriodDelta,
} from "../../lib/analytics/analyticsMath.js";
import {
  validateAnalyticsTimeContext,
} from "../../lib/analytics/analyticsTime.js";
import { HistoricalPresenceAnalyticsService } from "./HistoricalPresenceAnalyticsService.js";
import { HistoricalDeviationEpisodeService } from "./HistoricalDeviationEpisodeService.js";
import { HistoricalZoneAnalyticsService } from "./HistoricalZoneAnalyticsService.js";
import { HistoricalRiderAnalyticsService } from "./HistoricalRiderAnalyticsService.js";
import type {
  AnalyticsTimeContext,
  PeriodComparisonResult,
  ZonePeriodComparison,
  RiderPeriodComparison,
} from "../../types/analytics.types.js";

export class HistoricalPeriodComparisonService {
  private presenceService: HistoricalPresenceAnalyticsService;
  private deviationService: HistoricalDeviationEpisodeService;
  private zoneService: HistoricalZoneAnalyticsService;
  private riderService: HistoricalRiderAnalyticsService;

  constructor(
    presenceService = new HistoricalPresenceAnalyticsService(),
    deviationService = new HistoricalDeviationEpisodeService(),
    zoneService = new HistoricalZoneAnalyticsService(),
    riderService = new HistoricalRiderAnalyticsService()
  ) {
    this.presenceService = presenceService;
    this.deviationService = deviationService;
    this.zoneService = zoneService;
    this.riderService = riderService;
  }

  /**
   * Validate temporal compatibility between current and previous periods
   */
  public validateComparisonContexts(
    current: AnalyticsTimeContext,
    previous: AnalyticsTimeContext
  ): void {
    const currentValidation = validateAnalyticsTimeContext(current);
    if (!currentValidation.valid) {
      throw new Error(`[${currentValidation.errorCode}] Invalid current period: ${currentValidation.errorMessage}`);
    }

    const prevValidation = validateAnalyticsTimeContext(previous);
    if (!prevValidation.valid) {
      throw new Error(`[${prevValidation.errorCode}] Invalid previous period: ${prevValidation.errorMessage}`);
    }

    if (current.timezone !== previous.timezone) {
      throw new Error(`[INVALID_PERIOD_COMPARISON_TIMEZONE] Current timezone '${current.timezone}' and previous timezone '${previous.timezone}' must be identical`);
    }

    if (current.grain !== previous.grain) {
      throw new Error(`[INVALID_PERIOD_COMPARISON_GRAIN] Current grain '${current.grain}' and previous grain '${previous.grain}' must be identical`);
    }

    const currentStart = new Date(current.rangeStart).getTime();
    const currentEnd = new Date(current.rangeEnd).getTime();
    const prevStart = new Date(previous.rangeStart).getTime();
    const prevEnd = new Date(previous.rangeEnd).getTime();

    // Periods must not overlap: [start, end)
    if (currentStart < prevEnd && prevStart < currentEnd) {
      throw new Error(`[PERIODS_OVERLAP] Current period [${current.rangeStart}, ${current.rangeEnd}) and previous period [${previous.rangeStart}, ${previous.rangeEnd}) must not overlap`);
    }
  }

  /**
   * Perform high-level consolidated period comparison across presence, compliance, and deviations
   */
  public async comparePeriods(
    tenantId: string,
    current: AnalyticsTimeContext,
    previous: AnalyticsTimeContext
  ): Promise<PeriodComparisonResult> {
    this.validateComparisonContexts(current, previous);

    // Fetch authoritative aggregates for both windows concurrently
    const [
      currentPresence,
      prevPresence,
      currentDeviation,
      prevDeviation,
    ] = await Promise.all([
      this.presenceService.getPresenceSummary(tenantId, { timeContext: current }),
      this.presenceService.getPresenceSummary(tenantId, { timeContext: previous }),
      this.deviationService.getDeviationEpisodes(tenantId, { timeContext: current }),
      this.deviationService.getDeviationEpisodes(tenantId, { timeContext: previous }),
    ]);

    return {
      context: {
        current: {
          rangeStart: current.rangeStart,
          rangeEnd: current.rangeEnd,
          timezone: current.timezone,
        },
        previous: {
          rangeStart: previous.rangeStart,
          rangeEnd: previous.rangeEnd,
          timezone: previous.timezone,
        },
      },
      metrics: {
        observedRiders: calculatePeriodDelta(
          currentPresence.observedRiders,
          prevPresence.observedRiders
        ),
        totalEvents: calculatePeriodDelta(
          currentPresence.presenceEvents,
          prevPresence.presenceEvents
        ),
        compliantEvents: calculatePeriodDelta(
          currentPresence.compliance.compliant,
          prevPresence.compliance.compliant
        ),
        deviatedEvents: calculatePeriodDelta(
          currentPresence.compliance.deviated,
          prevPresence.compliance.deviated
        ),
        outsideEvents: calculatePeriodDelta(
          currentPresence.compliance.outside,
          prevPresence.compliance.outside
        ),
        unassignedEvents: calculatePeriodDelta(
          currentPresence.compliance.unassigned,
          prevPresence.compliance.unassigned
        ),
        eligibleEvents: calculatePeriodDelta(
          currentPresence.compliance.eligibleEventsCount,
          prevPresence.compliance.eligibleEventsCount
        ),
        complianceRate: calculatePeriodDelta(
          currentPresence.compliance.rate,
          prevPresence.compliance.rate
        ),
        deviationEpisodes: calculatePeriodDelta(
          currentDeviation.metrics.episodeCount,
          prevDeviation.metrics.episodeCount
        ),
        openDeviationEpisodes: calculatePeriodDelta(
          currentDeviation.metrics.openEpisodesCount,
          prevDeviation.metrics.openEpisodesCount
        ),
      },
    };
  }

  /**
   * Perform granular period comparison per zone
   */
  public async compareZonePeriods(
    tenantId: string,
    current: AnalyticsTimeContext,
    previous: AnalyticsTimeContext,
    zoneId?: string
  ): Promise<ZonePeriodComparison[]> {
    this.validateComparisonContexts(current, previous);

    const [currentZones, prevZones] = await Promise.all([
      this.zoneService.getZoneSummaries(tenantId, { timeContext: current, zoneId }),
      this.zoneService.getZoneSummaries(tenantId, { timeContext: previous, zoneId }),
    ]);

    const prevMap = new Map<string, any>(prevZones.zones.map((z: any) => [z.zoneId, z]));
    const allZoneIds = new Set<string>([
      ...currentZones.zones.map((z: any) => z.zoneId),
      ...prevZones.zones.map((z: any) => z.zoneId),
    ]);

    const results: ZonePeriodComparison[] = [];

    for (const zId of allZoneIds) {
      const cur = currentZones.zones.find((z: any) => z.zoneId === zId);
      const prev = prevMap.get(zId);
      const zoneName = cur?.zoneName || prev?.zoneName || "Unknown Zone";

      results.push({
        zoneId: zId,
        zoneName,
        metrics: {
          observedRiders: calculatePeriodDelta(
            cur ? cur.observedRiders : 0,
            prev ? prev.observedRiders : 0
          ),
          totalEvents: calculatePeriodDelta(
            cur ? cur.totalEvents : 0,
            prev ? prev.totalEvents : 0
          ),
          complianceRate: calculatePeriodDelta(
            cur ? cur.complianceRate : null,
            prev ? prev.complianceRate : null
          ),
          affectedRiders: calculatePeriodDelta(
            cur ? cur.affectedRiders : 0,
            prev ? prev.affectedRiders : 0
          ),
          deviationEpisodes: calculatePeriodDelta(
            cur ? cur.deviationEpisodes : 0,
            prev ? prev.deviationEpisodes : 0
          ),
          openDeviationEpisodes: calculatePeriodDelta(
            cur ? cur.openDeviationEpisodes : 0,
            prev ? prev.openDeviationEpisodes : 0
          ),
        },
      });
    }

    // Deterministic ordering: zoneName ASC, zoneId ASC
    results.sort((a, b) => {
      const nameCompare = (a.zoneName || "").localeCompare(b.zoneName || "");
      if (nameCompare !== 0) return nameCompare;
      return a.zoneId.localeCompare(b.zoneId);
    });

    return results;
  }

  /**
   * Perform granular period comparison per rider
   */
  public async compareRiderPeriods(
    tenantId: string,
    current: AnalyticsTimeContext,
    previous: AnalyticsTimeContext,
    riderId?: string
  ): Promise<RiderPeriodComparison[]> {
    this.validateComparisonContexts(current, previous);

    const [currentRiders, prevRiders] = await Promise.all([
      this.riderService.getRiderSummaries(tenantId, { timeContext: current, riderId }),
      this.riderService.getRiderSummaries(tenantId, { timeContext: previous, riderId }),
    ]);

    const prevMap = new Map<string, any>(prevRiders.riders.map((r: any) => [r.riderId, r]));
    const allRiderIds = new Set<string>([
      ...currentRiders.riders.map((r: any) => r.riderId),
      ...prevRiders.riders.map((r: any) => r.riderId),
    ]);

    const results: RiderPeriodComparison[] = [];

    for (const rId of allRiderIds) {
      const cur = currentRiders.riders.find((r: any) => r.riderId === rId);
      const prev = prevMap.get(rId);
      const riderName = cur ? (cur.riderName ?? null) : (prev ? (prev.riderName ?? null) : null);

      results.push({
        riderId: rId,
        riderName,
        metrics: {
          totalEvents: calculatePeriodDelta(
            cur ? cur.totalEvents : 0,
            prev ? prev.totalEvents : 0
          ),
          observedDays: calculatePeriodDelta(
            cur ? cur.observedDays : 0,
            prev ? prev.observedDays : 0
          ),
          complianceRate: calculatePeriodDelta(
            cur ? cur.complianceRate : null,
            prev ? prev.complianceRate : null
          ),
          deviationEvents: calculatePeriodDelta(
            cur ? cur.deviationEvents : 0,
            prev ? prev.deviationEvents : 0
          ),
          deviationEpisodes: calculatePeriodDelta(
            cur ? cur.deviationEpisodes : 0,
            prev ? prev.deviationEpisodes : 0
          ),
          openDeviationEpisodes: calculatePeriodDelta(
            cur ? cur.openDeviationEpisodes : 0,
            prev ? prev.openDeviationEpisodes : 0
          ),
          affectedZones: calculatePeriodDelta(
            cur ? cur.affectedZones : 0,
            prev ? prev.affectedZones : 0
          ),
        },
      });
    }

    // Deterministic ordering: riderName ASC (nulls last), riderId ASC
    results.sort((a, b) => {
      if (a.riderName === null && b.riderName !== null) return 1;
      if (a.riderName !== null && b.riderName === null) return -1;
      if (a.riderName !== null && b.riderName !== null) {
        const nameCompare = a.riderName.localeCompare(b.riderName);
        if (nameCompare !== 0) return nameCompare;
      }
      return a.riderId.localeCompare(b.riderId);
    });

    return results;
  }
}
