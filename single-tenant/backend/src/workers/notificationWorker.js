/*
 * notificationWorker.js
 * BullMQ Worker Consumer for Asynchronous Notification Dispatching
 */

import { Worker } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import {
  NOTIFICATION_QUEUE_NAME,
  NOTIF_TYPE_RIDER_ASSIGNED,
  NOTIF_TYPE_GEOFENCE_ALERT,
  NOTIF_TYPE_SYSTEM_BROADCAST,
} from "../queues/notificationQueue.js";
import { socketManager } from "../socket/socketManager.js";
import { sendRiderAssignmentNotification } from "../socket/armadaLockSocketHandler.js";
import { auditLogger } from "../utils/AuditLogger.js";

const WORKER_CONCURRENCY = 10;
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_DURATION_MS = 1000;
const STALLED_INTERVAL_MS = 30000;
const MAX_STALLED_COUNT = 2;

console.log("⚙️ [BULLMQ WORKER] Memulai Notification Background Worker...");

export const notificationWorker = new Worker(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    console.log(`🔔 [NOTIF WORKER] Memproses Job ID '${job.id}' (${job.name})...`);
    const data = job.data;

    if (job.name === NOTIF_TYPE_RIDER_ASSIGNED) {
      sendRiderAssignmentNotification({
        assignmentId: data.assignmentId,
        riderId: data.riderId,
        zoneName: data.zoneName,
        topsisRank: data.topsisRank,
        assignmentType: data.assignmentType,
      });
    } else if (job.name === NOTIF_TYPE_GEOFENCE_ALERT) {
      socketManager.broadcastToSupervisors("supervisor:geofence_alert", data.warningPayload);
    } else if (job.name === NOTIF_TYPE_SYSTEM_BROADCAST) {
      socketManager.broadcastAll("system:announcement", {
        type: "SYSTEM_ANNOUNCEMENT",
        title: data.title,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error(`Notification job type '${job.name}' tidak dikenali.`);
    }

    return { delivered: true, type: job.name };
  },
  {
    connection: redisOptions,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: RATE_LIMIT_MAX,
      duration: RATE_LIMIT_DURATION_MS,
    },
    stalledInterval: STALLED_INTERVAL_MS,
    maxStalledCount: MAX_STALLED_COUNT,
  }
);

notificationWorker.on("completed", async (job, result) => {
  console.log(`✅ [NOTIF WORKER COMPLETED] Notifikasi ID '${job.id}' (${job.name}) Berhasil Dikirim!`);

  await auditLogger.logAction({
    action: "NOTIFICATION_DELIVERED",
    entityType: "NOTIFICATION",
    entityId: job.id,
    details: { job_name: job.name, result },
  });
});

notificationWorker.on("failed", async (job, err) => {
  console.error(`💥 [NOTIF WORKER FAILED] Notifikasi ID '${job?.id}' Gagal: ${err.message}`);
});

notificationWorker.on("stalled", (jobId) => {
  console.warn(`⚠️ [NOTIF WORKER STALLED] Job notifikasi '${jobId}' stalled.`);
});

notificationWorker.on("error", (err) => {
  console.warn("⚠️ [NOTIF WORKER ERROR] Redis worker connection error:", err.message);
});


