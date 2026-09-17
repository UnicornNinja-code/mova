/*
 * dssRoutes.ts
 * API Routes for DSS BWM Weight Engine & TOPSIS Recommendations in TypeScript
 */

import express from "express";
import {
  calculateBwmWeights,
  previewBwmImpact,
  activateBwmConfig,
  getActiveDssConfig,
  getAllDssConfigs,
  getZoneRawEvaluation,
  evaluateHybridBwmTopsis,
  getDssSnapshots,
  getDssSnapshotById,
  getTopsisRecommendations,
} from "../controllers/dssController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post(
  "/bwm/calculate",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  calculateBwmWeights
);

router.post(
  "/bwm/preview-impact",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR", "MANAGEMENT"]),
  previewBwmImpact
);

router.post(
  "/bwm/:id/activate",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  activateBwmConfig
);

router.get(
  "/bwm/active",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR", "MANAGEMENT"]),
  getActiveDssConfig
);

router.get(
  "/bwm/configs",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR", "MANAGEMENT"]),
  getAllDssConfigs
);

router.get(
  "/zones/:id/raw-evaluation",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  getZoneRawEvaluation
);

router.post(
  "/evaluate",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  evaluateHybridBwmTopsis
);

router.get(
  "/snapshots",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  getDssSnapshots
);

router.get(
  "/snapshots/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  getDssSnapshotById
);

router.get(
  "/recommendations",
  authenticateToken,
  getTopsisRecommendations
);

export default router;
