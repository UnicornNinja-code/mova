/*
 * lbsRoutes.js
 * API Routes for Milestone B-11: Location-Based Services (LBS) & Real-Time Geofence Monitoring
 */

import express from "express";
import {
  pingRiderLocation,
  getLiveRiders,
  getNearbyRiders,
  getRiderLocation,
  calculateRiderDistance,
  getZoneLogs,
  getZonesDistanceSummary,
} from "../controllers/lbsController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 0. Fleet Multi-Rider Distance Summary to All Operational Zones
router.get(
  "/zones-distance-summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getZonesDistanceSummary
);
router.get(
  "/zones-distance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getZonesDistanceSummary
);

// 1. Live Rider GPS Ping & Telemetry Ingestion (Canonical & Legacy alias)
router.post("/ping", authenticateToken, pingRiderLocation);
router.post("/track", authenticateToken, pingRiderLocation);

// 2. Query All Live Rider Positions SSOT
router.get(
  "/riders/live",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getLiveRiders
);

// 3. Proximity Radius Search (PostGIS ST_DWithin)
router.get(
  "/nearby",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getNearbyRiders
);

// 4. Geofence Transition & Audit Logs
router.get(
  "/zone-logs",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getZoneLogs
);

// 5. Calculate Distance Between Two Active Riders
router.get(
  "/distance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  calculateRiderDistance
);

// 6. Single Rider Live Position Query
router.get(
  "/riders/:riderId",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getRiderLocation
);

export default router;
