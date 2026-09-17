/*
 * overpassWorker.ts
 *
 * BullMQ Worker Consumer for Overpass Pipeline in TypeScript
 * Executes the 11-stage Spatial ETL Pipeline with:
 * 1. Distributed Lock Ownership Lease & Periodic Heartbeat Renewal
 * 2. True CAS Concurrency Conflict Handling
 * 3. Safe Token-Based Lock Release
 * 4. Ephemeral Disk Staging & Redis Pub/Sub Abort Signal Handling
 * 5. Parent Aggregator Orchestration & Real-time WebSocket Progress
 */

import { Worker } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import { redisClient } from "../config/redis.js";
import {
  OVERPASS_QUEUE_NAME,
  JOB_TYPE_SYNC_ROADS,
  JOB_TYPE_SYNC_TOLL,
  JOB_TYPE_SYNC_POI,
  JOB_TYPE_AGGREGATOR,
  acquireSyncLock,
  SyncLockLease,
} from "../queues/overpassQueue.js";
import { spatialETLPipelineService } from "../services/spatial/SpatialETLPipelineService.js";
import { datasetSyncJobRepository } from "../repositories/datasetSyncJobRepository.js";
import { datasetVersionRepository } from "../repositories/datasetVersionRepository.js";
import { auditLogger } from "../utils/AuditLogger.js";
import { cronRepository } from "../repositories/cronRepository.js";
import { socketManager } from "../socket/socketManager.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import Redis from "ioredis";

console.log("⚙️ [BULLMQ WORKER] Memulai Overpass Background Sync Worker...");

// Dedicated subscriber client for Redis Pub/Sub abort signals
const subClient = new (Redis as any)(redisOptions);
const activeJobAbortControllers = new Map<string, AbortController>();

subClient.subscribe("spatial:sync:abort", (err: any) => {
  if (err) {
    console.error("💥 [BULLMQ WORKER] Gagal subscribe ke channel 'spatial:sync:abort':", err.message);
  } else {
    console.log("📡 [BULLMQ WORKER] Berhasil subscribe ke channel 'spatial:sync:abort'");
  }
});

subClient.on("message", (channel: string, message: string) => {
  if (channel === "spatial:sync:abort") {
    try {
      const parsed = JSON.parse(message);
      console.warn(`🛑 [BULLMQ WORKER] Menerima sinyal pembatalan sinkronisasi:`, parsed);
      // Abort all active jobs or matching hub jobs
      for (const [jobId, controller] of activeJobAbortControllers.entries()) {
        console.warn(`🛑 [BULLMQ WORKER] Mengirim abort signal ke Job ID: ${jobId}`);
        controller.abort();
      }
      socketManager.broadcastAll("SPATIAL_SYNC_ABORTED", { message: "Sinkronisasi dibatalkan oleh pengguna." });
    } catch (e: any) {
      console.error("Gagal parsing payload abort:", e.message);
    }
  }
});

export const overpassWorker = new Worker(
  OVERPASS_QUEUE_NAME,
  async (job) => {
    console.log(`🚀 [BULLMQ WORKER] Memproses Job ID '${job.id}' (${job.name}) - Attempt ${job.attemptsMade + 1}...`);
    const startTime = Date.now();

    // 1. Handle Flow Aggregator Job (Parent)
    if (job.name === JOB_TYPE_AGGREGATOR) {
      console.log(`🏁 [BULLMQ WORKER] Menjalankan Aggregator Job '${job.id}' - Menyatukan status sinkronisasi...`);
      const tollActive = await datasetVersionRepository.findActiveVersion("TOLL_ROADS");
      const roadsActive = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
      const poiActive = await datasetVersionRepository.findActiveVersion("POI");

      const allActive = Boolean(tollActive && roadsActive && poiActive);
      const nextState = allActive ? "READY_FOR_REVIEW" : "DRAFT";

      await SystemSettingModel.upsert("SYSTEM_SETUP_FSM_STATE", nextState, "FSM State Setup Wizard");

      socketManager.broadcastAll("SPATIAL_SYNC_ALL_COMPLETED", {
        success: allActive,
        state: nextState,
        summary: {
          toll_roads: tollActive?.feature_count || 0,
          protocol_roads: roadsActive?.feature_count || 0,
          poi: poiActive?.feature_count || 0,
        },
      });

      return {
        success: allActive,
        tollActive: !!tollActive,
        roadsActive: !!roadsActive,
        poiActive: !!poiActive,
        fsmState: nextState,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Handle Child Jobs (Toll Roads, Protocol Roads, POI)
    const datasetType =
      job.data?.datasetType ||
      (job.name === JOB_TYPE_SYNC_POI
        ? "POI"
        : job.name === JOB_TYPE_SYNC_TOLL
        ? "TOLL_ROADS"
        : "PROTOCOL_ROADS");

    const abortController = new AbortController();
    if (job.id) {
      activeJobAbortControllers.set(job.id, abortController);
    }

    let lockLease: SyncLockLease | null = null;
    let lockToken = job.data?.lockToken;

    // Acquire lock if not already provided by the enqueue trigger
    if (!lockToken) {
      const lockRes = await acquireSyncLock(datasetType);
      if (!lockRes.acquired || !lockRes.token) {
        const err: any = new Error(`Tidak dapat memperoleh distributed lock untuk dataset '${datasetType}'.`);
        err.code = "LOCK_ACQUIRE_FAILED";
        throw err;
      }
      lockToken = lockRes.token;
    }

    lockLease = new SyncLockLease(datasetType, lockToken);
    lockLease.startHeartbeat(() => {
      console.error(`🚨 [LOCK_LOST] Worker Job ID '${job.id}' kehilangan distributed lock untuk '${datasetType}'!`);
    });

    let result: any = null;

    try {
      const updateProgressWithBroadcast = async (progress: number) => {
        await job.updateProgress(progress);
        socketManager.broadcastAll("SPATIAL_SYNC_PROGRESS", {
          jobId: job.id,
          datasetType,
          progress,
          status: progress >= 100 ? "COMPLETED" : "PROCESSING",
        });
      };

      if (job.name === JOB_TYPE_SYNC_POI) {
        result = await spatialETLPipelineService.syncPoisPipeline(
          job.id as string,
          job.data?.cityName,
          updateProgressWithBroadcast,
          lockLease,
          job.data?.expectedActiveVersionId,
          job.data?.bbox,
          abortController.signal
        );
      } else if (job.name === JOB_TYPE_SYNC_TOLL) {
        result = await spatialETLPipelineService.syncTollRoadsPipeline(
          job.id as string,
          updateProgressWithBroadcast,
          lockLease,
          job.data?.expectedActiveVersionId,
          job.data?.cities,
          job.data?.bbox,
          abortController.signal
        );
      } else if (job.name === JOB_TYPE_SYNC_ROADS) {
        result = await spatialETLPipelineService.syncProtocolRoadsPipeline(
          job.id as string,
          job.data?.cities,
          updateProgressWithBroadcast,
          lockLease,
          job.data?.expectedActiveVersionId,
          job.data?.bbox,
          abortController.signal
        );
      } else {
        throw new Error(`Job type '${job.name}' tidak dikenali.`);
      }

      const durationMs = Date.now() - startTime;
      socketManager.broadcastAll("SPATIAL_SYNC_DATASET_COMPLETED", {
        jobId: job.id,
        datasetType,
        version: result?.version,
        featuresCount: result?.features_count,
        durationMs,
      });

      return { ...result, durationMs };
    } finally {
      if (job.id) {
        activeJobAbortControllers.delete(job.id);
      }
      if (lockLease) {
        await lockLease.release();
      }
    }
  },
  {
    connection: redisOptions as any,
    concurrency: 2, // Concurrency 2 for parallel ETL processing
  }
);

overpassWorker.on("completed", async (job, result) => {
  console.log(`✅ [BULLMQ WORKER] Job ID '${job.id}' (${job.name}) Selesai dalam ${result?.durationMs || 0}ms!`);

  if (job.name !== JOB_TYPE_AGGREGATOR) {
    await cronRepository.createLog({
      cron_key: job.name === JOB_TYPE_SYNC_POI ? "POI_SYNC" : "ROAD_SYNC",
      status: "SUCCESS",
      duration_ms: result?.durationMs || 0,
      message: `BullMQ Worker berhasil memproses job ID ${job.id}: Versi ${result?.version || "N/A"} ACTIVE`,
    });
  }

  await auditLogger.logAction({
    action: "BULLMQ_JOB_COMPLETED",
    entityType: "BULLMQ",
    entityId: job.id,
    details: { job_name: job.name, job_id: job.id, result },
  });
});

overpassWorker.on("failed", async (job, err) => {
  console.error(`💥 [BULLMQ WORKER] Job ID '${job?.id}' (${job?.name}) Gagal: ${err.message}`);

  if (job) {
    let failureStatus: any = "FAILED";
    if (err.message.includes("OPTIMISTIC_CONCURRENCY_CONFLICT") || (err as any).code === "CONCURRENCY_CONFLICT") {
      failureStatus = "CONCURRENCY_CONFLICT";
      console.warn(`⚠️ [CONCURRENCY_CONFLICT] Job '${job.id}' dibatalkan karena versi baseline telah berubah.`);
    } else if (err.message.includes("DISTRIBUTED_LOCK_LOST") || (err as any).code === "LOCK_LOST") {
      failureStatus = "LOCK_LOST";
      console.warn(`🚨 [LOCK_LOST] Job '${job.id}' dibatalkan karena kehilangan hak kepemilikan lock.`);
    } else if (err.message.includes("ABORTED")) {
      failureStatus = "ABORTED";
      console.warn(`🛑 [ABORTED] Job '${job.id}' dibatalkan oleh pengguna.`);
    }

    await datasetSyncJobRepository.updateJob(job.id as string, {
      status: failureStatus,
      error_details: { code: (err as any).code || failureStatus, message: err.message, stack: err.stack },
      completed_at: new Date(),
    });

    socketManager.broadcastAll("SPATIAL_SYNC_DATASET_FAILED", {
      jobId: job.id,
      datasetType: job.data?.datasetType || job.name,
      status: failureStatus,
      error: err.message,
    });

    if (job.name !== JOB_TYPE_AGGREGATOR) {
      await cronRepository.createLog({
        cron_key: job.name === JOB_TYPE_SYNC_POI ? "POI_SYNC" : "ROAD_SYNC",
        status: failureStatus,
        duration_ms: 0,
        message: `BullMQ Worker gagal memproses job ID ${job.id} (${failureStatus}): ${err.message}`,
      });
    }

    await auditLogger.logAction({
      action: "BULLMQ_JOB_FAILED",
      entityType: "BULLMQ",
      entityId: job.id,
      details: { job_name: job.name, job_id: job.id, error: err.message, code: failureStatus },
      status: failureStatus,
    });
  }
});
