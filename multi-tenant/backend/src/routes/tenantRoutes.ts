/*
 * tenantRoutes.ts
 * Express Router for Multi-Tenant Management
 */

import { Router } from "express";
import {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenantQuota,
  updateTenantStatus,
} from "../controllers/tenantController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const router = Router();

// Superadmin routes for Tenant Lifecycle
router.get("/", authenticateToken, roleMiddleware(["SUPERADMIN"]), getAllTenants);
router.get("/:id", authenticateToken, roleMiddleware(["SUPERADMIN"]), getTenantById);
router.post("/", authenticateToken, roleMiddleware(["SUPERADMIN"]), createTenant);
router.patch("/:id/quota", authenticateToken, roleMiddleware(["SUPERADMIN"]), updateTenantQuota);
router.patch("/:id/status", authenticateToken, roleMiddleware(["SUPERADMIN"]), updateTenantStatus);

export default router;
