/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   auditRoutes.js (API Routes for Audit Logs)
 */

import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Fetch audit logs (RBAC: SUPERADMIN ONLY)
router.get(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getAuditLogs
);

export default router;

