/*
 * RoadRoutes.js
 * REST API routes for spatial road restrictions (Protocol & Toll Roads)
 */

import { Router } from "express";
import { roadController } from "../controllers/roadController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// GET /api/roads/protocol - Read-only GeoJSON spatial restriction layer for Protocol Roads
router.get("/protocol", (req, res, next) => roadController.getProtocolRoads(req, res, next));

// GET /api/roads/toll - Read-only GeoJSON spatial restriction layer for Toll Roads
router.get("/toll", (req, res, next) => roadController.getTollRoads(req, res, next));

// POST /api/roads/sync-toll - Trigger Overpass API ingestion for Toll Roads (SUPERADMIN ONLY)
router.post(
  "/sync-toll",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res, next) => roadController.syncTollRoads(req, res, next)
);

// POST /api/roads/sync-protocol - Trigger Overpass API ingestion for Protocol Roads (SUPERADMIN ONLY)
router.post(
  "/sync-protocol",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res, next) => roadController.syncProtocolRoads(req, res, next)
);

import { getZoneC4Score } from "../controllers/poiController.js";

// GET /api/roads/zone-accessibility-score/:zone_id - Calculate C4 Road Accessibility Score for a Zone
router.get("/zone-accessibility-score/:zone_id", authenticateToken, getZoneC4Score);

export default router;


