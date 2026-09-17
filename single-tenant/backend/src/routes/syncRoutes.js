/*
 * syncRoutes.js
 * API Routes for Data Freshness Monitoring & Triggering
 */

import express from "express";
import {
  getSyncStatus,
  getSyncRuns,
  triggerPoiSync,
  triggerWeatherSync,
} from "../controllers/syncController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Get overall data freshness status summary (All Authenticated Roles)
router.get("/status", authenticateToken, getSyncStatus);

// Get recent sync execution audit logs (SUPERADMIN, SUPERVISOR)
router.get("/runs", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), getSyncRuns);

// Trigger POI sync from Overpass API (SUPERADMIN ONLY)
router.post("/poi", authenticateToken, checkRole(["SUPERADMIN"]), triggerPoiSync);

// Trigger Weather sync from Open-Meteo API (SUPERADMIN, SUPERVISOR)
router.post("/weather", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), triggerWeatherSync);

export default router;
