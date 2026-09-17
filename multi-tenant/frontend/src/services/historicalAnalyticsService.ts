/*
 * historicalAnalyticsService.ts
 * S7-03-10: Frontend Historical Operational Analytics REST Service
 * Exclusive Client Gateway for OpenAPI v4.1.0 Analytics Endpoints
 * 
 * Strict Invariants:
 * 1. Consumes exclusively canonical backend endpoints (/api/analytics/historical/*).
 * 2. Authenticated session token injected automatically via axiosInstance.
 * 3. Never calculates or fabricates business metrics in client service.
 */

import { axiosInstance } from "../lib/axios.js";
import type {
  HistoricalPresenceQuery,
  HistoricalDeviationsQuery,
  HistoricalZonesQuery,
  HistoricalRidersQuery,
  HistoricalComparisonQuery,
  PresenceAnalyticsResult,
  HistoricalDeviationSummaryDTO,
  ZoneAnalyticsResult,
  RiderAnalyticsResult,
  PeriodComparisonResult,
} from "../lib/types/analytics.types.js";

export const historicalAnalyticsService = {
  /**
   * GET /api/analytics/historical/presence/summary
   * Fetches authoritative aggregated presence and compliance summary.
   */
  getPresenceSummary: async (query: HistoricalPresenceQuery): Promise<PresenceAnalyticsResult> => {
    const res = await axiosInstance.get("/analytics/historical/presence/summary", { params: query });
    return res.data?.data || res.data;
  },

  /**
   * GET /api/analytics/historical/presence/timeline
   * Fetches bucketed presence and compliance timeseries.
   */
  getPresenceTimeline: async (query: HistoricalPresenceQuery): Promise<PresenceAnalyticsResult> => {
    const res = await axiosInstance.get("/analytics/historical/presence/timeline", { params: query });
    return res.data?.data || res.data;
  },

  /**
   * GET /api/analytics/historical/deviations
   * Fetches deterministic deviation episodes and summary metrics.
   */
  getDeviations: async (query: HistoricalDeviationsQuery): Promise<HistoricalDeviationSummaryDTO> => {
    const res = await axiosInstance.get("/analytics/historical/deviations", { params: query });
    return res.data?.data || res.data;
  },

  /**
   * GET /api/analytics/historical/zones
   * Fetches aggregated zone operational performance metrics.
   */
  getZoneAnalytics: async (query: HistoricalZonesQuery): Promise<ZoneAnalyticsResult> => {
    const res = await axiosInstance.get("/analytics/historical/zones", { params: query });
    return res.data?.data || res.data;
  },

  /**
   * GET /api/analytics/historical/riders
   * Fetches aggregated rider operational performance metrics.
   */
  getRiderAnalytics: async (query: HistoricalRidersQuery): Promise<RiderAnalyticsResult> => {
    const res = await axiosInstance.get("/analytics/historical/riders", { params: query });
    return res.data?.data || res.data;
  },

  /**
   * GET /api/analytics/historical/comparison
   * Fetches period-over-period delta and trend comparisons.
   */
  getPeriodComparison: async (query: HistoricalComparisonQuery): Promise<PeriodComparisonResult> => {
    const res = await axiosInstance.get("/analytics/historical/comparison", { params: query });
    return res.data?.data || res.data;
  },
};
