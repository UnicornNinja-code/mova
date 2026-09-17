/*
 * auditRoutes.ts
 * API Routes for Audit Logs in TypeScript
 */

import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getAuditLogs
);

export default router;
