import { operationalRuleService } from "../services/operationalRuleService.js";
import { systemReadinessService } from "../services/systemReadinessService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

const BASEMAP_PROVIDERS = [
  {
    id: "osm-standard",
    name: "OpenStreetMap Standard (Free & Ringan)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    subdomains: ["a", "b", "c"],
    is_default: true,
    is_free: true,
  },
  {
    id: "openmaptiles-streets",
    name: "OpenMapTiles Streets (Jalan & Bangunan)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    is_default: false,
    is_free: true,
  },
  {
    id: "openmaptiles-dark",
    name: "OpenMapTiles Dark (Kontras Gelap)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    is_default: false,
    is_free: true,
  },
  {
    id: "openmaptiles-satellite",
    name: "OpenMapTiles Satellite (Citra Satelit Hybrid)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    is_default: false,
    is_free: true,
  },
  {
    id: "openmaptiles-outdoor",
    name: "OpenMapTiles Outdoor (Topografi & Kontur)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    is_default: false,
    is_free: true,
  },
  {
    id: "esri-topographic",
    name: "Esri World Topographic (Topografi Komprehensif)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    is_default: false,
    is_free: true,
  },
];

export class SystemSettingController {
  async getOperationalRules(req, res) {
    try {
      const rules = await operationalRuleService.getOperationalRules();
      return sendSuccess(res, rules, "Operational rules retrieved successfully");
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async updateOperationalRules(req, res) {
    try {
      const { protocol_road_prohibited, toll_road_prohibited } = req.body;
      const user = req.user || {};

      const result = await operationalRuleService.updateOperationalRules(
        { protocol_road_prohibited, toll_road_prohibited },
        user
      );

      return sendSuccess(res, result.data || result, result.msg || "Operational rules updated");
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async getSystemReadiness(req, res) {
    try {
      const report = await systemReadinessService.evaluateSystemReadiness();
      return sendSuccess(res, report, "System readiness evaluated successfully");
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async getHubConfig(req, res) {
    try {
      const report = await systemReadinessService.evaluateSystemReadiness();
      return sendSuccess(res, report.hub_config, "Central Hub config retrieved successfully");
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async updateHubConfig(req, res) {
    try {
      const user = req.user || {};
      const updatedReport = await systemReadinessService.updateHubConfig(req.body, user);
      return sendSuccess(
        res,
        updatedReport.hub_config,
        "Konfigurasi Central Hub & parameter spasial berhasil diperbarui.",
        200,
        { report: updatedReport }
      );
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async getMapConfig(req, res) {
    try {
      return sendSuccess(
        res,
        {
          default_basemap_id: "osm-standard",
          default_buffer_meters: 50,
          providers: BASEMAP_PROVIDERS,
        },
        "Map config retrieved successfully"
      );
    } catch (error) {
      return handleControllerError(res, error);
    }
  }
}

export const systemSettingController = new SystemSettingController();
