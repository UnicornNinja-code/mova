import express from "express";
import {
  getZoneWeatherInfo,
  getZoneWeatherTimeline,
  getZoneC4Score,
  getHubWeatherInfo,
  syncWeather,
} from "../controllers/weatherController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get("/zone/:zone_id", authenticateToken, getZoneWeatherInfo);
router.get("/zones/:zone_id", authenticateToken, getZoneWeatherInfo);
router.get("/zone/:zone_id/timeline", authenticateToken, getZoneWeatherTimeline);
router.get("/zones/:zone_id/timeline", authenticateToken, getZoneWeatherTimeline);
router.get("/zone/:zone_id/c4", authenticateToken, getZoneC4Score);
router.get("/zones/:zone_id/c4", authenticateToken, getZoneC4Score);
router.get("/hub/:city_name", authenticateToken, getHubWeatherInfo);
router.get("/current", authenticateToken, (req, res, next) => {
  req.params.city_name = req.query.city || "Sidoarjo";
  return getHubWeatherInfo(req, res, next);
});
router.get("/zone/:zone_id/score", authenticateToken, getZoneWeatherInfo);
router.post("/sync", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), syncWeather);

export default router;
