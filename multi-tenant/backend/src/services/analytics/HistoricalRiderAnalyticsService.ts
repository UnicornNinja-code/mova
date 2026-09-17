/*
 * HistoricalRiderAnalyticsService.ts
 * S7-03-06: Historical Rider Operational Analytics Engine
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Read-Only Aggregation from `rider_presence_events` partitioned by `rider_id`.
 * 2. Zero N+1 Queries: Bulk fetch + single-pass in-memory partitioning & episode reconstruction.
 * 3. observedDays calculated from local calendar dates in AnalyticsTimeContext.timezone.
 * 4. Actual Zone Attribution: affectedZones is COUNT(DISTINCT zone_id) where zone_id IS NOT NULL.
 * 5. Deviation episode integration from S7-03-04.
 * 6. Half-open temporal boundaries [start, end) based on `captured_at`.
 * 7. Deterministic ordering: riderName ASC, riderId ASC.
 * 8. Zero unsupported productivity / sales / discipline scoring.
 */

import { withTenantContext } from "../../lib/tenantContext.js";
import { safeRatio } from "../../lib/analytics/analyticsMath.js";
import {
  validateAnalyticsTimeContext,
  generateBuckets,
  getTemporalBucket,
  getBucketKey,
} from "../../lib/analytics/analyticsTime.js";
import {
  reconstructDeviationEpisodes,
  type RawPresenceEventRow,
} from "./HistoricalDeviationEpisodeService.js";
import type {
  AnalyticsTimeContext,
  RiderAnalyticsFilter,
  RiderHistoricalMetric,
  HistoricalRiderSummaryDTO,
  HistoricalTimelinePointDTO,
} from "../../types/analytics.types.js";

export class HistoricalRiderAnalyticsService {
  /**
   * Aggregate historical operational metrics for each rider within requested time range
   */
  public async getRiderSummaries(
    tenantId: string,
    filter: RiderAnalyticsFilter
  ): Promise<HistoricalRiderSummaryDTO> {
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

      // 1. Bulk query raw events for both rider metric aggregation and episode reconstruction (Zero N+1)
      let rawQuery = `
        SELECT
          rpe.id,
          rpe.tenant_id,
          rpe.rider_id,
          u.name AS rider_name,
          rpe.zone_id,
          z.name AS zone_name,
          rpe.assigned_zone_id,
          az.name AS assigned_zone_name,
          rpe.event_type,
          rpe.compliance_status,
          rpe.captured_at,
          rpe.created_at
        FROM rider_presence_events rpe
        LEFT JOIN users u ON rpe.rider_id = u.id
        LEFT JOIN zones z ON rpe.zone_id = z.id
        LEFT JOIN zones az ON rpe.assigned_zone_id = az.id
        WHERE rpe.tenant_id = $1
          AND rpe.captured_at >= $2
          AND rpe.captured_at < $3
      `;

      if (filter.riderId) {
        params.push(filter.riderId);
        rawQuery += ` AND rpe.rider_id = $${params.length}`;
      }

      if (filter.zoneId) {
        params.push(filter.zoneId);
        rawQuery += ` AND (rpe.zone_id = $${params.length} OR rpe.assigned_zone_id = $${params.length})`;
      }

      rawQuery += ` ORDER BY rpe.rider_id ASC, rpe.captured_at ASC, rpe.created_at ASC, rpe.id ASC`;

      const { rows } = await client.query(rawQuery, params);

      // 2. Reconstruct authoritative deviation episodes for all riders in single pass (S7-03-04)
      const allEpisodes = reconstructDeviationEpisodes(tenantId, rows as RawPresenceEventRow[]);

      // Index episodes by riderId
      const riderEpisodesMap = new Map<string, { total: number; open: number }>();
      for (const ep of allEpisodes) {
        const current = riderEpisodesMap.get(ep.riderId) || { total: 0, open: 0 };
        current.total += 1;
        if (ep.open) {
          current.open += 1;
        }
        riderEpisodesMap.set(ep.riderId, current);
      }

      // 3. Aggregate rider metrics from event stream
      const riderStatsMap = new Map<string, {
        riderId: string;
        riderName: string;
        totalEvents: number;
        observedDaysSet: Set<string>;
        compliantEvents: number;
        deviationEvents: number;
        outsideEvents: number;
        unassignedEvents: number;
        affectedZonesSet: Set<string>;
        firstObservedAt: Date | null;
        lastObservedAt: Date | null;
      }>();

      for (const row of rows) {
        const rId = row.rider_id;
        const rName = row.rider_name || "Rider Operasional";
        const captured = new Date(row.captured_at);

        // Calculate local calendar date key in target timezone (AC-05 & AC-17)
        const localDayKey = getBucketKey(captured, "day", filter.timeContext.timezone);

        let entry = riderStatsMap.get(rId);
        if (!entry) {
          entry = {
            riderId: rId,
            riderName: rName,
            totalEvents: 0,
            observedDaysSet: new Set<string>(),
            compliantEvents: 0,
            deviationEvents: 0,
            outsideEvents: 0,
            unassignedEvents: 0,
            affectedZonesSet: new Set<string>(),
            firstObservedAt: captured,
            lastObservedAt: captured,
          };
          riderStatsMap.set(rId, entry);
        }

        entry.totalEvents += 1;
        entry.observedDaysSet.add(localDayKey);

        if (row.compliance_status === "COMPLIANT") entry.compliantEvents += 1;
        else if (row.compliance_status === "DEVIATED") entry.deviationEvents += 1;
        else if (row.compliance_status === "OUTSIDE") entry.outsideEvents += 1;
        else if (row.compliance_status === "UNASSIGNED") entry.unassignedEvents += 1;

        // Count actual observed zone if present (AC-11)
        if (row.zone_id) {
          entry.affectedZonesSet.add(row.zone_id);
        }

        if (!entry.firstObservedAt || captured < entry.firstObservedAt) {
          entry.firstObservedAt = captured;
        }
        if (!entry.lastObservedAt || captured > entry.lastObservedAt) {
          entry.lastObservedAt = captured;
        }
      }

      // 4. Transform into final RiderHistoricalMetric list
      const riderMetrics: RiderHistoricalMetric[] = [];

      for (const entry of riderStatsMap.values()) {
        const eligible = entry.compliantEvents + entry.deviationEvents + entry.outsideEvents;
        const complianceRate = safeRatio(entry.compliantEvents, eligible);
        const epData = riderEpisodesMap.get(entry.riderId) || { total: 0, open: 0 };

        riderMetrics.push({
          riderId: entry.riderId,
          riderName: entry.riderName,
          totalEvents: entry.totalEvents,
          observedDays: entry.observedDaysSet.size,
          compliantEvents: entry.compliantEvents,
          deviationEvents: entry.deviationEvents,
          deviationEpisodes: epData.total,
          openDeviationEpisodes: epData.open,
          outsideEvents: entry.outsideEvents,
          unassignedEvents: entry.unassignedEvents,
          eligibleEventsCount: eligible,
          complianceRate,
          affectedZones: entry.affectedZonesSet.size,
          firstObservedAt: entry.firstObservedAt ? entry.firstObservedAt.toISOString() : null,
          lastObservedAt: entry.lastObservedAt ? entry.lastObservedAt.toISOString() : null,
        });
      }

      // 5. Deterministic sorting: riderName ASC, riderId ASC (AC-18)
      riderMetrics.sort((a, b) => {
        const cmpName = a.riderName.localeCompare(b.riderName);
        if (cmpName !== 0) return cmpName;
        return a.riderId.localeCompare(b.riderId);
      });

      return {
        range: {
          rangeStart: filter.timeContext.rangeStart,
          rangeEnd: filter.timeContext.rangeEnd,
          timezone: filter.timeContext.timezone,
        },
        totalRidersEvaluated: riderMetrics.length,
        riders: riderMetrics,
      };
    });
  }

  /**
   * Generate temporal timeline trend for a specific rider
   */
  public async getRiderTimeline(
    tenantId: string,
    riderId: string,
    timeContext: AnalyticsTimeContext
  ): Promise<HistoricalTimelinePointDTO[]> {
    const validation = validateAnalyticsTimeContext(timeContext);
    if (!validation.valid) {
      throw new Error(`[${validation.errorCode}] ${validation.errorMessage}`);
    }

    const skeletonBuckets = generateBuckets(timeContext);
    const bucketMap = new Map<string, {
      observedRidersSet: Set<string>;
      totalEvents: number;
      compliant: number;
      deviated: number;
      outside: number;
      unassigned: number;
      deviationEpisodesCount: number;
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
        deviationEpisodesCount: 0,
        bucketStart: b.bucketStart,
        bucketEnd: b.bucketEnd,
      });
    }

    await withTenantContext(tenantId, async (client) => {
      const query = `
        SELECT
          rpe.id,
          rpe.rider_id,
          rpe.compliance_status,
          rpe.captured_at
        FROM rider_presence_events rpe
        WHERE rpe.tenant_id = $1
          AND rpe.rider_id = $2
          AND rpe.captured_at >= $3
          AND rpe.captured_at < $4
        ORDER BY rpe.rider_id ASC, rpe.captured_at ASC, rpe.created_at ASC, rpe.id ASC
      `;

      const { rows } = await client.query(query, [
        tenantId,
        riderId,
        timeContext.rangeStart,
        timeContext.rangeEnd,
      ]);

      for (const row of rows) {
        const captured = new Date(row.captured_at);
        const tempBucket = getTemporalBucket(captured, timeContext.grain, timeContext.timezone);
        const target = bucketMap.get(tempBucket.bucketKey);

        if (target) {
          target.observedRidersSet.add(row.rider_id);
          target.totalEvents += 1;

          if (row.compliance_status === "COMPLIANT") target.compliant += 1;
          else if (row.compliance_status === "DEVIATED") target.deviated += 1;
          else if (row.compliance_status === "OUTSIDE") target.outside += 1;
          else if (row.compliance_status === "UNASSIGNED") target.unassigned += 1;
        }
      }
    });

    const timeline: HistoricalTimelinePointDTO[] = [];
    for (const b of skeletonBuckets) {
      const agg = bucketMap.get(b.bucketKey)!;
      const eligible = agg.compliant + agg.deviated + agg.outside;
      const rate = safeRatio(agg.compliant, eligible);

      timeline.push({
        bucketStart: agg.bucketStart,
        bucketEnd: agg.bucketEnd,
        observedRiders: agg.observedRidersSet.size,
        totalEvents: agg.totalEvents,
        compliant: agg.compliant,
        deviated: agg.deviated,
        outside: agg.outside,
        unassigned: agg.unassigned,
        complianceRate: rate,
        deviationEpisodesCount: 0,
      });
    }

    return timeline;
  }
}

export const historicalRiderAnalyticsService = new HistoricalRiderAnalyticsService();
