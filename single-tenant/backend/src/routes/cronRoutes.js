/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   cronRoutes.js (API Routes for Cron Management Engine)
 */

import express from "express";
import {
  getCronConfigs,
  getCronLogs,
  toggleCronActive,
  triggerCronManually,
} from "../controllers/cronController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Fetch cron job configurations (RBAC: SUPERADMIN ONLY)
router.get(
  "/configs",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getCronConfigs
);

// 2. Fetch execution history logs (RBAC: SUPERADMIN ONLY)
router.get(
  "/logs",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getCronLogs
);

// 3. Toggle cron job active state (RBAC: SUPERADMIN)
router.put(
  "/toggle/:cronKey",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  toggleCronActive
);

// 4. Trigger cron job manually on-demand (RBAC: SUPERADMIN)
router.post(
  "/trigger/:cronKey",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  triggerCronManually
);

export default router;
