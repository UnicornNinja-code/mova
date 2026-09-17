/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   productRoutes.js (API Routes for Product Catalog Management)
 */

import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
} from "../controllers/productController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Fetch Product Catalog (ALL authenticated roles; Rider default to AVAILABLE)
router.get("/", authenticateToken, getProducts);

// 2. Fetch Single Product Detail (ALL authenticated roles)
router.get("/:id", authenticateToken, getProductById);

// 3. Create New Product (SUPERADMIN, MANAGEMENT)
router.post(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  createProduct
);

// 4. Update Existing Product (SUPERADMIN, MANAGEMENT)
router.put(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  updateProduct
);

// 5. Toggle Product Status (SUPERADMIN, MANAGEMENT)
router.patch(
  "/:id/status",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  updateProductStatus
);

// 6. Delete Product with Historical Sales Guard (SUPERADMIN, MANAGEMENT)
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  deleteProduct
);

export default router;
