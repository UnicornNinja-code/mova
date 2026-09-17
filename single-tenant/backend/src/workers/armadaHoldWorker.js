/*
 * armadaHoldWorker.js
 * BullMQ Worker Consumer for Ticket-Booking Armada Hold Release Delayed Jobs
 */

import { Worker } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import { ARMADA_HOLD_QUEUE_NAME } from "../queues/armadaHoldQueue.js";
import { pool } from "../config/database.js";
import { auditLogger } from "../utils/AuditLogger.js";
import { cronRepository } from "../repositories/cronRepository.js";

const WORKER_CONCURRENCY = 5;
const STALLED_INTERVAL_MS = 30000;
const MAX_STALLED_COUNT = 2;

console.log("⚙️ [BULLMQ WORKER] Memulai Armada Hold Release Background Worker...");

export const armadaHoldWorker = new Worker(
  ARMADA_HOLD_QUEUE_NAME,
  async (job) => {
    const { armadaId, riderId } = job.data;
    console.log(`⏰ [ARMADA WORKER EXECUTING] Memproses pelepasan otomatis armada ID '${armadaId}' (Job: ${job.id})...`);

    const queryCheck = `SELECT id, code, status, reserved_by_rider_id FROM armadas WHERE id = $1;`;
    const { rows } = await pool.query(queryCheck, [armadaId]);
    const armada = rows[0];

    if (!armada) {
      console.log(`ℹ️ [ARMADA WORKER] Armada '${armadaId}' tidak ditemukan di DB.`);
      return { released: false, reason: "Armada not found" };
    }

    if (armada.status !== "RESERVED") {
      console.log(`ℹ️ [ARMADA WORKER] Armada '${armada.code}' sudah berstatus '${armada.status}' (tidak perlu dilepas).`);
      return { released: false, reason: `Armada status is ${armada.status}` };
    }

    // Revert status to ACTIVE
    const queryRelease = `
      UPDATE armadas
      SET 
        status = 'ACTIVE',
        reserved_by_rider_id = NULL,
        reserved_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'RESERVED'
      RETURNING id, code;
    `;
    const { rows: updatedRows } = await pool.query(queryRelease, [armadaId]);

    if (updatedRows.length > 0) {
      console.log(`✅ [ARMADA WORKER RELEASED] Unit '${armada.code}' resmi dilepas dari hold sementara -> ACTIVE.`);

      await cronRepository.createLog({
        cron_key: "ARMADA_RELEASE",
        status: "SUCCESS",
        duration_ms: 0,
        message: `BullMQ Delayed Job otomatis melepaskan armada hold '${armada.code}'.`,
      });

      await auditLogger.logAction({
        action: "ARMADA_HOLD_EXPIRED_RELEASE",
        entityType: "ARMADA",
        entityId: armada.id,
        details: { armada_code: armada.code, rider_id: riderId },
      });

      return { released: true, code: armada.code };
    }

    return { released: false };
  },
  {
    connection: redisOptions,
    concurrency: WORKER_CONCURRENCY,
    stalledInterval: STALLED_INTERVAL_MS,
    maxStalledCount: MAX_STALLED_COUNT,
  }
);

armadaHoldWorker.on("completed", (job, result) => {
  console.log(`✅ [ARMADA WORKER COMPLETED] Delayed Job '${job.id}' selesai. Result:`, result);
});

armadaHoldWorker.on("failed", (job, err) => {
  console.error(`💥 [ARMADA WORKER FAILED] Delayed Job '${job?.id}' gagal:`, err.message);
});

armadaHoldWorker.on("stalled", (jobId) => {
  console.warn(`⚠️ [ARMADA WORKER STALLED] Job '${jobId}' stalled dan dijadwalkan ulang untuk dieksekusi.`);
});

armadaHoldWorker.on("error", (err) => {
  console.warn("⚠️ [ARMADA WORKER ERROR] Redis worker connection error:", err.message);
});


