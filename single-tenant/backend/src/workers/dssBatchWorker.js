/*
 * dssBatchWorker.js
 * BullMQ Worker for Processing Asynchronous DSS Batch Jobs & Snapshot Generation
 */

import { Worker } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import { DSS_BATCH_QUEUE_NAME } from "../queues/dssBatchQueue.js";
import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";

const WORKER_CONCURRENCY = 2;
const STALLED_INTERVAL_MS = 45000;
const MAX_STALLED_COUNT = 2;

console.log("⚙️ [BULLMQ WORKER] Memulai DSS Batch Background Worker...");

export const dssBatchWorker = new Worker(
  DSS_BATCH_QUEUE_NAME,
  async (job) => {
    console.log(`⚙️ [BULLMQ WORKER] Memproses DSS Batch Job ID '${job.id}' (${job.name})...`);

    const { zone_ids, time_slot, bwm_config_id, save_snapshot = true } = job.data;

    const result = await hybridBwmTopsisService.evaluateZonesHybrid({
      zone_ids: zone_ids || null,
      time_slot: time_slot || null,
      bwm_config_id: bwm_config_id || null,
      save_snapshot: Boolean(save_snapshot),
    });

    console.log(`✅ [BULLMQ WORKER] Job '${job.id}' selesai. Snapshot ID: ${result.snapshot_id || "N/A"}`);
    return result;
  },
  {
    connection: redisOptions,
    concurrency: WORKER_CONCURRENCY,
    stalledInterval: STALLED_INTERVAL_MS,
    maxStalledCount: MAX_STALLED_COUNT,
  }
);

dssBatchWorker.on("completed", (job, result) => {
  console.log(`🎉 [DSS WORKER COMPLETED] Job '${job.id}' selesai dengan sukses.`);
});

dssBatchWorker.on("failed", (job, err) => {
  console.error(`❌ [DSS WORKER FAILED] Job '${job?.id}' gagal setelah ${job?.attemptsMade} percobaan:`, err.message);
});

dssBatchWorker.on("stalled", (jobId) => {
  console.warn(`⚠️ [DSS WORKER STALLED] Job DSS '${jobId}' stalled dan dijadwalkan ulang.`);
});

dssBatchWorker.on("error", (err) => {
  console.warn("⚠️ [DSS WORKER ERROR] Redis worker connection error:", err.message);
});


