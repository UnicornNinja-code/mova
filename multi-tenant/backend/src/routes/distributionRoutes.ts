/*
 * distributionRoutes.ts
 * API Routes for Operational Sessions, Rider Duty Queue & Distribution Engine in TypeScript
 */

import express from "express";
import {
  confirmDuty,
  getDistributionOverview,
  previewDistribution,
  confirmDistribution,
  autoDistribute,
  manualDistribute,
  getDistributionRuns,
  updateRiderDutyStatus,
  emergencySwap,
  getMyDutyHistory,
} from "../controllers/distributionController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post(
  "/emergency-swap",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  emergencySwap
);

router.post(
  "/duty-confirm",
  authenticateToken,
  confirmDuty
);

router.get(
  "/overview",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDistributionOverview
);

router.get(
  "/preview",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  previewDistribution
);

router.post(
  "/confirm",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  confirmDistribution
);

router.post(
  "/auto",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  autoDistribute
);

router.post(
  "/manual",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  manualDistribute
);

router.get(
  "/runs",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDistributionRuns
);

router.put(
  "/duty/:id/status",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  updateRiderDutyStatus
);

router.get(
  "/my-history",
  authenticateToken,
  getMyDutyHistory
);

export default router;
