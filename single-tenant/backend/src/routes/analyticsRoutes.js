/*
 * analyticsRoutes.js
 * API Routes for Milestone B-12: Reporting, Supervisor KPI & Plan-vs-Actual Analytics Layer
 */

import express from "express";
import {
  getDashboardOverview,
  getOperationalSummary,
  getFleetUtilization,
  getComplianceSummary,
  getSalesPerformance,
  getDSSPlanVsActual,
  getDailyReport,
} from "../controllers/analyticsController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Unified Dashboard Overview (RBAC: SUPERADMIN, MANAGEMENT, SUPERVISOR, RIDER)
router.get(
  "/overview",
  authenticateToken,
  getDashboardOverview
);

// 2. Operational Lifecycle & Fleet Analytics
router.get(
  "/operational/summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getOperationalSummary
);

router.get(
  "/operational/fleet-utilization",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getFleetUtilization
);

// 3. Spatial Compliance & Restriction Analytics
router.get(
  "/compliance/summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getComplianceSummary
);

// 4. Commercial & Sales Performance Analytics
router.get(
  "/sales/performance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"]),
  getSalesPerformance
);

// 5. DSS Plan-vs-Actual Effectiveness Analytics
router.get(
  "/dss/plan-vs-actual",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDSSPlanVsActual
);

// 6. Formal Tabular Report & CSV Export
router.get(
  "/reports/daily-summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getDailyReport
);

export default router;
