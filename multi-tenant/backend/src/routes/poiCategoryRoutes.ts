/*
 * poiCategoryRoutes.ts
 * API Routes for POI Category Management in TypeScript
 */

import express from "express";
import {
  getAllPoiCategories,
  togglePoiCategoryStatus,
  updatePoiCategoryTimeScores,
  bulkUpdatePoiCategoryTimeScores,
} from "../controllers/poiCategoryController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get("/", getAllPoiCategories);
router.put("/:id/toggle", authenticateToken, checkRole(["SUPERADMIN"]), togglePoiCategoryStatus);

// C3 Time-Based Crowd Score Management
router.put("/:id/time-scores", authenticateToken, checkRole(["SUPERADMIN"]), updatePoiCategoryTimeScores);
router.post("/time-scores/bulk", authenticateToken, checkRole(["SUPERADMIN"]), bulkUpdatePoiCategoryTimeScores);

export default router;
