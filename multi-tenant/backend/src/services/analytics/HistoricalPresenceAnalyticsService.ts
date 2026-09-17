/*
 * HistoricalPresenceAnalyticsService.ts
 * S7-03-03: Historical Operational Presence & Compliance Aggregation Engine
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Read-Only Aggregation from `rider_presence_events` (persisted Stage 6 facts).
 * 2. Strict Half-Open Temporal Boundaries [start, end) based on `captured_at`.
 * 3. Session-bound Parameterized PostgreSQL RLS (`withTenantContext`).
 * 4. Zero-Fake-Data: Nullable ratios via safeRatio(), explicit event-level counts.
 * 5. Deterministic Temporal Bucketing using analyticsTime engine.
 */

import { withTenantContext } from "../../lib/tenantContext.js";
import { safeRatio } from "../../lib/analytics/analyticsMath.js";
import {
  validateAnalyticsTimeContext,
  generateBuckets,
  isWithinBoundary,
  getTemporalBucket,
} from "../../lib/analytics/analyticsTime.js";
import type {
  HistoricalAnalyticsFilter,
  ComplianceMetrics,
  HistoricalTimelinePointDTO,
} from "../../types/analytics.types.js";

export interface PresenceSummaryResult {
  observedRiders: number;
  presenceEvents: number;
  compliance: ComplianceMetrics;
  eventTypeBreakdown: {
    ENTER: number;
    EXIT: number;
    ON_SITE: number;
    OUTSIDE_ZONE: number;
    DEVIATED: number;
  };
  deviatedEventsCount: number;
  affectedRidersCount: number;
}

export class HistoricalPresenceAnalyticsService {
  /**
   * Aggregate high-level operational presence and compliance metrics for a tenant
   */
  public async getPresenceSummary(
    tenantId: string,
    filter: HistoricalAnalyticsFilter
  ): Promise<PresenceSummaryResult> {
    const validation = validateAnalyticsTimeContext(filter.timeContext);
    if (!validation.valid) {
      throw new Error(`[${validation.errorCode}] ${validation.errorMessage}`);
    }

    return await withTenantContext(tenantId, async (client) => {
      const params: any[] = [
        tenantId,
        filter.timeContext.rangeStart,
        filter.timeContext.rangeEnd,
      ];

      let query = `
        SELECT
          COUNT(DISTINCT rpe.rider_id)::int AS observed_riders,
          COUNT(*)::int AS total_events,
          COUNT(*) FILTER (WHERE rpe.compliance_status = 'COMPLIANT')::int AS compliant_count,
          COUNT(*) FILTER (WHERE rpe.compliance_status = 'DEVIATED')::int AS deviated_count,
          COUNT(*) FILTER (WHERE rpe.compliance_status = 'OUTSIDE')::int AS outside_count,
          COUNT(*) FILTER (WHERE rpe.compliance_status = 'UNASSIGNED')::int AS unassigned_count,
          COUNT(DISTINCT rpe.rider_id) FILTER (WHERE rpe.compliance_status = 'DEVIATED')::int AS affected_riders,
          COUNT(*) FILTER (WHERE rpe.event_type = 'ENTER')::int AS enter_count,
          COUNT(*) FILTER (WHERE rpe.event_type = 'EXIT')::int AS exit_count,
          COUNT(*) FILTER (WHERE rpe.event_type = 'ON_SITE')::int AS on_site_count,
          COUNT(*) FILTER (WHERE rpe.event_type = 'OUTSIDE_ZONE')::int AS outside_zone_count,
          COUNT(*) FILTER (WHERE rpe.event_type = 'DEVIATED')::int AS deviated_type_count
        FROM rider_presence_events rpe
        WHERE rpe.tenant_id = $1
          AND rpe.captured_at >= $2
          AND rpe.captured_at < $3
      `;

      // Optional Rider ID filter
      if (filter.riderId) {
        params.push(filter.riderId);
        query += ` AND rpe.rider_id = $${params.length}`;
      }

      // Optional Zone ID filter
      if (filter.zoneId) {
        params.push(filter.zoneId);
        query += ` AND (rpe.zone_id = $${params.length} OR rpe.assigned_zone_id = $${params.length})`;
      }

      // Optional Compliance Status filter
      if (filter.complianceStatus) {
        params.push(filter.complianceStatus);
        query += ` AND rpe.compliance_status = $${params.length}`;
      }

      const { rows } = await client.query(query, params);
      const row = rows[0] || {};

      const compliant = row.compliant_count || 0;
      const deviated = row.deviated_count || 0;
      const outside = row.outside_count || 0;
      const unassigned = row.unassigned_count || 0;

      const eligibleEventsCount = compliant + deviated + outside;
      const totalEventsCount = row.total_events || 0;
      const complianceRate = safeRatio(compliant, eligibleEventsCount);

      return {
        observedRiders: row.observed_riders || 0,
        presenceEvents: totalEventsCount,
        compliance: {
          compliant,
          deviated,
          outside,
          unassigned,
          eligibleEventsCount,
          totalEventsCount,
          rate: complianceRate,
        },
        eventTypeBreakdown: {
          ENTER: row.enter_count || 0,
          EXIT: row.exit_count || 0,
          ON_SITE: row.on_site_count || 0,
          OUTSIDE_ZONE: row.outside_zone_count || 0,
          DEVIATED: row.deviated_type_count || 0,
        },
        deviatedEventsCount: deviated,
        affectedRidersCount: row.affected_riders || 0,
      };
    });
  }

  /**
   * Aggregate presence events into deterministic temporal buckets for trend charting
   */
  public async getPresenceTimeline(
    tenantId: string,
    filter: HistoricalAnalyticsFilter
  ): Promise<HistoricalTimelinePointDTO[]> {
    const validation = validateAnalyticsTimeContext(filter.timeContext);
    if (!validation.valid) {
      throw new Error(`[${validation.errorCode}] ${validation.errorMessage}`);
    }

    // 1. Generate discrete skeleton buckets for the requested time context
    const skeletonBuckets = generateBuckets(filter.timeContext);
    const bucketMap = new Map<string, {
      observedRidersSet: Set<string>;
      totalEvents: number;
      compliant: number;
      deviated: number;
      outside: number;
      unassigned: number;
      bucketStart: string;
      bucketEnd: string;
    }>();

    for (const b of skeletonBuckets) {
      bucketMap.set(b.bucketKey, {
        observedRidersSet: new Set<string>(),
        totalEvents: 0,
        compliant: 0,
        deviated: 0,
        outside: 0,
        unassigned: 0,
        bucketStart: b.bucketStart,
        bucketEnd: b.bucketEnd,
      });
    }

    // 2. Query individual events within tenant context [start, end)
    await withTenantContext(tenantId, async (client) => {
      const params: any[] = [
        tenantId,
        filter.timeContext.rangeStart,
        filter.timeContext.rangeEnd,
      ];

      let query = `
        SELECT
          rpe.rider_id,
          rpe.compliance_status,
          rpe.captured_at
        FROM rider_presence_events rpe
        WHERE rpe.tenant_id = $1
          AND rpe.captured_at >= $2
          AND rpe.captured_at < $3
      `;

      if (filter.riderId) {
        params.push(filter.riderId);
        query += ` AND rpe.rider_id = $${params.length}`;
      }

      if (filter.zoneId) {
        params.push(filter.zoneId);
        query += ` AND (rpe.zone_id = $${params.length} OR rpe.assigned_zone_id = $${params.length})`;
      }

      if (filter.complianceStatus) {
        params.push(filter.complianceStatus);
        query += ` AND rpe.compliance_status = $${params.length}`;
      }

      query += ` ORDER BY rpe.rider_id ASC, rpe.captured_at ASC, rpe.created_at ASC, rpe.id ASC`;

      const { rows } = await client.query(query, params);

      // 3. Map events into temporal buckets
      for (const row of rows) {
        const capturedDate = new Date(row.captured_at);
        const tempBucket = getTemporalBucket(capturedDate, filter.timeContext.grain, filter.timeContext.timezone);
        const target = bucketMap.get(tempBucket.bucketKey);

        if (target) {
          target.observedRidersSet.add(row.rider_id);
          target.totalEvents += 1;

          switch (row.compliance_status) {
            case "COMPLIANT":
              target.compliant += 1;
              break;
            case "DEVIATED":
              target.deviated += 1;
              break;
            case "OUTSIDE":
              target.outside += 1;
              break;
            case "UNASSIGNED":
              target.unassigned += 1;
              break;
          }
        }
      }
    });

    // 4. Transform into final timeline points with safe compliance rates
    const timeline: HistoricalTimelinePointDTO[] = [];

    for (const b of skeletonBuckets) {
      const aggregated = bucketMap.get(b.bucketKey)!;
      const eligible = aggregated.compliant + aggregated.deviated + aggregated.outside;
      const rate = safeRatio(aggregated.compliant, eligible);

      timeline.push({
        bucketStart: aggregated.bucketStart,
        bucketEnd: aggregated.bucketEnd,
        observedRiders: aggregated.observedRidersSet.size,
        totalEvents: aggregated.totalEvents,
        compliant: aggregated.compliant,
        deviated: aggregated.deviated,
        outside: aggregated.outside,
        unassigned: aggregated.unassigned,
        complianceRate: rate,
        deviationEpisodesCount: 0, // S7-03-03 baseline (episodes calculated in S7-03-04)
      });
    }

    return timeline;
  }
}

export const historicalPresenceAnalyticsService = new HistoricalPresenceAnalyticsService();
