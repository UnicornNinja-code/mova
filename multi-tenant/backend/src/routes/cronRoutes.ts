/*
 * cronRoutes.ts
 * API Routes for Cron Management Engine in TypeScript
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

router.get(
  "/configs",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getCronConfigs
);

router.get(
  "/logs",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getCronLogs
);

router.put(
  "/toggle/:cronKey",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  toggleCronActive
);

router.post(
  "/trigger/:cronKey",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  triggerCronManually
);

export default router;
