/*
 * candidateSellingLocationRoutes.ts
 * Express router for Candidate Selling Locations REST API in TypeScript
 */

import { Router } from "express";
import { candidateSellingLocationController } from "../controllers/candidateSellingLocationController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateToken);

router.post(
  "/",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.createCandidate(req, res, next)
);
router.get("/zone/:zoneId", (req, res, next) => candidateSellingLocationController.getCandidatesByZone(req, res, next));
router.get("/:id", (req, res, next) => candidateSellingLocationController.getCandidateById(req, res, next));
router.post(
  "/generate/zone/:zoneId",
  checkRole(["SUPERADMIN", "SUPERVISOR"]),
  (req, res, next) => candidateSellingLocationController.generateCandidatesFromZonePois(req, res, next)
);

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

router.get("/evaluation/:evaluationId", (req, res, next) => candidateSellingLocationController.getEvaluationSnapshot(req, res, next));
router.get("/evaluation/:evaluationId/explanation", (req, res, next) => candidateSellingLocationController.getEvaluationExplanation(req, res, next));
router.get("/evaluation/:evaluationId/audit", (req, res, next) => candidateSellingLocationController.getEvaluationAudit(req, res, next));

export default router;
