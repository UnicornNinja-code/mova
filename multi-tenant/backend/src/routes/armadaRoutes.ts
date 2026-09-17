/*
 * armadaRoutes.ts
 * API Routes for Armada Management in TypeScript
 */

import express from "express";
import {
  getAllArmadas,
  getArmadaById,
  createArmada,
  updateArmada,
  deleteArmada,
  reportArmadaIssue,
  getAllIssueReports,
  resolveIssueReport,
  getArmadaHistory,
} from "../controllers/armadaController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Get all armadas
router.get("/", authenticateToken, getAllArmadas);

// 2. Issue reports routes (MUST be registered before `/:id` to avoid route collision)
router.get(
  "/issues",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getAllIssueReports
);

router.put(
  "/issues/:id/resolve",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  resolveIssueReport
);

// 3. Get single armada by ID & assignment history
router.get("/:id", authenticateToken, getArmadaById);
router.get(
  "/:id/history",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getArmadaHistory
);

// 4. Report issue on armada (Rider or Staff)
router.post(
  "/:id/report-issue",
  authenticateToken,
  reportArmadaIssue
);

// 5. Create, Update, & Delete armadas (RBAC: SUPERADMIN, MANAGEMENT)
router.post(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  createArmada
);

router.put(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  updateArmada
);

router.delete(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  deleteArmada
);

export default router;
