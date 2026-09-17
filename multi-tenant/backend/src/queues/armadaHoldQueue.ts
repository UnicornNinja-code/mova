/*
 * armadaHoldQueue.ts
 * BullMQ Queue Producer for Ticket-Booking Armada Hold Release Delayed Jobs in TypeScript
 */

import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const ARMADA_HOLD_QUEUE_NAME = "armadaHoldQueue";
export const JOB_TYPE_RELEASE_HOLD = "JOB_TYPE_RELEASE_HOLD";

export const armadaHoldQueue = new Queue(ARMADA_HOLD_QUEUE_NAME, {
  connection: redisOptions as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 2000,
    },
    removeOnComplete: { age: 3600, count: 50 },
    removeOnFail: { age: 86400, count: 100 },
  },
});

/**
 * Add Delayed Job to Release Armada Hold after exactly delayMs (Default: 5 Minutes)
 */
export const addArmadaHoldReleaseJob = async ({
  armadaId,
  riderId,
  delayMs = 5 * 60 * 1000,
}: {
  armadaId: number | string;
  riderId: number | string;
  delayMs?: number;
}) => {
  if (!armadaId) return null;

  const jobId = `hold-armada-${armadaId}`;

  try {
    const existingJob = await armadaHoldQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }
  } catch (e) {}

  const job = await armadaHoldQueue.add(
    JOB_TYPE_RELEASE_HOLD,
    {
      armadaId,
      riderId,
      delayMs,
      holdStartedAt: new Date().toISOString(),
    },
    {
      delay: delayMs,
      jobId,
    }
  );

  console.log(`⏰ [BULLMQ DELAYED JOB] Armada '${armadaId}' dijadwalkan lepas otomatis dalam ${delayMs / 1000} detik (Job ID: ${job.id})`);
  return job;
};

/**
 * Cancel & Remove Delayed Job early if Rider claims or cancels hold early
 */
export const removeArmadaHoldReleaseJob = async (armadaId: number | string) => {
  if (!armadaId) return false;

  const jobId = `hold-armada-${armadaId}`;
  try {
    const job = await armadaHoldQueue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`🗑️ [BULLMQ DELAYED JOB] Job pelepasan armada '${armadaId}' berhasil dibatalkan dari antrean.`);
      return true;
    }
  } catch (error: any) {
    console.error(`⚠️ Gagal menghapus delayed job armada '${armadaId}':`, error.message);
  }
  return false;
};
