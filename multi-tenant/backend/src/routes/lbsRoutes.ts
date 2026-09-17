/*
 * lbsRoutes.ts
 * API Routes for Stage 5 High-Frequency GPS Ingestion, Spatial Presence & Redis Proximity
 * MOVA Architecture
 */

import express from "express";
import {
  ingestPositions,
  getMyPosition,
  getRiderPosition,
  getNearbyRiders,
  getZonePresence,
  getRiderPresenceHistory,
  getZoneComplianceSummary,
  trackRiderLocation,
  calculateRiderDistance,
} from "../controllers/lbsController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. High-Frequency GPS Position Ingestion (Canonical Stage 5)
router.post(
  "/positions",
  authenticateToken,
  ingestPositions
);

// 2. Current Authenticated Rider Position
router.get(
  "/me/position",
  authenticateToken,
  getMyPosition
);

// 3. Nearby Active Riders Proximity Search
router.get(
  "/riders/nearby",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getNearbyRiders
);

// 4. Specific Rider Position
router.get(
  "/riders/:riderId/position",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getRiderPosition
);

// 5. Zone Spatial Presence
router.get(
  "/zones/:zoneId/presence",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getZonePresence
);

// 6. Rider Historical Presence Events (Stage 6)
router.get(
  "/riders/:riderId/presence-history",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getRiderPresenceHistory
);

// 7. Zone Operational Compliance Summary (Stage 6)
router.get(
  "/zones/:zoneId/compliance-summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getZoneComplianceSummary
);

// ---------- Legacy Compatibility Aliases ----------
router.post(
  "/track",
  authenticateToken,
  trackRiderLocation
);

router.get(
  "/nearby",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getNearbyRiders
);

router.get(
  "/distance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  calculateRiderDistance
);

router.get(
  "/riders/:riderId",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getRiderPosition
);

export default router;
