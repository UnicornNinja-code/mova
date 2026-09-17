/*
 * poiRoutes.ts
 * API Routes for POI Operations in TypeScript
 */

import express from "express";
import {
  syncCityPois,
  reprocessLocalPois,
  getPoisByZone,
  getOperationalAreaPois,
  getDensitasDanDiversitasC1C2,
  getZoneC3Score,
  getZoneC4Score,
  getZoneC5Score,
  reclusterPois,
  getLeakageReport,
  getPendingPois,
  approveOrRejectPoi,
  getApprovalLogs,
  triggerCronDetection,
} from "../controllers/poiController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { citySyncLimiter } from "../middlewares/rateLimiterMiddleware.js";
import { getZoneC6Score } from "../controllers/competitorController.js";

const router = express.Router();

// Operational Area Approved POIs Retrieval
router.get("/operational-area", authenticateToken, getOperationalAreaPois);

// Master Data Full City POI Synchronization
router.post(
  "/sync-city",
  authenticateToken,
  citySyncLimiter,
  checkRole(["SUPERADMIN"]),
  syncCityPois
);

router.post(
  "/sync-osm",
  authenticateToken,
  citySyncLimiter,
  checkRole(["SUPERADMIN"]),
  syncCityPois
);

// Reprocess Local Staging Data from pois_raw
router.post(
  "/reprocess-local",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  reprocessLocalPois
);

// Re-cluster existing database POIs
router.post(
  "/recluster",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  reclusterPois
);

// Leakage report
router.get(
  "/leakage-report",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getLeakageReport
);

// Automated POI Cron Detection & Approval Workflow Routes
router.get(
  "/pending",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  getPendingPois
);

router.post(
  "/approve",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  approveOrRejectPoi
);

router.get(
  "/approval-logs",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  getApprovalLogs
);

router.post(
  "/cron/detect",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  triggerCronDetection
);

// Dynamic PostGIS Spatial Queries per Zone Polygon
router.get("/zone/:zone_id", authenticateToken, getPoisByZone);
router.get("/scores/c1-c2/:zone_id", authenticateToken, getDensitasDanDiversitasC1C2);
router.get("/scores/c3/:zone_id", authenticateToken, getZoneC3Score);
router.get("/scores/c4/:zone_id", authenticateToken, getZoneC4Score);
router.get("/scores/c5/:zone_id", authenticateToken, getZoneC5Score);
router.get("/scores/c6/:zone_id", authenticateToken, getZoneC6Score);

export default router;
