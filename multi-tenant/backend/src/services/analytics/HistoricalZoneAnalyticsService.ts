/*
 * HistoricalZoneAnalyticsService.ts
 * S7-03-05: Historical Zone Operational Analytics Engine
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Read-Only Aggregation from `rider_presence_events` grouped by actual `zone_id`.
 * 2. Distinct separation between actual zone (`zone_id`) and assignment (`assigned_zone_id`).
 * 3. Deviation episode integration from S7-03-04 (episodes attributed to start event's zone_id).
 * 4. Half-open temporal boundaries [start, end) based on `captured_at`.
 * 5. Safe denominator handling via safeRatio (null if eligible === 0).
 * 6. Deterministic ordering by zoneName ASC, zoneId ASC.
 */

import { withTenantContext } from "../../lib/tenantContext.js";
import { safeRatio } from "../../lib/analytics/analyticsMath.js";
import {
  validateAnalyticsTimeContext,
  generateBuckets,
  getTemporalBucket,
} from "../../lib/analytics/analyticsTime.js";
import {
  reconstructDeviationEpisodes,
  type RawPresenceEventRow,
} from "./HistoricalDeviationEpisodeService.js";
import type {
  AnalyticsTimeContext,
  ZoneAnalyticsFilter,
  ZoneHistoricalMetric,
  HistoricalZoneSummaryDTO,
  HistoricalTimelinePointDTO,
} from "../../types/analytics.types.js";

export class HistoricalZoneAnalyticsService {
  /**
   * Aggregate operational performance metrics for each zone within requested time range
   */
  public async getZoneSummaries(
    tenantId: string,
    filter: ZoneAnalyticsFilter
  ): Promise<HistoricalZoneSummaryDTO> {
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

      // 1. Query raw event stream for both zone aggregation and episode reconstruction
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
          AND rpe.zone_id IS NOT NULL
      `;

      if (filter.zoneId) {
        params.push(filter.zoneId);
        rawQuery += ` AND rpe.zone_id = $${params.length}`;
      }

      rawQuery += ` ORDER BY rpe.rider_id ASC, rpe.captured_at ASC, rpe.created_at ASC, rpe.id ASC`;

      const { rows } = await client.query(rawQuery, params);

      // 2. Reconstruct authoritative deviation episodes (from S7-03-04)
      const allEpisodes = reconstructDeviationEpisodes(tenantId, rows as RawPresenceEventRow[]);

      // Index episodes by attributed zoneId
      const zoneEpisodesMap = new Map<string, { total: number; open: number }>();
      for (const ep of allEpisodes) {
        if (ep.zoneId) {
          const current = zoneEpisodesMap.get(ep.zoneId) || { total: 0, open: 0 };
          current.total += 1;
          if (ep.open) {
            current.open += 1;
          }
          zoneEpisodesMap.set(ep.zoneId, current);
        }
      }

      // 3. Aggregate zone metrics from event stream
      const zoneStatsMap = new Map<string, {
        zoneId: string;
        zoneName: string;
        ridersSet: Set<string>;
        affectedRidersSet: Set<string>;
        totalEvents: number;
        compliantEvents: number;
        deviationEvents: number;
        outsideEvents: number;
        unassignedEvents: number;
        firstObservedAt: Date | null;
        lastObservedAt: Date | null;
      }>();

      for (const row of rows) {
        const zId = row.zone_id;
        const zName = row.zone_name || `Zona ${zId}`;
        const captured = new Date(row.captured_at);

        let entry = zoneStatsMap.get(zId);
        if (!entry) {
          entry = {
            zoneId: zId,
            zoneName: zName,
            ridersSet: new Set<string>(),
            affectedRidersSet: new Set<string>(),
            totalEvents: 0,
            compliantEvents: 0,
            deviationEvents: 0,
            outsideEvents: 0,
            unassignedEvents: 0,
            firstObservedAt: captured,
            lastObservedAt: captured,
          };
          zoneStatsMap.set(zId, entry);
        }

        entry.ridersSet.add(row.rider_id);
        entry.totalEvents += 1;

        if (row.compliance_status === "COMPLIANT") entry.compliantEvents += 1;
        else if (row.compliance_status === "DEVIATED") {
          entry.deviationEvents += 1;
          entry.affectedRidersSet.add(row.rider_id);
        } else if (row.compliance_status === "OUTSIDE") entry.outsideEvents += 1;
        else if (row.compliance_status === "UNASSIGNED") entry.unassignedEvents += 1;

        if (!entry.firstObservedAt || captured < entry.firstObservedAt) {
          entry.firstObservedAt = captured;
        }
        if (!entry.lastObservedAt || captured > entry.lastObservedAt) {
          entry.lastObservedAt = captured;
        }
      }

      // 4. Transform into final ZoneHistoricalMetric list
      const zoneMetrics: ZoneHistoricalMetric[] = [];

      for (const entry of zoneStatsMap.values()) {
        const minReq = filter.minEvents || 0;
        if (entry.totalEvents < minReq) {
          continue;
        }

        const eligible = entry.compliantEvents + entry.deviationEvents + entry.outsideEvents;
        const complianceRate = safeRatio(entry.compliantEvents, eligible);
        const epData = zoneEpisodesMap.get(entry.zoneId) || { total: 0, open: 0 };

        zoneMetrics.push({
          zoneId: entry.zoneId,
          zoneName: entry.zoneName,
          observedRiders: entry.ridersSet.size,
          totalEvents: entry.totalEvents,
          compliantEvents: entry.compliantEvents,
          deviationEvents: entry.deviationEvents,
          deviationEpisodes: epData.total,
          openDeviationEpisodes: epData.open,
          affectedRiders: entry.affectedRidersSet.size,
          outsideEvents: entry.outsideEvents,
          unassignedEvents: entry.unassignedEvents,
          complianceRate,
          firstObservedAt: entry.firstObservedAt ? entry.firstObservedAt.toISOString() : null,
          lastObservedAt: entry.lastObservedAt ? entry.lastObservedAt.toISOString() : null,
        });
      }

      // 5. Deterministic sorting: zoneName ASC, zoneId ASC
      zoneMetrics.sort((a, b) => {
        const cmpName = a.zoneName.localeCompare(b.zoneName);
        if (cmpName !== 0) return cmpName;
        return a.zoneId.localeCompare(b.zoneId);
      });

      return {
        range: {
          rangeStart: filter.timeContext.rangeStart,
          rangeEnd: filter.timeContext.rangeEnd,
          timezone: filter.timeContext.timezone,
        },
        totalZonesEvaluated: zoneMetrics.length,
        zones: zoneMetrics,
      };
    });
  }

  /**
   * Generate temporal timeline trend for a specific zone
   */
  public async getZoneTimeline(
    tenantId: string,
    zoneId: string,
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
          AND rpe.zone_id = $2
          AND rpe.captured_at >= $3
          AND rpe.captured_at < $4
        ORDER BY rpe.rider_id ASC, rpe.captured_at ASC, rpe.created_at ASC, rpe.id ASC
      `;

      const { rows } = await client.query(query, [
        tenantId,
        zoneId,
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

export const historicalZoneAnalyticsService = new HistoricalZoneAnalyticsService();
