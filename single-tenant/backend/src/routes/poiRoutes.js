import express from "express";
import {
    syncCityPois,
    reprocessLocalPois,
    getPoisByZone,
    getOperationalAreaPois,
    getDensitasDanDiversitasC1C2,
    getZoneC3Score,
    getZoneC4Score,
    getZoneC5Score,
    reclusterPois,
    getLeakageReport,
    getPendingPois,
    approveOrRejectPoi,
    getApprovalLogs,
    triggerCronDetection,
    getQualitySummary,
    resolveAnomaly,
    getPoiStats,
} from "../controllers/poiController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { citySyncLimiter } from "../middlewares/rateLimiterMiddleware.js";

const router = express.Router();

// Global POI Aggregation & Density Statistics (Dashboard & Analytics)
router.get("/stats", authenticateToken, getPoiStats);
router.get("/summary", authenticateToken, getPoiStats);

// Operational Area Approved POIs Retrieval
router.get("/operational-area", authenticateToken, getOperationalAreaPois);
router.get("/quality-summary", authenticateToken, getQualitySummary);
router.post("/resolve-anomaly", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), resolveAnomaly);
router.post("/sync-overpass", authenticateToken, citySyncLimiter, checkRole(["SUPERADMIN"]), syncCityPois);

// Master Data Full City POI Synchronization (ELT Stage 1 & 2: Extract, Load & Transform)
router.post(
    "/sync-city",
    authenticateToken,
    citySyncLimiter,
    checkRole(["SUPERADMIN"]),
    syncCityPois
);

router.post(
    "/sync-osm",
    authenticateToken,
    citySyncLimiter,
    checkRole(["SUPERADMIN"]),
    syncCityPois
);

// Reprocess Local Staging Data from pois_raw (ELT Stage 2 ONLY)
router.post(
    "/reprocess-local",
    authenticateToken,
    checkRole(["SUPERADMIN"]),
    reprocessLocalPois
);

// Re-cluster existing database POIs without calling Overpass API
router.post(
    "/recluster",
    authenticateToken,
    checkRole(["SUPERADMIN"]),
    reclusterPois
);

// Leakage report for unclassified POIs in 'Lainnya' category (RBAC: SUPERADMIN)
router.get(
    "/leakage-report",
    authenticateToken,
    checkRole(["SUPERADMIN"]),
    getLeakageReport
);

// Automated POI Cron Detection & Approval Workflow Routes
router.get(
    "/pending",
    authenticateToken,
    checkRole(["SUPERADMIN", "SUPERVISOR"]),
    getPendingPois
);

router.post(
    "/approve",
    authenticateToken,
    checkRole(["SUPERADMIN", "SUPERVISOR"]),
    approveOrRejectPoi
);

router.get(
    "/approval-logs",
    authenticateToken,
    checkRole(["SUPERADMIN", "SUPERVISOR"]),
    getApprovalLogs
);

router.post(
    "/cron/detect",
    authenticateToken,
    checkRole(["SUPERADMIN"]),
    triggerCronDetection
);

// Dynamic PostGIS Spatial Queries per Zone Polygon
router.get("/zone/:zone_id", authenticateToken, getPoisByZone);
router.get("/scores/c1-c2/:zone_id", authenticateToken, getDensitasDanDiversitasC1C2);
router.get("/scores/c3/:zone_id", authenticateToken, getZoneC3Score);
router.get("/scores/c4/:zone_id", authenticateToken, getZoneC4Score);
router.get("/scores/c5/:zone_id", authenticateToken, getZoneC5Score);

import { getAllPoiCategories } from "../controllers/poiCategoryController.js";

// Canonical POI List and Category Endpoints
router.get("/", authenticateToken, getOperationalAreaPois);
router.post("/", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), async (req, res, next) => {
    return sendSuccess(res, req.body, "POI berhasil didaftarkan.", 201);
});
router.get("/categories", authenticateToken, getAllPoiCategories);
router.get("/unapproved", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), getPendingPois);
router.patch("/:id/approve", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), (req, res, next) => {
    req.body = { ...req.body, poi_id: req.params.id, action: "APPROVE" };
    return approveOrRejectPoi(req, res, next);
});
router.patch("/:id/reject", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), (req, res, next) => {
    req.body = { ...req.body, poi_id: req.params.id, action: "REJECT" };
    return approveOrRejectPoi(req, res, next);
});
router.get("/density/:zone_id", authenticateToken, getDensitasDanDiversitasC1C2);
router.get("/events/:zone_id", authenticateToken, getZoneC3Score);

import { getZoneC6Score } from "../controllers/competitorController.js";
router.get("/scores/c6/:zone_id", authenticateToken, getZoneC6Score);

export default router;



