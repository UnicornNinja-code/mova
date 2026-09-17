/*
 * armadaHoldWorker.ts
 * BullMQ Worker Consumer for Ticket-Booking Armada Hold Release Delayed Jobs in TypeScript
 */

import { Worker } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import { ARMADA_HOLD_QUEUE_NAME } from "../queues/armadaHoldQueue.js";
import { pool } from "../config/database.js";
import { auditLogger } from "../utils/AuditLogger.js";
import { cronRepository } from "../repositories/cronRepository.js";

console.log("⚙️ [BULLMQ WORKER] Memulai Armada Hold Release Background Worker...");

export const armadaHoldWorker = new Worker(
  ARMADA_HOLD_QUEUE_NAME,
  async (job) => {
    const { armadaId, riderId } = job.data;
    console.log(`⏰ [ARMADA WORKER EXECUTING] Memproses pelepasan otomatis armada ID '${armadaId}'...`);

    const queryCheck = `SELECT id, code, status, reserved_by_rider_id FROM armadas WHERE id = $1;`;
    const { rows } = await pool.query(queryCheck, [armadaId]);
    const armada = rows[0];

    if (!armada) {
      console.log(`ℹ️ [ARMADA WORKER] Armada '${armadaId}' tidak ditemukan di DB.`);
      return { released: false, reason: "Armada not found" };
    }

    await pool.query(
      `UPDATE fleet_reservations 
       SET status = 'EXPIRED', released_at = CURRENT_TIMESTAMP 
       WHERE armada_id = $1 AND status = 'ACTIVE' AND expires_at <= NOW();`,
      [armadaId]
    );

    const queryRelease = `
      UPDATE armadas
      SET 
        status = 'ACTIVE',
        reserved_by_rider_id = NULL,
        reserved_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND (reserved_until IS NULL OR reserved_until <= NOW())
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
    connection: redisOptions as any,
    concurrency: 5,
  }
);

armadaHoldWorker.on("completed", (job, result) => {
  console.log(`✅ [ARMADA WORKER COMPLETED] Delayed Job '${job.id}' selesai. Result:`, result);
});

armadaHoldWorker.on("failed", (job, err) => {
  console.error(`💥 [ARMADA WORKER FAILED] Delayed Job '${job?.id}' gagal:`, err.message);
});
