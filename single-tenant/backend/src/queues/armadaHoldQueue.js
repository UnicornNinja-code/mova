import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const ARMADA_HOLD_QUEUE_NAME = "armadaHoldQueue";
export const JOB_TYPE_RELEASE_HOLD = "JOB_TYPE_RELEASE_HOLD";

const DEFAULT_HOLD_DELAY_MS = 5 * 60 * 1000;
const QUEUE_ADD_TIMEOUT_MS = 1500;
const GET_JOB_TIMEOUT_MS = 1000;
const RETRY_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 2000;
const ONE_HOUR_SECONDS = 3600;
const ONE_DAY_SECONDS = 86400;

export const armadaHoldQueue = new Queue(ARMADA_HOLD_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: RETRY_ATTEMPTS,
    backoff: {
      type: "fixed",
      delay: RETRY_BACKOFF_MS,
    },
    removeOnComplete: { age: ONE_HOUR_SECONDS, count: 50 },
    removeOnFail: { age: ONE_DAY_SECONDS, count: 100 },
  },
});

export const addArmadaHoldReleaseJob = async ({ armadaId, riderId, delayMs = DEFAULT_HOLD_DELAY_MS }) => {
  if (!armadaId) return null;

  const jobId = `hold-armada-${armadaId}`;

  try {
    try {
      const existingJob = await Promise.race([
        armadaHoldQueue.getJob(jobId),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), GET_JOB_TIMEOUT_MS)),
      ]);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // Ignore when job is absent or lookup times out
    }

    const jobPromise = armadaHoldQueue.add(
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

    const job = await Promise.race([
      jobPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Queue timeout")), QUEUE_ADD_TIMEOUT_MS)),
    ]);

    console.log(`⏰ [BULLMQ DELAYED JOB] Armada '${armadaId}' dijadwalkan lepas otomatis dalam ${delayMs / 1000} detik (Job ID: ${job.id})`);
    return job;
  } catch (err) {
    console.warn(`⚠️ [BULLMQ DELAYED JOB] Fallback mode untuk armada '${armadaId}' (Redis unavailable):`, err.message);
    return { id: `fallback-hold-${armadaId}` };
  }
};

export const removeArmadaHoldReleaseJob = async (armadaId) => {
  if (!armadaId) return false;

  const jobId = `hold-armada-${armadaId}`;
  try {
    const job = await Promise.race([
      armadaHoldQueue.getJob(jobId),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), GET_JOB_TIMEOUT_MS)),
    ]);
    if (job) {
      await job.remove();
      console.log(`🗑️ [BULLMQ DELAYED JOB] Job pelepasan armada '${armadaId}' berhasil dibatalkan dari antrean.`);
      return true;
    }
  } catch (error) {
    console.warn(`⚠️ Gagal menghapus delayed job armada '${armadaId}':`, error.message);
  }
  return false;
};

