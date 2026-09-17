/*
 * dataSyncRoutes.ts
 *
 * REST API Routes for Spatial Data Synchronization, Job Polling & Rollbacks
 * Protected by JWT Authentication and Role-Based Access Control (SUPERADMIN Only)
 */

import { Router } from "express";
import { dataSyncController } from "../controllers/dataSyncController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// 1. Trigger background sync job (asynchronous via BullMQ)
router.post(
  "/trigger",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res) => dataSyncController.triggerSync(req, res)
);

// 2. Poll job status and progress
router.get(
  "/jobs/:jobId",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res) => dataSyncController.getJobStatus(req, res)
);

// 3. View version history (ACTIVE, RETIRED, STAGING, FAILED)
router.get(
  "/versions/:datasetType",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res) => dataSyncController.getVersions(req, res)
);

// 4. Perform atomic rollback to a historical version
router.post(
  "/rollback",
  authenticateToken,
  checkRole(["SUPERADMIN"]),
  (req, res) => dataSyncController.rollback(req, res)
);

export default router;
