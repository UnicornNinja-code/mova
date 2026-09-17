/*
 * weatherRoutes.ts
 * Express routes for Weather Information Widget in TypeScript
 */

import express from "express";
import {
  getZoneWeatherInfo,
  getHubWeatherInfo,
  syncWeather,
} from "../controllers/weatherController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get("/zone/:zone_id", authenticateToken, getZoneWeatherInfo);
router.get("/hub/:city_name", authenticateToken, getHubWeatherInfo);
router.post("/sync", authenticateToken, checkRole(["SUPERADMIN", "SUPERVISOR"]), syncWeather);

export default router;
