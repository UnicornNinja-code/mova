import express from "express";
import {
  getRiderOperationalReport,
  getZoneEffectivenessReport,
  getFleetReport,
  getDssAccuracyReport,
  getExecutiveSummary,
} from "../controllers/reportController.js";
import { ReportExportController } from "../controllers/reportExportController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.use(authenticateToken);
router.use(checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]));

// 1. Legacy Static Report Endpoints (Preserved for compatibility)
router.get("/riders", getRiderOperationalReport);
router.get("/zones/effectiveness", getZoneEffectivenessReport);
router.get("/fleet", getFleetReport);
router.get("/dss/accuracy", getDssAccuracyReport);
router.get("/executive-summary", getExecutiveSummary);

// 2. S7-05 Asynchronous Operational Reporting & Export Engine Endpoints
router.post("/export", ReportExportController.createExportJob);
router.get("/export", ReportExportController.listExportJobs);
router.get("/export/:id", ReportExportController.getExportJobStatus);
router.get("/export/:id/download", ReportExportController.downloadArtifact);

export default router;

