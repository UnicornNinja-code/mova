/*
 * reportRoutes.js
 * API Routes for Comprehensive Reports & Export Engine in Single-Tenant COZIS
 */

import express from "express";
import {
  getExecutiveSummary,
  getRiderOperationalReport,
  getZoneEffectivenessReport,
  getFleetReport,
  getDssAccuracyReport,
  getAuditLogsReport,
  exportReport,
} from "../controllers/reportController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Executive Summary KPI (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/executive-summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getExecutiveSummary
);

// 2. Rider Operational & Attendance Report (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/rider-operational",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getRiderOperationalReport
);

// 3. Zone Effectiveness & Compliance Report (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/zone-effectiveness",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getZoneEffectivenessReport
);

// 4. Fleet Utilization & Health Report (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/fleet",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getFleetReport
);

// 5. DSS Recommendation & Accuracy Report (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/dss-accuracy",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDssAccuracyReport
);

// 6. Audit Logs Report (SUPERADMIN Only)
router.get(
  "/audit-logs",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  getAuditLogsReport
);

router.get(
  "/export",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  exportReport
);

router.get(
  "/export/:reportType",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  (req, res, next) => {
    req.query.type = req.params.reportType;
    return exportReport(req, res, next);
  }
);

export default router;
