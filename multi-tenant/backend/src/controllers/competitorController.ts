/*
 * competitorController.ts
 * HTTP Request Handlers for Competitor Management & C6 Score in TypeScript
 */

import type { Request, Response } from "express";
import {
  getZoneC6ScoreService,
  getAllCompetitorsService,
  getCompetitorsByZoneService,
  createCompetitorService,
  deleteCompetitorService,
} from "../services/poiService.js";

export const getAllCompetitors = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.query.zone_id as string | undefined;
    const competitors = await getAllCompetitorsService(zone_id || null);
    return res.status(200).json({ competitors, count: competitors.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneC6Score = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const result = await getZoneC6ScoreService(zone_id);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getCompetitorsByZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const competitors = await getCompetitorsByZoneService(zone_id);
    return res.status(200).json({ competitors, count: competitors.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const createCompetitor = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = req.body;
    const competitor = await createCompetitorService(data);
    return res.status(201).json({ msg: "Data kompetitor berhasil ditambahkan", competitor });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const deleteCompetitor = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const result = await deleteCompetitorService(id);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
