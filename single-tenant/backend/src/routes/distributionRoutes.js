/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   distributionRoutes.js (API Routes for Rider Duty Queue & Distribution Engine)
 */

import express from "express";
import {
  confirmDuty,
  getRiderDutyStatus,
  getDistributionOverview,
  autoDistribute,
  manualDistribute,
  getDistributionRuns,
  getDistributionRunById,
  getMyDutyHistory,
  getRidersSummary,
} from "../controllers/distributionController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Rider Duty Confirmation (RIDER, SUPERVISOR, SUPERADMIN)
router.post(
  "/duty/confirm",
  authenticateToken,
  confirmDuty
);
router.post(
  "/duty-confirm",
  authenticateToken,
  confirmDuty
);

// 2. Rider Operational Status Unified Endpoint (All Authenticated)
router.get(
  "/duty/status",
  authenticateToken,
  getRiderDutyStatus
);

// 2.1 Rider Operational Aggregated Status Summary (SPV, MANAGEMENT, SUPERADMIN)
router.get(
  "/riders/summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getRidersSummary
);
router.get(
  "/riders-summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getRidersSummary
);

// 3. Fetch Distribution Overview (SPV, MANAGEMENT, SUPERADMIN)
router.get(
  "/overview",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDistributionOverview
);
router.get(
  "/daily-status",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDistributionOverview
);

// 4. Trigger Automatic Distribution (SPV, SUPERADMIN)
router.post(
  "/auto-assign",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  autoDistribute
);
router.post(
  "/auto",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  autoDistribute
);

// 5. Trigger Manual Distribution & Supervisor Override (SPV, SUPERADMIN)
router.post(
  "/manual-assign",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  manualDistribute
);
router.post(
  "/manual",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  manualDistribute
);
router.post(
  "/override",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  manualDistribute
);

// 6. Distribution Runs Audit History (SPV, MANAGEMENT, SUPERADMIN)
router.get(
  "/runs",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDistributionRuns
);

router.get(
  "/runs/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDistributionRunById
);

// 7. Authenticated Rider Duty & Assignment History
router.get(
  "/my-history",
  authenticateToken,
  getMyDutyHistory
);

export default router;
