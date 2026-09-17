/*
 * systemSettingRoutes.ts
 * REST API Routes for System Settings & Operational Restriction Rules in TypeScript
 */

import { Router } from "express";
import { systemSettingController } from "../controllers/systemSettingController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// GET /api/system-settings/operational-rules
router.get("/operational-rules", (req, res, next) =>
  systemSettingController.getOperationalRules(req, res, next)
);

// PATCH /api/system-settings/operational-rules (SUPERADMIN ONLY)
router.patch(
  "/operational-rules",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res, next) => systemSettingController.updateOperationalRules(req, res, next)
);

export default router;
