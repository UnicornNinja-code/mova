/*
 * roadRoutes.ts
 * REST API routes for spatial road restrictions in TypeScript
 */

import { Router } from "express";
import { roadController } from "../controllers/roadController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// GET /api/roads/protocol
router.get("/protocol", (req, res, next) => roadController.getProtocolRoads(req, res, next));

// GET /api/roads/toll
router.get("/toll", (req, res, next) => roadController.getTollRoads(req, res, next));

// POST /api/roads/sync-toll (SUPERADMIN ONLY)
router.post(
  "/sync-toll",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res, next) => roadController.syncTollRoads(req, res, next)
);

export default router;
