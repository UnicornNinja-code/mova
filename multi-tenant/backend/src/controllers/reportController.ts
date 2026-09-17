/*
 * reportController.ts
 * HTTP Controller for Management & Operational Reports in MOVA
 */

import type { Request, Response } from "express";
import { reportService } from "../services/reportService.js";

export const getRiderOperationalReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { start_date, end_date, rider_id } = req.query as any;
    const data = await reportService.getRiderOperationalReport({
      startDate: start_date,
      endDate: end_date,
      riderId: rider_id,
    });
    return res.status(200).json({ status: "success", data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: "error", message: err.message });
  }
};

export const getZoneEffectivenessReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { start_date, end_date, zone_id } = req.query as any;
    const data = await reportService.getZoneEffectivenessReport({
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
    });
    return res.status(200).json({ status: "success", data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: "error", message: err.message });
  }
};

export const getFleetReport = async (_req: Request, res: Response): Promise<any> => {
  try {
    const data = await reportService.getFleetReport();
    return res.status(200).json({ status: "success", data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: "error", message: err.message });
  }
};

export const getDssAccuracyReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { start_date, end_date } = req.query as any;
    const data = await reportService.getDssAccuracyReport({
      startDate: start_date,
      endDate: end_date,
    });
    return res.status(200).json({ status: "success", data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: "error", message: err.message });
  }
};

export const getExecutiveSummary = async (_req: Request, res: Response): Promise<any> => {
  try {
    const data = await reportService.getExecutiveSummary();
    return res.status(200).json({ status: "success", data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: "error", message: err.message });
  }
};
