/*
 * reportDataFetcher.ts
 * S7-05-03: Memory-Safe Streaming & Chunked Query Engine for Operational Reports
 * MOVA Architecture
 * 
 * Strict Invariants:
 * 1. Multi-Tenant Session RLS (`withTenantContext`).
 * 2. Bounded Chunk Fetching (Max batch size 1,000, max total limit 100,000).
 * 3. Keyset Pagination / Bounded Streaming for memory safety.
 * 4. Authoritative Facts: Reads persisted Stage 6 & S7-03 data sources.
 */

import type { PoolClient } from "pg";
import { withTenantContext } from "../../lib/tenantContext.js";
import { REPORT_GOVERNANCE, ReportFilter } from "../../types/reporting.types.js";

export interface PresenceEventRow {
  id: string;
  capturedAt: string;
  capturedAtFormatted: string;
  riderId: string;
  riderName: string;
  riderEmail: string;
  assignedZoneId: string | null;
  assignedZoneName: string | null;
  observedZoneId: string | null;
  observedZoneName: string | null;
  eventType: string;
  complianceStatus: string;
  latitude: number;
  longitude: number;
}

export interface ChunkedQueryResult<T> {
  rows: T[];
  totalCount: number;
  truncated: boolean;
  hasMore: boolean;
}

export class ReportDataFetcher {
  public static readonly DEFAULT_CHUNK_SIZE = 1000;
  public static readonly MAX_ROW_LIMIT = REPORT_GOVERNANCE.MAX_ROW_LIMIT;

  /**
   * Format ISO timestamp to formatted local time string in requested IANA timezone
   */
  public static formatLocalTimestamp(isoDate: string | Date, timezone: string): string {
    const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
    if (isNaN(d.getTime())) return "N/A";
    try {
      return new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d).replace(" ", "T");
    } catch {
      return d.toISOString();
    }
  }

  /**
   * Fetch presence events in bounded chunks with callback iteration.
   * Ensures memory consumption never scales linearly with 100,000 rows.
   */
  public async streamPresenceEvents(
    tenantId: string,
    filter: ReportFilter,
    onChunk: (chunk: PresenceEventRow[], chunkIndex: number) => Promise<void> | void,
    chunkSize = ReportDataFetcher.DEFAULT_CHUNK_SIZE
  ): Promise<{ totalRows: number; truncated: boolean }> {
    const maxLimit = ReportDataFetcher.MAX_ROW_LIMIT;
    let totalRows = 0;
    let truncated = false;
    let lastCapturedAt: string | null = null;
    let lastId: string | null = null;
    let chunkIndex = 0;

    const tz = filter.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE;

    await withTenantContext(tenantId, async (client: PoolClient) => {
      while (totalRows < maxLimit) {
        const remainingLimit = Math.min(chunkSize, maxLimit - totalRows);
        const params: any[] = [tenantId, filter.rangeStart, filter.rangeEnd];
        let whereClause = `
          WHERE rpe.tenant_id = $1
            AND rpe.captured_at >= $2
            AND rpe.captured_at < $3
        `;

        if (filter.riderId) {
          params.push(filter.riderId);
          whereClause += ` AND rpe.rider_id = $${params.length}`;
        }

        if (filter.zoneId) {
          params.push(filter.zoneId);
          whereClause += ` AND (rpe.zone_id = $${params.length} OR rpe.assigned_zone_id = $${params.length})`;
        }

        // Keyset pagination cursor
        if (lastCapturedAt && lastId) {
          params.push(lastCapturedAt, lastId);
          whereClause += ` AND (rpe.captured_at, rpe.id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
        }

        params.push(remainingLimit + 1); // +1 to check for truncation/more rows
        const query = `
          SELECT
            rpe.id,
            rpe.captured_at,
            rpe.rider_id,
            COALESCE(u.name, 'Unknown Rider') AS rider_name,
            COALESCE(u.email, '-') AS rider_email,
            rpe.assigned_zone_id,
            az.name AS assigned_zone_name,
            rpe.zone_id AS observed_zone_id,
            oz.name AS observed_zone_name,
            rpe.event_type,
            rpe.compliance_status,
            rpe.latitude,
            rpe.longitude
          FROM rider_presence_events rpe
          LEFT JOIN users u ON rpe.rider_id = u.id
          LEFT JOIN zones az ON rpe.assigned_zone_id = az.id
          LEFT JOIN zones oz ON rpe.zone_id = oz.id
          ${whereClause}
          ORDER BY rpe.captured_at ASC, rpe.id ASC
          LIMIT $${params.length};
        `;

        const { rows } = await client.query(query, params);
        if (rows.length === 0) break;

        const hasMore = rows.length > remainingLimit;
        const currentBatch = hasMore ? rows.slice(0, remainingLimit) : rows;

        const mappedRows: PresenceEventRow[] = currentBatch.map((r) => ({
          id: r.id,
          capturedAt: new Date(r.captured_at).toISOString(),
          capturedAtFormatted: ReportDataFetcher.formatLocalTimestamp(r.captured_at, tz),
          riderId: r.rider_id,
          riderName: r.rider_name,
          riderEmail: r.rider_email,
          assignedZoneId: r.assigned_zone_id || null,
          assignedZoneName: r.assigned_zone_name || "-",
          observedZoneId: r.observed_zone_id || null,
          observedZoneName: r.observed_zone_name || "-",
          eventType: r.event_type,
          complianceStatus: r.compliance_status,
          latitude: Number(r.latitude) || 0,
          longitude: Number(r.longitude) || 0,
        }));

        totalRows += mappedRows.length;
        await onChunk(mappedRows, chunkIndex);
        chunkIndex++;

        const lastRow = currentBatch[currentBatch.length - 1];
        lastCapturedAt = lastRow.captured_at;
        lastId = lastRow.id;

        if (totalRows >= maxLimit) {
          if (hasMore) {
            truncated = true;
          }
          break;
        }

        if (!hasMore) {
          break;
        }
      }
    });

    return { totalRows, truncated };
  }

  /**
   * Fetch tenant profile name for report header metadata
   */
  public async getTenantName(tenantId: string): Promise<string> {
    try {
      return await withTenantContext(tenantId, async (client: PoolClient) => {
        const { rows } = await client.query(
          "SELECT name FROM tenants WHERE id = $1 LIMIT 1;",
          [tenantId]
        );
        return rows[0]?.name || "Sejuta Jiwa Coffee";
      });
    } catch {
      return "Sejuta Jiwa Coffee";
    }
  }
}

export const reportDataFetcher = new ReportDataFetcher();
