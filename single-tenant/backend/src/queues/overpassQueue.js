import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const OVERPASS_QUEUE_NAME = "overpassSyncQueue";
export const JOB_TYPE_SYNC_ROADS = "JOB_SYNC_ROADS";
export const JOB_TYPE_SYNC_POI = "JOB_SYNC_POI";

const RETRY_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 5000;
const ONE_DAY_SECONDS = 86400;
const ONE_WEEK_SECONDS = ONE_DAY_SECONDS * 7;
const COMPLETED_JOB_LIMIT = 100;
const FAILED_JOB_LIMIT = 500;

export const overpassSyncQueue = new Queue(OVERPASS_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: RETRY_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: BACKOFF_DELAY_MS,
    },
    removeOnComplete: { age: ONE_DAY_SECONDS, count: COMPLETED_JOB_LIMIT },
    removeOnFail: { age: ONE_WEEK_SECONDS, count: FAILED_JOB_LIMIT },
  },
});

export const addRoadSyncJob = async ({ cityName = "Sidoarjo", userId = null } = {}) => {
  const timestamp = Date.now();
  const job = await overpassSyncQueue.add(
    JOB_TYPE_SYNC_ROADS,
    {
      type: JOB_TYPE_SYNC_ROADS,
      cityName,
      userId,
      triggeredAt: new Date(timestamp).toISOString(),
    },
    {
      jobId: `sync-roads-${cityName.toLowerCase().replace(/\s+/g, "_")}-${timestamp}`,
    }
  );
  console.log(`📥 [BULLMQ QUEUE] Job '${JOB_TYPE_SYNC_ROADS}' dimasukkan ke antrean (ID: ${job.id})`);
  return job;
};

export const addPoiSyncJob = async ({ cityName = "Sidoarjo", userId = null } = {}) => {
  const timestamp = Date.now();
  const job = await overpassSyncQueue.add(
    JOB_TYPE_SYNC_POI,
    {
      type: JOB_TYPE_SYNC_POI,
      cityName,
      userId,
      triggeredAt: new Date(timestamp).toISOString(),
    },
    {
      jobId: `sync-poi-${cityName.toLowerCase().replace(/\s+/g, "_")}-${timestamp}`,
    }
  );
  console.log(`📥 [BULLMQ QUEUE] Job '${JOB_TYPE_SYNC_POI}' dimasukkan ke antrean (ID: ${job.id})`);
  return job;
};

export const getJobStatus = async (jobId) => {
  if (!jobId) return null;
  const job = await overpassSyncQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;
  const reason = job.failedReason;
  const returnvalue = job.returnvalue;

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    state,
    progress,
    result: returnvalue || null,
    error: reason || null,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
};

