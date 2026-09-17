/*
 * dssBatchQueue.ts
 * BullMQ Job Queue for Asynchronous Batch DSS Evaluations in TypeScript
 */

import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const DSS_BATCH_QUEUE_NAME = "dss-batch-queue";

export const dssBatchQueue = new Queue(DSS_BATCH_QUEUE_NAME, {
  connection: redisOptions as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
