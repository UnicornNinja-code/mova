/*
 * CandidateSellingLocationRoutes.js
 * Express router for Candidate Selling Locations REST API
 */

import { Router } from "express";
import { candidateSellingLocationController } from "../controllers/candidateSellingLocationController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// Apply Auth Guard Middleware
router.use(authenticateToken);

// REST API Endpoints
router.post(
  "/",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.createCandidate(req, res, next)
);
router.get("/all", (req, res, next) => candidateSellingLocationController.getCandidatesByZone(req, res, next));
router.get("/zone/:zoneId", (req, res, next) => candidateSellingLocationController.getCandidatesByZone(req, res, next));
router.get("/:id", (req, res, next) => candidateSellingLocationController.getCandidateById(req, res, next));
router.post(
  "/generate/:zoneId",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.generateCandidatesFromZonePois(req, res, next)
);
router.post(
  "/generate/zone/:zoneId",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.generateCandidatesFromZonePois(req, res, next)
);

// Candidate DSS Evaluation & TOPSIS Ranking Endpoints
router.post(
  "/:id/evaluate",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.evaluateCandidate(req, res, next)
);
router.post(
  "/evaluate/zone/:zoneId",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.evaluateZoneCandidates(req, res, next)
);

// Phase 8 Audit Trail & Snapshot Endpoints (Read-Only)
router.get("/evaluation/:evaluationId", (req, res, next) => candidateSellingLocationController.getEvaluationSnapshot(req, res, next));
router.get("/evaluation/:evaluationId/explanation", (req, res, next) => candidateSellingLocationController.getEvaluationExplanation(req, res, next));
router.get("/evaluation/:evaluationId/audit", (req, res, next) => candidateSellingLocationController.getEvaluationAudit(req, res, next));

export default router;
