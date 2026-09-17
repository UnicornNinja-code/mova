/*
 * riderOperationalRoutes.ts
 * API Routes for Rider Daily Operations in TypeScript
 */

import express from "express";
import {
  getActiveSession,
  getHubArmadas,
  holdArmada,
  cancelHoldArmada,
  confirmClaimArmada,
  checkInZone,
  recordSale,
  getMySales,
  checkoutSession,
} from "../controllers/riderOperationalController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 1. Fetch rider active operational session
router.get("/active-session", authenticateToken, getActiveSession);

// 2. Fetch all armadas in Hub with claimable / faded_out flags for UI rendering
router.get("/hub-armadas", authenticateToken, getHubArmadas);

// 3. Inspect & Hold Armada Unit (Ticket-Booking Lock: 5-minute temporary hold)
router.post("/hold-armada", authenticateToken, holdArmada);

// 4. Cancel Armada Hold (Back out from armada inspection screen)
router.post("/cancel-hold-armada", authenticateToken, cancelHoldArmada);

// 5. Confirm Permanent Armada Claim (Status IN_USE)
router.post("/claim-armada", authenticateToken, confirmClaimArmada);

// 6. PostGIS Spatial GPS Check-in to assigned zone polygon
router.post("/check-in", authenticateToken, checkInZone);

// 7. Record daily product sale log
router.post("/record-sale", authenticateToken, recordSale);

// 8. Fetch personal sales history
router.get("/my-sales", authenticateToken, getMySales);

// 9. Checkout operational session & return armada unit to Hub
router.post("/checkout", authenticateToken, checkoutSession);

export default router;
