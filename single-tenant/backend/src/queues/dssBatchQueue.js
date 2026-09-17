import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const DSS_BATCH_QUEUE_NAME = "dss-batch-queue";
const RETRY_ATTEMPTS = 3;
const INITIAL_BACKOFF_DELAY_MS = 1000;
const COMPLETED_JOB_RETENTION_COUNT = 100;
const FAILED_JOB_RETENTION_COUNT = 200;

export const dssBatchQueue = new Queue(DSS_BATCH_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: RETRY_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: INITIAL_BACKOFF_DELAY_MS,
    },
    removeOnComplete: COMPLETED_JOB_RETENTION_COUNT,
    removeOnFail: FAILED_JOB_RETENTION_COUNT,
  },
});

