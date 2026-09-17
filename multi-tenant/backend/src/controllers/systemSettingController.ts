/*
 * systemSettingController.ts
 * HTTP Controller for System Readiness, Central Hub & Operational Settings in TypeScript
 */

import type { Request, Response, NextFunction } from "express";
import { systemReadinessService } from "../services/system/systemReadinessService.js";
import { operationalRuleService } from "../services/operationalRuleService.js";
import { auditLogger } from "../utils/AuditLogger.js";

export const getSystemReadiness = async (req: Request, res: Response): Promise<any> => {
  try {
    const report = await systemReadinessService.evaluateSystemReadiness();
    return res.status(200).json(report);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateSystemSettings = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      hub_name,
      hub_city_name,
      hub_address,
      hub_latitude,
      hub_longitude,
      operational_radius_km,
      protocol_road_prohibited,
      toll_road_prohibited,
    } = req.body;

    const report = await systemReadinessService.updateSystemSettings({
      hub_name,
      hub_city_name,
      hub_address,
      hub_latitude: hub_latitude !== undefined ? parseFloat(hub_latitude) : undefined,
      hub_longitude: hub_longitude !== undefined ? parseFloat(hub_longitude) : undefined,
      operational_radius_km: operational_radius_km !== undefined ? parseFloat(operational_radius_km) : undefined,
      protocol_road_prohibited: protocol_road_prohibited !== undefined ? Boolean(protocol_road_prohibited) : undefined,
      toll_road_prohibited: toll_road_prohibited !== undefined ? Boolean(toll_road_prohibited) : undefined,
    });

    operationalContextService.invalidateCache();

    await auditLogger.logAction({
      userId: req.user?.id,
      action: "SYSTEM_SETTINGS_UPDATED",
      entityType: "SYSTEM_SETTINGS",
      details: {
        hub_name,
        hub_address,
        hub_latitude,
        hub_longitude,
        operational_radius_km,
        protocol_road_prohibited,
        toll_road_prohibited,
      },
    });

    return res.status(200).json({
      msg: "Konfigurasi operasional Central Hub & jangkauan berhasil disimpan.",
      report,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

import { SystemSettingModel } from "../models/systemSettingModel.js";
import { operationalContextService } from "../services/spatial/OperationalContextService.js";

export const getSetupStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const state = await SystemSettingModel.getInitializationState();
    return res.status(200).json(state);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memuat status inisialisasi sistem." });
  }
};

import { armadaService } from "../services/armadaService.js";

export const saveSetupStep = async (req: Request, res: Response): Promise<any> => {
  try {
    const { step_id, data } = req.body;
    if (step_id) {
      await SystemSettingModel.upsert("SYSTEM_SETUP_CURRENT_STEP", String(step_id), "Tahapan Wizard Setup");
    }

    if (data && typeof data === "object") {
      if (data.business_name || data.system_name) {
        const name = String(data.business_name || data.system_name).trim();
        await SystemSettingModel.upsert("SYSTEM_NAME", name);
        await SystemSettingModel.upsert("BUSINESS_NAME", name);
      }
      if (data.hub_city_name !== undefined && data.hub_city_name !== null) {
        await SystemSettingModel.upsert("HUB_CITY_NAME", String(data.hub_city_name).trim());
      }
      if (data.central_hub_name !== undefined && data.central_hub_name !== null) {
        await SystemSettingModel.upsert("CENTRAL_HUB_NAME", String(data.central_hub_name).trim());
      }
      if (data.central_hub_address !== undefined && data.central_hub_address !== null) {
        await SystemSettingModel.upsert("CENTRAL_HUB_ADDRESS", String(data.central_hub_address).trim());
      }
      if (data.central_hub_lat !== undefined && data.central_hub_lat !== null && !isNaN(Number(data.central_hub_lat))) {
        await SystemSettingModel.upsert("CENTRAL_HUB_LAT", String(data.central_hub_lat));
        await SystemSettingModel.upsert("HUB_LATITUDE", String(data.central_hub_lat));
      }
      if (data.central_hub_lng !== undefined && data.central_hub_lng !== null && !isNaN(Number(data.central_hub_lng))) {
        await SystemSettingModel.upsert("CENTRAL_HUB_LNG", String(data.central_hub_lng));
        await SystemSettingModel.upsert("HUB_LONGITUDE", String(data.central_hub_lng));
      }
      if (data.operational_radius_km !== undefined && !isNaN(Number(data.operational_radius_km))) {
        await SystemSettingModel.upsert("OPERATIONAL_RADIUS_KM", String(data.operational_radius_km));
      }
      if (data.operating_hours_start) await SystemSettingModel.upsert("OPERATING_HOURS_START", String(data.operating_hours_start));
      if (data.operating_hours_end) await SystemSettingModel.upsert("OPERATING_HOURS_END", String(data.operating_hours_end));
      if (data.timezone) await SystemSettingModel.upsert("SYSTEM_TIMEZONE", String(data.timezone));
      if (data.default_basemap) await SystemSettingModel.upsert("DEFAULT_BASEMAP", String(data.default_basemap));
      if (data.default_zoom !== undefined && !isNaN(Number(data.default_zoom))) {
        await SystemSettingModel.upsert("DEFAULT_ZOOM", String(data.default_zoom));
      }
      if (data.show_hub_radius !== undefined) await SystemSettingModel.upsert("SHOW_HUB_RADIUS", String(data.show_hub_radius));
      if (data.show_protocol_roads !== undefined) await SystemSettingModel.upsert("SHOW_PROTOCOL_ROADS", String(data.show_protocol_roads));
      if (data.show_poi !== undefined) await SystemSettingModel.upsert("SHOW_POI", String(data.show_poi));
      if (data.show_weather !== undefined) await SystemSettingModel.upsert("SHOW_WEATHER", String(data.show_weather));

      operationalContextService.invalidateCache();
    }

    return res.status(200).json({ success: true, msg: "Data tahapan setup berhasil disimpan." });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal menyimpan tahapan setup." });
  }
};

import { syncAllZonesWeatherService } from "../services/poiService.js";

export const applySystemSetup = async (req: Request, res: Response): Promise<any> => {
  try {
    const payload = req.body || {};
    const userId = (req as any).user?.id;

    // 1. Persist master system settings & mark SYSTEM_INITIALIZED
    await SystemSettingModel.completeSystemInitialization(payload, userId);
    operationalContextService.invalidateCache();

    // 2. Persist initial fleet units if supplied
    if (Array.isArray(payload.initial_fleets) && payload.initial_fleets.length > 0) {
      for (const fleet of payload.initial_fleets) {
        if (fleet.code) {
          try {
            await armadaService.createArmada(
              {
                code: fleet.code.trim().toUpperCase(),
                name: fleet.name || `Armada ${fleet.code.trim().toUpperCase()}`,
                type: fleet.type || "MOTOR",
                status: fleet.status || "ACTIVE",
              },
              (req as any).user
            );
          } catch (fleetErr: any) {
            console.warn(`[SystemSetup] Lewati armada '${fleet.code}' (mungkin sudah terdaftar):`, fleetErr.message);
          }
        }
      }
    }

    // 3. Initial Weather and POI sync pulled at onboarding completion loading state
    try {
      await syncAllZonesWeatherService();
    } catch (weatherErr: any) {
      console.warn("[SystemSetup] Cuaca awal akan diperbarui saat masuk dashboard:", weatherErr.message);
    }

    await auditLogger.logAction({
      userId,
      action: "SYSTEM_INITIALIZATION_COMPLETED",
      entityType: "SYSTEM",
      details: {
        system_name: payload.business_name || payload.system_name || "MOVA",
        hub_city_name: payload.hub_city_name || "",
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      success: true,
      msg: "Inisialisasi sistem berhasil diterapkan! Lingkungan operasional MOVA siap digunakan.",
      status: "COMPLETED",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal menerapkan inisialisasi sistem." });
  }
};

import {
  enqueueSpatialOnboardingFlow,
  retryPartialDatasetJob,
  abortSpatialSyncFlow,
  getJobStatus,
} from "../queues/overpassQueue.js";
import { datasetVersionRepository } from "../repositories/datasetVersionRepository.js";
import { datasetSyncJobRepository } from "../repositories/datasetSyncJobRepository.js";

export const startSpatialSyncFlow = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const fsmRecord = await SystemSettingModel.getByKey("SYSTEM_SETUP_FSM_STATE");
    const currentState = fsmRecord?.value || "DRAFT";
    if (currentState === "LOCKED_SYNCING") {
      return res.status(409).json({
        msg: "Sinkronisasi spasial sedang berlangsung. Harap tunggu hingga selesai atau batalkan proses aktif.",
        state: currentState,
      });
    }

    // Transition to LOCKED_SYNCING state
    await SystemSettingModel.upsert("SYSTEM_SETUP_FSM_STATE", "LOCKED_SYNCING", "FSM State Setup Wizard");

    const flowResult = await enqueueSpatialOnboardingFlow({
      userId,
    });

    await auditLogger.logAction({
      userId,
      action: "SPATIAL_SYNC_FLOW_STARTED",
      entityType: "SYSTEM",
      details: flowResult,
    });

    return res.status(200).json({
      success: true,
      msg: "Alur sinkronisasi spasial terdistribusi (FlowProducer) berhasil dimulai.",
      ...flowResult,
    });
  } catch (error: any) {
    // Rollback FSM state to DRAFT on immediate dispatch error
    await SystemSettingModel.upsert("SYSTEM_SETUP_FSM_STATE", "DRAFT", "FSM State Setup Wizard");
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memulai sinkronisasi spasial." });
  }
};

export const retryPartialSpatialSync = async (req: Request, res: Response): Promise<any> => {
  try {
    const { dataset_type } = req.body;
    const userId = (req as any).user?.id;

    if (!dataset_type || !["TOLL_ROADS", "PROTOCOL_ROADS", "POI"].includes(dataset_type)) {
      return res.status(400).json({ msg: "Parameter 'dataset_type' harus salah satu dari: TOLL_ROADS, PROTOCOL_ROADS, POI." });
    }

    await SystemSettingModel.upsert("SYSTEM_SETUP_FSM_STATE", "LOCKED_SYNCING", "FSM State Setup Wizard");
    const retryResult = await retryPartialDatasetJob(dataset_type, { userId });

    await auditLogger.logAction({
      userId,
      action: "SPATIAL_SYNC_PARTIAL_RETRY",
      entityType: "SYSTEM",
      details: { dataset_type, result: retryResult },
    });

    return res.status(200).json({
      success: true,
      msg: `Retry parsial dataset '${dataset_type}' berhasil dimasukkan ke antrean.`,
      result: retryResult,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal melakukan retry parsial." });
  }
};

export const abortSpatialSync = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    await abortSpatialSyncFlow();
    await SystemSettingModel.upsert("SYSTEM_SETUP_FSM_STATE", "DRAFT", "FSM State Setup Wizard");

    await auditLogger.logAction({
      userId,
      action: "SPATIAL_SYNC_ABORTED_BY_USER",
      entityType: "SYSTEM",
      details: { timestamp: new Date().toISOString() },
    });

    return res.status(200).json({
      success: true,
      msg: "Sinyal pembatalan sinkronisasi berhasil dikirim. State sistem dikembalikan ke DRAFT.",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal membatalkan sinkronisasi." });
  }
};

export const getSpatialSyncStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const fsmRecord = await SystemSettingModel.getByKey("SYSTEM_SETUP_FSM_STATE");
    const fsmState = fsmRecord?.value || "DRAFT";
    const tollActive = await datasetVersionRepository.findActiveVersion("TOLL_ROADS");
    const roadsActive = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
    const poiActive = await datasetVersionRepository.findActiveVersion("POI");

    const recentJobs = await datasetSyncJobRepository.findRecentJobs(10);

    return res.status(200).json({
      fsmState,
      datasets: {
        toll_roads: {
          active: !!tollActive,
          version: tollActive?.version || null,
          feature_count: tollActive?.feature_count || 0,
          updated_at: tollActive?.created_at || null,
        },
        protocol_roads: {
          active: !!roadsActive,
          version: roadsActive?.version || null,
          feature_count: roadsActive?.feature_count || 0,
          updated_at: roadsActive?.created_at || null,
        },
        poi: {
          active: !!poiActive,
          version: poiActive?.version || null,
          feature_count: poiActive?.feature_count || 0,
          updated_at: poiActive?.created_at || null,
        },
      },
      allReady: Boolean(tollActive && roadsActive && poiActive),
      recentJobs,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memuat status sinkronisasi spasial." });
  }
};

export const systemSettingController = {
  async getOperationalRules(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const data = await operationalRuleService.getOperationalRules();
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updateOperationalRules(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const result = await operationalRuleService.updateOperationalRules(req.body, req.user);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  },

  getSystemReadiness,
  updateSystemSettings,
  getSetupStatus,
  saveSetupStep,
  applySystemSetup,
  startSpatialSyncFlow,
  retryPartialSpatialSync,
  abortSpatialSync,
  getSpatialSyncStatus,
};

