/*
 * roadController.ts
 * Controller for Spatial Restriction Layer in TypeScript
 */

import type { Request, Response, NextFunction } from "express";
import { roadService } from "../services/roadService.js";
import { enqueueTollSyncJob } from "../queues/overpassQueue.js";

export class RoadController {
  public async getProtocolRoads(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const geojson = await roadService.getProtocolRoadsGeoJson();
      return res.status(200).json(geojson);
    } catch (error) {
      return next(error);
    }
  }

  public async getTollRoads(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const geojson = await roadService.getTollRoadsGeoJson();
      return res.status(200).json(geojson);
    } catch (error) {
      return next(error);
    }
  }

  public async syncTollRoads(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const userId = (req as any).user?.id || null;
      const result = await enqueueTollSyncJob({ userId });
      return res.status(202).json({
        status: "accepted",
        job_id: result.jobId,
        msg: "Sinkronisasi Jalan Tol Overpass berhasil dijadwalkan ke antrean latar belakang (BullMQ).",
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const roadController = new RoadController();
