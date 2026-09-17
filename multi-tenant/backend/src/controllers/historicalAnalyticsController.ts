/*
 * historicalAnalyticsController.ts
 * S7-03-08: Additive HTTP Controller for Historical Operational Analytics (v4.1.0)
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Read-Only Gateway: Pure consumption of frozen domain services (S7-03-01 to S7-03-07).
 * 2. Zero Duplicated Domain Logic: No recalculation of ratios, episodes, or deltas in controller.
 * 3. Session-Bound Tenant Resolution: tenantId extracted from authenticated JWT (req.user), never from query parameters.
 * 4. Canonical Response Envelopes: ApiResponse<T> with ISO timestamp and request UUID.
 * 5. Strict Error Mapping: Domain validation codes map to standard HTTP 400/403/500 errors.
 */

import type { Request, Response } from "express";
import crypto from "crypto";
import { HistoricalPresenceAnalyticsService } from "../services/analytics/HistoricalPresenceAnalyticsService.js";
import { HistoricalDeviationEpisodeService } from "../services/analytics/HistoricalDeviationEpisodeService.js";
import { HistoricalZoneAnalyticsService } from "../services/analytics/HistoricalZoneAnalyticsService.js";
import { HistoricalRiderAnalyticsService } from "../services/analytics/HistoricalRiderAnalyticsService.js";
import { HistoricalPeriodComparisonService } from "../services/analytics/HistoricalPeriodComparisonService.js";
import type {
  AnalyticsTimeContext,
  AnalyticsGrain,
  PresenceAnalyticsResult,
  ZoneAnalyticsResult,
  RiderAnalyticsResult,
  HistoricalDeviationSummaryDTO,
  PeriodComparisonResult,
} from "../types/analytics.types.js";

const presenceService = new HistoricalPresenceAnalyticsService();
const deviationService = new HistoricalDeviationEpisodeService();
const zoneService = new HistoricalZoneAnalyticsService();
const riderService = new HistoricalRiderAnalyticsService();
const comparisonService = new HistoricalPeriodComparisonService(
  presenceService,
  deviationService,
  zoneService,
  riderService
);

function getTenantIdFromSession(req: Request): string {
  const tenantId = req.user?.tenant_id || req.user?.tenantId;
  if (!tenantId) {
    throw new Error("[UNAUTHORIZED_TENANT_CONTEXT] Active tenant session is missing or expired");
  }
  return String(tenantId);
}

function parseTimeContext(query: any): AnalyticsTimeContext {
  const rangeStart = query.rangeStart as string;
  const rangeEnd = query.rangeEnd as string;
  const timezone = (query.timezone as string) || "Asia/Jakarta";
  const grain = ((query.grain as string) || "day") as AnalyticsGrain;

  if (!rangeStart || !rangeEnd) {
    throw new Error("[INVALID_TIME_RANGE] rangeStart and rangeEnd query parameters are required");
  }

  return {
    rangeStart,
    rangeEnd,
    timezone,
    grain,
    boundarySemantics: "[start, end)",
  };
}

function buildMeta(req: Request) {
  const reqId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  return {
    timestamp: new Date().toISOString(),
    request_id: reqId,
  };
}

export class HistoricalAnalyticsController {
  /**
   * GET /api/analytics/historical/presence/summary
   */
  public static async getPresenceSummary(req: Request, res: Response): Promise<any> {
    try {
      const tenantId = getTenantIdFromSession(req);
      const timeContext = parseTimeContext(req.query);
      const riderId = req.query.riderId as string | undefined;
      const zoneId = req.query.zoneId as string | undefined;

      const summary = await presenceService.getPresenceSummary(tenantId, {
        timeContext,
        riderId,
        zoneId,
      });

      const responseData: PresenceAnalyticsResult = {
        timeContext,
        metrics: {
          observedRiders: summary.observedRiders,
          totalEvents: summary.presenceEvents,
          presenceEvents: summary.eventTypeBreakdown,
          complianceDistribution: {
            compliant: summary.compliance.compliant,
            deviated: summary.compliance.deviated,
            outside: summary.compliance.outside,
            unassigned: summary.compliance.unassigned,
          },
          eligibleEventsCount: summary.compliance.eligibleEventsCount,
          complianceRate: summary.compliance.rate,
        },
      };

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        msg: "Historical presence summary retrieved successfully",
        data: responseData,
        meta: buildMeta(req),
      });
    } catch (error: any) {
      const isValidationError = error.message && error.message.startsWith("[");
      const statusCode = isValidationError ? 400 : 500;
      return res.status(statusCode).json({
        status: "error",
        statusCode,
        msg: error.message || "Failed to retrieve historical presence summary",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/historical/presence/timeline
   */
  public static async getPresenceTimeline(req: Request, res: Response): Promise<any> {
    try {
      const tenantId = getTenantIdFromSession(req);
      const timeContext = parseTimeContext(req.query);
      const riderId = req.query.riderId as string | undefined;
      const zoneId = req.query.zoneId as string | undefined;

      const [summary, timelinePoints] = await Promise.all([
        presenceService.getPresenceSummary(tenantId, {
          timeContext,
          riderId,
          zoneId,
        }),
        presenceService.getPresenceTimeline(tenantId, {
          timeContext,
          riderId,
          zoneId,
        }),
      ]);

      const responseData: PresenceAnalyticsResult = {
        timeContext,
        metrics: {
          observedRiders: summary.observedRiders,
          totalEvents: summary.presenceEvents,
          presenceEvents: summary.eventTypeBreakdown,
          complianceDistribution: {
            compliant: summary.compliance.compliant,
            deviated: summary.compliance.deviated,
            outside: summary.compliance.outside,
            unassigned: summary.compliance.unassigned,
          },
          eligibleEventsCount: summary.compliance.eligibleEventsCount,
          complianceRate: summary.compliance.rate,
        },
        timeline: {
          grain: timeContext.grain,
          timezone: timeContext.timezone,
          points: timelinePoints.map((pt) => ({
            bucketStart: pt.bucketStart,
            totalEvents: pt.totalEvents,
            complianceDistribution: {
              compliant: pt.compliant,
              deviated: pt.deviated,
              outside: pt.outside,
              unassigned: pt.unassigned,
            },
            eligibleEventsCount: pt.compliant + pt.deviated + pt.outside,
            complianceRate: pt.complianceRate,
          })),
        },
      };

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        msg: "Historical presence timeline retrieved successfully",
        data: responseData,
        meta: buildMeta(req),
      });
    } catch (error: any) {
      const isValidationError = error.message && error.message.startsWith("[");
      const statusCode = isValidationError ? 400 : 500;
      return res.status(statusCode).json({
        status: "error",
        statusCode,
        msg: error.message || "Failed to retrieve historical presence timeline",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/historical/deviations
   */
  public static async getDeviations(req: Request, res: Response): Promise<any> {
    try {
      const tenantId = getTenantIdFromSession(req);
      const timeContext = parseTimeContext(req.query);
      const riderId = req.query.riderId as string | undefined;
      const zoneId = req.query.zoneId as string | undefined;
      const openOnly = req.query.openOnly === "true";

      const deviationSummary: HistoricalDeviationSummaryDTO = await deviationService.getDeviationEpisodes(tenantId, {
        timeContext,
        riderId,
        zoneId,
        openOnly,
      });

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        msg: "Historical deviation episodes retrieved successfully",
        data: deviationSummary,
        meta: buildMeta(req),
      });
    } catch (error: any) {
      const isValidationError = error.message && error.message.startsWith("[");
      const statusCode = isValidationError ? 400 : 500;
      return res.status(statusCode).json({
        status: "error",
        statusCode,
        msg: error.message || "Failed to retrieve deviation episodes",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/historical/zones
   */
  public static async getZoneAnalytics(req: Request, res: Response): Promise<any> {
    try {
      const tenantId = getTenantIdFromSession(req);
      const timeContext = parseTimeContext(req.query);
      const zoneId = req.query.zoneId as string | undefined;

      const zoneSummary = await zoneService.getZoneSummaries(tenantId, {
        timeContext,
        zoneId,
      });

      const responseData: ZoneAnalyticsResult = {
        timeContext,
        zones: zoneSummary.zones.map((z) => ({
          zoneId: z.zoneId,
          zoneName: z.zoneName,
          observedRiders: z.observedRiders,
          totalEvents: z.totalEvents,
          complianceDistribution: {
            compliant: z.compliantEvents,
            deviated: z.deviationEvents,
            outside: z.outsideEvents,
            unassigned: z.unassignedEvents,
          },
          eligibleEventsCount: z.compliantEvents + z.deviationEvents + z.outsideEvents,
          complianceRate: z.complianceRate,
          affectedRiders: z.affectedRiders,
          deviationEpisodes: z.deviationEpisodes,
          openDeviationEpisodes: z.openDeviationEpisodes,
        })),
      };

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        msg: "Historical zone analytics retrieved successfully",
        data: responseData,
        meta: buildMeta(req),
      });
    } catch (error: any) {
      const isValidationError = error.message && error.message.startsWith("[");
      const statusCode = isValidationError ? 400 : 500;
      return res.status(statusCode).json({
        status: "error",
        statusCode,
        msg: error.message || "Failed to retrieve zone analytics",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/historical/riders
   */
  public static async getRiderAnalytics(req: Request, res: Response): Promise<any> {
    try {
      const tenantId = getTenantIdFromSession(req);
      const timeContext = parseTimeContext(req.query);
      const riderId = req.query.riderId as string | undefined;

      const riderSummary = await riderService.getRiderSummaries(tenantId, {
        timeContext,
        riderId,
      });

      const responseData: RiderAnalyticsResult = {
        timeContext,
        riders: riderSummary.riders.map((r) => ({
          riderId: r.riderId,
          riderName: r.riderName ?? null,
          totalEvents: r.totalEvents,
          observedDays: r.observedDays,
          complianceDistribution: {
            compliant: r.compliantEvents,
            deviated: r.deviationEvents,
            outside: r.outsideEvents,
            unassigned: r.unassignedEvents,
          },
          eligibleEventsCount: r.eligibleEventsCount,
          complianceRate: r.complianceRate,
          deviationEvents: r.deviationEvents,
          deviationEpisodes: r.deviationEpisodes,
          openDeviationEpisodes: r.openDeviationEpisodes,
          affectedZones: r.affectedZones,
        })),
      };

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        msg: "Historical rider analytics retrieved successfully",
        data: responseData,
        meta: buildMeta(req),
      });
    } catch (error: any) {
      const isValidationError = error.message && error.message.startsWith("[");
      const statusCode = isValidationError ? 400 : 500;
      return res.status(statusCode).json({
        status: "error",
        statusCode,
        msg: error.message || "Failed to retrieve rider analytics",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/historical/comparison
   */
  public static async getPeriodComparison(req: Request, res: Response): Promise<any> {
    try {
      const tenantId = getTenantIdFromSession(req);
      const currentStart = req.query.currentRangeStart as string;
      const currentEnd = req.query.currentRangeEnd as string;
      const prevStart = req.query.previousRangeStart as string;
      const prevEnd = req.query.previousRangeEnd as string;
      const timezone = (req.query.timezone as string) || "Asia/Jakarta";
      const grain = ((req.query.grain as string) || "day") as AnalyticsGrain;

      if (!currentStart || !currentEnd || !prevStart || !prevEnd) {
        throw new Error("[INVALID_TIME_RANGE] currentRangeStart, currentRangeEnd, previousRangeStart, and previousRangeEnd are required");
      }

      const currentContext: AnalyticsTimeContext = {
        rangeStart: currentStart,
        rangeEnd: currentEnd,
        timezone,
        grain,
        boundarySemantics: "[start, end)",
      };

      const previousContext: AnalyticsTimeContext = {
        rangeStart: prevStart,
        rangeEnd: prevEnd,
        timezone,
        grain,
        boundarySemantics: "[start, end)",
      };

      const comparisonResult: PeriodComparisonResult = await comparisonService.comparePeriods(
        tenantId,
        currentContext,
        previousContext
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        msg: "Historical period comparison retrieved successfully",
        data: comparisonResult,
        meta: buildMeta(req),
      });
    } catch (error: any) {
      const isValidationError = error.message && error.message.startsWith("[");
      const statusCode = isValidationError ? 400 : 500;
      return res.status(statusCode).json({
        status: "error",
        statusCode,
        msg: error.message || "Failed to perform historical period comparison",
        error: error.message,
      });
    }
  }
}
