/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   competitorRoutes (API Routes for Competitor Field Survey Data Management)
 */

import express from "express";
import {
  getZoneC6Score,
  getCompetitorsByZone,
  createCompetitor,
  deleteCompetitor,
  getCompetitorSummary,
} from "../controllers/competitorController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Global Competitor Overview & Citywide Statistics (Dashboard & Analytics)
router.get("/summary", authenticateToken, getCompetitorSummary);
router.get("/stats", authenticateToken, getCompetitorSummary);

// Calculate / Fetch C6 Competitor Density Score for a Zone
router.get(
  "/score/:zone_id",
  authenticateToken,
  getZoneC6Score
);

// Fetch field competitors for a specific zone
router.get(
  "/zone/:zone_id",
  authenticateToken,
  getCompetitorsByZone
);

// Add new field competitor record (RBAC: SUPERADMIN, SUPERVISOR)
router.post(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  createCompetitor
);

// Delete field competitor record (RBAC: SUPERADMIN, SUPERVISOR)
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  deleteCompetitor
);

export default router;
