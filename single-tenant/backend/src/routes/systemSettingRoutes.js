/*
 * SystemSettingRoutes.js
 * REST API Routes for System Settings, Central Hub Configuration & System Readiness
 */

import { Router } from "express";
import { systemSettingController } from "../controllers/systemSettingController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// 1. Operational Restriction Rules (Protocol & Toll Road)
router.get("/operational-rules", authenticateToken, (req, res, next) =>
  systemSettingController.getOperationalRules(req, res, next)
);

router.patch(
  "/operational-rules",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res, next) => systemSettingController.updateOperationalRules(req, res, next)
);

// 2. Holistic System Readiness Evaluation
router.get("/readiness", authenticateToken, (req, res, next) =>
  systemSettingController.getSystemReadiness(req, res, next)
);

// 3. Central Hub Spatial Configuration
router.get("/hub", authenticateToken, (req, res, next) =>
  systemSettingController.getHubConfig(req, res, next)
);

router.put(
  "/hub",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res, next) => systemSettingController.updateHubConfig(req, res, next)
);

// 4. Map Tile Configuration Metadata
router.get("/map-config", authenticateToken, (req, res, next) =>
  systemSettingController.getMapConfig(req, res, next)
);

export default router;
