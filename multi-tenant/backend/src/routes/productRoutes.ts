/*
 * productRoutes.ts
 * API Routes for Product Catalog Management in TypeScript
 */

import express from "express";
import {
  getProducts,
  getProductById,
  uploadProductImage,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
} from "../controllers/productController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { uploadSingleImage } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// 1. Fetch Product Catalog (ALL authenticated roles)
router.get("/", authenticateToken, getProducts);

// 2. Upload Product Image with automatic WebP compression (SUPERADMIN, MANAGEMENT)
router.post(
  "/upload-image",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  uploadSingleImage,
  uploadProductImage
);

// 3. Fetch Single Product Detail (ALL authenticated roles)
router.get("/:id", authenticateToken, getProductById);

// 4. Create New Product (SUPERADMIN, MANAGEMENT)
router.post(
  "/",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  createProduct
);

// 5. Update Existing Product (SUPERADMIN, MANAGEMENT)
router.put(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  updateProduct
);

// 6. Toggle Product Status (SUPERADMIN, MANAGEMENT)
router.patch(
  "/:id/status",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  updateProductStatus
);

// 7. Delete Product with Historical Sales Guard (SUPERADMIN, MANAGEMENT)
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  deleteProduct
);

export default router;
