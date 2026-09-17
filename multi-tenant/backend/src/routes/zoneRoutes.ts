/*
 * zoneRoutes.ts
 * API Routes for Zone Management in TypeScript
 */

import express from "express";
import {
  getZoneConfig,
  getAllZones,
  getZoneById,
  validateZone,
  createZone,
  updateZone,
  updateZoneStatus,
  updateZoneCapacity,
  deleteZone,
} from "../controllers/zoneController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Read zones & spatial config
router.get("/config", authenticateToken, getZoneConfig);
router.get("/", authenticateToken, getAllZones);
router.get("/:id", authenticateToken, getZoneById);

// Pre-validate zone polygon (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.post(
  "/validate",
  authenticateToken,
  validateZone
);

// Create zone (SUPERADMIN ONLY)
router.post(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  createZone
);

// Full update zone (SUPERADMIN ONLY)
router.put(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  updateZone
);

// Quick update status (SUPERADMIN ONLY)
router.patch(
  "/:id/status",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  updateZoneStatus
);

// Quick update capacity (SUPERADMIN ONLY)
router.patch(
  "/:id/capacity",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  updateZoneCapacity
);

// Delete zone (SUPERADMIN ONLY)
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  deleteZone
);

export default router;
