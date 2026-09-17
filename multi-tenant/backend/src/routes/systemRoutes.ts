/*
 * systemRoutes.ts
 * API Routes for System Readiness & Foundation Configuration in TypeScript
 */

import express from "express";
import {
  getSystemReadiness,
  updateSystemSettings,
  getSetupStatus,
  saveSetupStep,
  applySystemSetup,
  startSpatialSyncFlow,
  retryPartialSpatialSync,
  abortSpatialSync,
  getSpatialSyncStatus,
} from "../controllers/systemSettingController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { checkSetupFsmMutationLock } from "../middlewares/setupFsmMiddleware.js";

const router = express.Router();

router.get(
  "/readiness",
  authenticateToken,
  getSystemReadiness
);

router.get(
  "/settings",
  authenticateToken,
  getSystemReadiness
);

router.put(
  "/settings",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  checkSetupFsmMutationLock,
  updateSystemSettings
);

// First-Run System Setup / Initial Configuration Wizard Gate
router.get(
  "/setup-status",
  authenticateToken,
  getSetupStatus
);

router.post(
  "/setup-step",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  checkSetupFsmMutationLock,
  saveSetupStep
);

router.post(
  "/apply-setup",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  applySystemSetup
);

// Distributed Spatial Sync Pipeline & Flow Control Endpoints
router.post(
  "/sync/start",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  startSpatialSyncFlow
);

router.post(
  "/sync/retry-partial",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  retryPartialSpatialSync
);

router.post(
  "/sync/abort",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  abortSpatialSync
);

router.get(
  "/sync/status",
  authenticateToken,
  getSpatialSyncStatus
);

export default router;
