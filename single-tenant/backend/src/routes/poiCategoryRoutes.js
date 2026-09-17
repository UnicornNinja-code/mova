import express from "express";
import {
    getAllPoiCategories,
    togglePoiCategoryStatus,
    getCrowdScores,
    updateBulkCrowdScores,
    updateSingleCrowdScores,
    updatePoiCategoryTimeScores,
    bulkUpdatePoiCategoryTimeScores,
} from "../controllers/poiCategoryController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Standard B-09 C3 Time-Based Crowd Score Management
router.get("/crowd-scores", getCrowdScores);
router.put("/crowd-scores", authenticateToken, checkRole(["SUPERADMIN"]), updateBulkCrowdScores);
router.put("/:id/crowd-scores", authenticateToken, checkRole(["SUPERADMIN"]), updateSingleCrowdScores);

// Category List & Status Management
router.get("/", getAllPoiCategories);
router.put("/:id/toggle", authenticateToken, checkRole(["SUPERADMIN"]), togglePoiCategoryStatus);

// Legacy C3 Time Score Endpoints (Backwards Compatibility)
router.put("/:id/time-scores", authenticateToken, checkRole(["SUPERADMIN"]), updatePoiCategoryTimeScores);
router.post("/time-scores/bulk", authenticateToken, checkRole(["SUPERADMIN"]), bulkUpdatePoiCategoryTimeScores);

export default router;



