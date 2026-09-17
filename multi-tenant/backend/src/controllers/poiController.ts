/*
 * poiController.ts
 * HTTP Controller for POI Operations in TypeScript
 */

import type { Request, Response } from "express";
import {
  syncCityPoisService,
  reprocessLocalPoisService,
  getPoisByZoneService,
  getAllOperationalPoisService,
  getDensitasDanDiversitasC1C2Service,
  reclusterExistingPoisService,
  getLeakageReportService,
  getPendingPoisService,
  approveOrRejectPoiService,
  getApprovalLogsService,
  triggerCronDetectionService,
  getZoneC3ScoreService,
  getZoneC4ScoreService,
  getZoneC5ScoreService,
} from "../services/poiService.js";
import { enqueuePoiSyncJob } from "../queues/overpassQueue.js";

export const syncCityPois = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id || null;
    const requestedCity = (req.body?.city_name || req.query?.city_name) as string | undefined;
    const result = await enqueuePoiSyncJob({ userId, cityName: requestedCity || null });
    return res.status(202).json({
      status: "accepted",
      job_id: result.jobId,
      city_name: result.cityName,
      msg: `Sinkronisasi POI Overpass untuk '${result.cityName}' berhasil dijadwalkan ke antrean latar belakang (BullMQ).`,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const reprocessLocalPois = async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await reprocessLocalPoisService();
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getPoisByZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const pois = await getPoisByZoneService(zone_id);
    return res.status(200).json({ pois, count: pois.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getOperationalAreaPois = async (req: Request, res: Response): Promise<any> => {
  try {
    const hubCity = (req.query?.hub_id || req.query?.city_name) as string | undefined;
    const pois = await getAllOperationalPoisService(hubCity || null);
    const { ZoneModel } = await import("../models/zoneModel.js");
    const zones = await ZoneModel.findAll();
    return res.status(200).json({
      pois,
      count: pois.length,
      zones: zones || [],
      hub_id: hubCity || null,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getDensitasDanDiversitasC1C2 = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const result = await getDensitasDanDiversitasC1C2Service(zone_id);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneC3Score = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const { time } = req.query as { time?: string };
    const result = await getZoneC3ScoreService(zone_id, time);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneC4Score = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const { time } = req.query as { time?: string };
    const result = await getZoneC4ScoreService(zone_id, time);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneC5Score = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const { lat, lon } = req.query as { lat?: string; lon?: string };
    const result = await getZoneC5ScoreService(zone_id, parseFloat(lat || "0"), parseFloat(lon || "0"));
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const reclusterPois = async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await reclusterExistingPoisService();
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getLeakageReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const report = await getLeakageReportService();
    return res.status(200).json({ report, count: report.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getPendingPois = async (req: Request, res: Response): Promise<any> => {
  try {
    const pendingPois = await getPendingPoisService();
    return res.status(200).json({ pois: pendingPois, count: pendingPois.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const approveOrRejectPoi = async (req: Request, res: Response): Promise<any> => {
  try {
    const { poi_id, status, notes } = req.body;
    const userId = req.user?.id || (req.user as any)?.userId;
    const result = await approveOrRejectPoiService(poi_id, status, userId, notes);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getApprovalLogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const logs = await getApprovalLogsService();
    return res.status(200).json({ logs, count: logs.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const triggerCronDetection = async (req: Request, res: Response): Promise<any> => {
  try {
    const { hub_city } = req.body || {};
    const result = await triggerCronDetectionService(hub_city);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
