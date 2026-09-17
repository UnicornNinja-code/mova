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
  bulkCreateCompetitors,
  deleteCompetitor,
  getCompetitorSummary,
  reconcileCompetitor,
  detectCandidates,
  unlinkCompetitor,
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

// Detect candidate matches for a zone (Data Quality / Review metadata)
router.post(
  "/candidates/:zone_id",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  detectCandidates
);

// Explicit reconciliation link
router.post(
  "/:competitor_id/reconcile",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  reconcileCompetitor
);

// Unlink reconciliation
router.post(
  "/:competitor_id/unlink",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  unlinkCompetitor
);

// Ingest a batch of field competitor records (RBAC: SUPERADMIN, SUPERVISOR)
router.post(
  "/bulk",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  bulkCreateCompetitors
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
