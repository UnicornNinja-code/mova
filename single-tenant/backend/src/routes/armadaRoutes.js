/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   armadaRoutes.js (API Routes for Armada Management & 5-Min Hold Claim)
 */

import express from "express";
import {
  getAllArmadas,
  getArmadaById,
  createArmada,
  updateArmada,
  deleteArmada,
  holdArmada,
  claimArmada,
  releaseArmada,
  setMaintenance,
  releaseMaintenance,
} from "../controllers/armadaController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Get all armadas & get by ID (Authenticated users)
router.get("/", authenticateToken, getAllArmadas);
router.get("/:id", authenticateToken, getArmadaById);

// 2. 5-Minute Hold, Claim, and Release Endpoints (Riders & Staff)
router.post("/:id/hold", authenticateToken, holdArmada);
router.post("/:id/claim", authenticateToken, claimArmada);
router.post("/:id/release", authenticateToken, releaseArmada);
router.post("/:id/maintenance", authenticateToken, checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]), setMaintenance);
router.post("/:id/release-maintenance", authenticateToken, checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]), releaseMaintenance);

// 3. Create, Update, & Delete armadas (RBAC: SUPERADMIN, MANAGEMENT)
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
