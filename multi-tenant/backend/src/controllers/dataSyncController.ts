/*
 * dataSyncController.ts
 *
 * HTTP Controller for Spatial Dataset Synchronization, Jobs Monitoring & Rollback
 * Part of MOVA Single Source of Truth Spatial Pipeline.
 */

import type { Request, Response } from "express";
import {
  enqueuePoiSyncJob,
  enqueueTollSyncJob,
  enqueueProtocolRoadsSyncJob,
  getJobStatus as getQueueJobStatus,
} from "../queues/overpassQueue.js";
import { datasetVersionRepository } from "../repositories/datasetVersionRepository.js";
import { datasetSyncJobRepository } from "../repositories/datasetSyncJobRepository.js";
import { datasetPromotionService } from "../services/spatial/DatasetPromotionService.js";

export class DataSyncController {
  /**
   * POST /api/data-sync/trigger
   * Trigger Asynchronous Spatial Ingestion via BullMQ
   */
  public async triggerSync(req: Request, res: Response): Promise<any> {
    try {
      const { dataset_type, city_name, cities, bbox } = req.body;
      const normalizedType = String(dataset_type || "").toUpperCase().trim();
      const userId = (req as any).user?.id || null;

      if (!["POI", "TOLL_ROADS", "PROTOCOL_ROADS"].includes(normalizedType)) {
        return res.status(400).json({
          status: "error",
          msg: "Tipe dataset tidak valid. Pilihan yang didukung: 'POI', 'TOLL_ROADS', atau 'PROTOCOL_ROADS'.",
        });
      }

      let jobResult: any;
      if (normalizedType === "POI") {
        jobResult = await enqueuePoiSyncJob({
          cityName: city_name || null,
          userId,
          bbox,
        });
      } else if (normalizedType === "TOLL_ROADS") {
        jobResult = await enqueueTollSyncJob({
          userId,
          cities: Array.isArray(cities) ? cities : (city_name ? [city_name] : null),
          bbox,
        });
      } else {
        jobResult = await enqueueProtocolRoadsSyncJob({
          userId,
          cities: Array.isArray(cities) ? cities : (city_name ? [city_name] : null),
          bbox,
        });
      }

      return res.status(202).json({
        status: "accepted",
        job_id: jobResult.jobId,
        dataset_type: jobResult.datasetType,
        state: jobResult.status,
        msg: `Job sinkronisasi ${normalizedType} berhasil dijadwalkan ke antrean latar belakang.`,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        status: "error",
        code: error.code || "SYNC_TRIGGER_ERROR",
        msg: error.message || "Gagal memicu sinkronisasi spasial.",
      });
    }
  }

  /**
   * GET /api/data-sync/jobs/:jobId
   * Check status and progress of a background sync job
   */
  public async getJobStatus(req: Request, res: Response): Promise<any> {
    try {
      const jobId = req.params.jobId as string;
      const status = await getQueueJobStatus(jobId);

      if (!status) {
        return res.status(404).json({
          status: "error",
          msg: `Job ID '${jobId}' tidak ditemukan.`,
        });
      }

      return res.status(200).json({ status: "success", job: status });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        msg: error.message || "Gagal memeriksa status job.",
      });
    }
  }

  /**
   * GET /api/data-sync/versions/:datasetType
   * Fetch version history (ACTIVE, RETIRED, STAGING, FAILED)
   */
  public async getVersions(req: Request, res: Response): Promise<any> {
    try {
      const datasetType = (req.params.datasetType as string).toUpperCase().trim();
      const history = await datasetVersionRepository.findHistory(datasetType, 30);
      const active = await datasetVersionRepository.findActiveVersion(datasetType);

      return res.status(200).json({
        status: "success",
        dataset_type: datasetType,
        active_version: active?.version || null,
        total_versions: history.length,
        versions: history,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        msg: error.message || "Gagal memuat riwayat versi dataset.",
      });
    }
  }

  /**
   * POST /api/data-sync/rollback
   * Atomic rollback to historical RETIRED version
   */
  public async rollback(req: Request, res: Response): Promise<any> {
    try {
      const { version_id } = req.body;
      if (!version_id) {
        return res.status(400).json({
          status: "error",
          msg: "Parameter 'version_id' wajib disertakan.",
        });
      }

      const result = await datasetPromotionService.rollbackToVersion(version_id);
      return res.status(200).json({
        status: "success",
        message: result.message,
        promoted_version: result.version,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        status: "error",
        msg: error.message || "Gagal melakukan rollback versi.",
      });
    }
  }
}

export const dataSyncController = new DataSyncController();
