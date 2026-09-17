/*
 * historicalAnalyticsRoutes.ts
 * S7-03-08: Express API Routes for Historical Operational Analytics (v4.1.0)
 * MOVA Architecture - Pure Additive Intelligence Layer
 */

import express from "express";
import { HistoricalAnalyticsController } from "../controllers/historicalAnalyticsController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Role scope: MANAGEMENT, SUPERVISOR, SUPERADMIN
const ANALYTICS_ROLES = ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"];

/**
 * GET /api/analytics/historical/presence/summary
 * Aggregate high-level operational presence and compliance metrics
 */
router.get(
  "/presence/summary",
  authenticateToken,
  checkRole(ANALYTICS_ROLES),
  HistoricalAnalyticsController.getPresenceSummary
);

/**
 * GET /api/analytics/historical/presence/timeline
 * Temporal presence compliance timeline bucketing
 */
router.get(
  "/presence/timeline",
  authenticateToken,
  checkRole(ANALYTICS_ROLES),
  HistoricalAnalyticsController.getPresenceTimeline
);

/**
 * GET /api/analytics/historical/deviations
 * Deterministic deviation episode reconstruction
 */
router.get(
  "/deviations",
  authenticateToken,
  checkRole(ANALYTICS_ROLES),
  HistoricalAnalyticsController.getDeviations
);

/**
 * GET /api/analytics/historical/zones
 * Zone historical operational performance and attribution
 */
router.get(
  "/zones",
  authenticateToken,
  checkRole(ANALYTICS_ROLES),
  HistoricalAnalyticsController.getZoneAnalytics
);

/**
 * GET /api/analytics/historical/riders
 * Rider historical operational metrics and activity
 */
router.get(
  "/riders",
  authenticateToken,
  checkRole(ANALYTICS_ROLES),
  HistoricalAnalyticsController.getRiderAnalytics
);

/**
 * GET /api/analytics/historical/comparison
 * Consolidated period-over-period comparison with safe deltas
 */
router.get(
  "/comparison",
  authenticateToken,
  checkRole(ANALYTICS_ROLES),
  HistoricalAnalyticsController.getPeriodComparison
);

export default router;
