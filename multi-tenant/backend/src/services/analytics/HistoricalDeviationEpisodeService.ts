/*
 * HistoricalDeviationEpisodeService.ts
 * S7-03-04: Deterministic Deviation Episode Reconstruction Engine
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Deviation Episode is a derived analytical entity (zero database mutation / persistence).
 * 2. Authoritative Ordering: (rider_id ASC, captured_at ASC, created_at ASC, id ASC).
 * 3. Consecutive DEVIATED events for a rider collapse into a single episode.
 * 4. Deterministic Identity: `ep_${tenantId}_${riderId}_${startEventId}`.
 * 5. Open Episodes: Episodes ongoing at rangeEnd have open=true, endedAt=null, durationSeconds=null.
 * 6. True Elapsed Physical Instant Duration (DST-safe).
 */

import { withTenantContext } from "../../lib/tenantContext.js";
import {
  buildDeterministicEpisodeId,
  calculatePeriodDelta,
} from "../../lib/analytics/analyticsMath.js";
import {
  validateAnalyticsTimeContext,
  calculateElapsedDurationSeconds,
  isWithinBoundary,
} from "../../lib/analytics/analyticsTime.js";
import type {
  DeviationAnalyticsFilter,
  DeviationEpisode,
  DeviationMetrics,
  HistoricalDeviationSummaryDTO,
} from "../../types/analytics.types.js";

export interface RawPresenceEventRow {
  id: string;
  tenant_id: string;
  rider_id: string;
  rider_name?: string;
  zone_id: string | null;
  zone_name?: string | null;
  assigned_zone_id: string | null;
  assigned_zone_name?: string | null;
  event_type: string;
  compliance_status: string;
  captured_at: string | Date;
  created_at?: string | Date;
}

/**
 * Determine if an event indicates an active deviation state
 */
export function isDeviationEvent(event: { compliance_status?: string; event_type?: string }): boolean {
  return event.compliance_status === "DEVIATED" || event.event_type === "DEVIATED";
}

/**
 * Determine if an event represents a recovery/transition out of deviation state
 */
export function isDeviationRecovery(event: { compliance_status?: string; event_type?: string }): boolean {
  return (
    event.compliance_status === "COMPLIANT" ||
    event.compliance_status === "OUTSIDE" ||
    event.compliance_status === "UNASSIGNED"
  );
}

/**
 * Pure, deterministic in-memory episode reconstruction function from a sorted array of events
 */
export function reconstructDeviationEpisodes(
  tenantId: string,
  events: RawPresenceEventRow[]
): DeviationEpisode[] {
  if (!events || events.length === 0) {
    return [];
  }

  // 1. Group events strictly by rider_id to ensure absolute rider isolation
  const riderEventsMap = new Map<string, RawPresenceEventRow[]>();
  for (const e of events) {
    const list = riderEventsMap.get(e.rider_id);
    if (list) {
      list.push(e);
    } else {
      riderEventsMap.set(e.rider_id, [e]);
    }
  }

  const allEpisodes: DeviationEpisode[] = [];

  // 2. Process each rider's sequential timeline independently
  for (const [riderId, rEvents] of riderEventsMap.entries()) {
    // Ensure strict authoritative ordering: captured_at ASC, created_at ASC, id ASC
    rEvents.sort((a, b) => {
      const tA = new Date(a.captured_at).getTime();
      const tB = new Date(b.captured_at).getTime();
      if (tA !== tB) return tA - tB;

      const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (cA !== cB) return cA - cB;

      return String(a.id).localeCompare(String(b.id));
    });

    let activeEpisode: DeviationEpisode | null = null;

    for (const ev of rEvents) {
      const isDev = isDeviationEvent(ev);
      const isRec = isDeviationRecovery(ev);

      if (isDev) {
        if (!activeEpisode) {
          // Start of a new deviation episode
          const startIso = new Date(ev.captured_at).toISOString();
          activeEpisode = {
            id: buildDeterministicEpisodeId(tenantId, riderId, ev.id),
            tenantId,
            riderId,
            riderName: ev.rider_name || "Rider Operasional",
            zoneId: ev.zone_id || null,
            zoneName: ev.zone_name || null,
            assignedZoneId: ev.assigned_zone_id || null,
            assignedZoneName: ev.assigned_zone_name || null,
            startedAt: startIso,
            endedAt: null,
            durationSeconds: null,
            open: true,
            eventCount: 1,
            startEventId: ev.id,
            endEventId: null,
          };
        } else {
          // Consecutive deviation observation -> collapse into active episode
          activeEpisode.eventCount += 1;
          if (ev.zone_id && !activeEpisode.zoneId) {
            activeEpisode.zoneId = ev.zone_id;
            activeEpisode.zoneName = ev.zone_name || null;
          }
        }
      } else if (isRec && activeEpisode) {
        // Recovery event encountered -> close current episode
        const endIso = new Date(ev.captured_at).toISOString();
        activeEpisode.endedAt = endIso;
        activeEpisode.endEventId = ev.id;
        activeEpisode.open = false;
        activeEpisode.durationSeconds = calculateElapsedDurationSeconds(activeEpisode.startedAt, endIso);

        allEpisodes.push(activeEpisode);
        activeEpisode = null;
      }
    }

    // If an episode was left open at the end of the queried stream
    if (activeEpisode) {
      allEpisodes.push(activeEpisode);
    }
  }

  // Sort episodes chronologically by startedAt ASC
  allEpisodes.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  return allEpisodes;
}

export class HistoricalDeviationEpisodeService {
  /**
   * Fetch and reconstruct all deviation episodes for a tenant within the requested time range
   */
  public async getDeviationEpisodes(
    tenantId: string,
    filter: DeviationAnalyticsFilter
  ): Promise<HistoricalDeviationSummaryDTO> {
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
        query += ` AND rpe.rider_id = $${params.length}`;
      }

      if (filter.zoneId) {
        params.push(filter.zoneId);
        query += ` AND (rpe.zone_id = $${params.length} OR rpe.assigned_zone_id = $${params.length})`;
      }

      query += ` ORDER BY rpe.rider_id ASC, rpe.captured_at ASC, rpe.created_at ASC, rpe.id ASC`;

      const { rows } = await client.query(query, params);

      // Reconstruct episodes deterministically
      let episodes = reconstructDeviationEpisodes(tenantId, rows);

      // Optional filter for open episodes only
      if (filter.openOnly) {
        episodes = episodes.filter((ep) => ep.open);
      }

      // Calculate summary metrics
      let totalDurationSeconds = 0;
      let closedCountWithDuration = 0;
      let totalEventsInEpisodes = 0;
      const affectedRidersSet = new Set<string>();

      for (const ep of episodes) {
        affectedRidersSet.add(ep.riderId);
        totalEventsInEpisodes += ep.eventCount;
        if (!ep.open && ep.durationSeconds !== null && ep.durationSeconds >= 0) {
          totalDurationSeconds += ep.durationSeconds;
          closedCountWithDuration += 1;
        }
      }

      const averageDurationSeconds = closedCountWithDuration > 0
        ? Math.round(totalDurationSeconds / closedCountWithDuration)
        : null;

      const metrics: DeviationMetrics = {
        eventCount: totalEventsInEpisodes,
        episodeCount: episodes.length,
        affectedRidersCount: affectedRidersSet.size,
        averageDurationSeconds,
        openEpisodesCount: episodes.filter((ep) => ep.open).length,
      };

      return {
        range: {
          rangeStart: filter.timeContext.rangeStart,
          rangeEnd: filter.timeContext.rangeEnd,
          timezone: filter.timeContext.timezone,
        },
        metrics,
        episodes,
      };
    });
  }
}

export const historicalDeviationEpisodeService = new HistoricalDeviationEpisodeService();
