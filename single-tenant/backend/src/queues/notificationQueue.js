import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const NOTIFICATION_QUEUE_NAME = "notificationQueue";
export const NOTIF_TYPE_RIDER_ASSIGNED = "NOTIF_RIDER_ASSIGNED";
export const NOTIF_TYPE_GEOFENCE_ALERT = "NOTIF_GEOFENCE_ALERT";
export const NOTIF_TYPE_SYSTEM_BROADCAST = "NOTIF_SYSTEM_BROADCAST";

const QUEUE_ADD_TIMEOUT_MS = 1500;
const RETRY_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 2000;
const ONE_HOUR_SECONDS = 3600;
const ONE_DAY_SECONDS = 86400;
const COMPLETED_JOB_LIMIT = 100;
const FAILED_JOB_LIMIT = 500;

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: RETRY_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: BACKOFF_DELAY_MS,
    },
    removeOnComplete: { age: ONE_HOUR_SECONDS, count: COMPLETED_JOB_LIMIT },
    removeOnFail: { age: ONE_DAY_SECONDS, count: FAILED_JOB_LIMIT },
  },
});

const safeAdd = async (name, data, opts = {}) => {
  try {
    const promise = notificationQueue.add(name, data, opts);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Queue timeout")), QUEUE_ADD_TIMEOUT_MS)
    );
    return await Promise.race([promise, timeout]);
  } catch (err) {
    console.warn(`⚠️ [NOTIF QUEUE] Job '${name}' fallback mode (Redis unavailable):`, err.message);
    return { id: `fallback-${Date.now()}` };
  }
};

export const addRiderAssignedNotifJob = async ({
  assignmentId,
  riderId,
  zoneName,
  topsisRank,
  assignmentType = "AUTO",
}) => {
  const jobId = assignmentId ? `notif-rider-${assignmentId}` : undefined;
  const job = await safeAdd(
    NOTIF_TYPE_RIDER_ASSIGNED,
    {
      type: NOTIF_TYPE_RIDER_ASSIGNED,
      assignmentId,
      riderId,
      zoneName,
      topsisRank,
      assignmentType,
      created_at: new Date().toISOString(),
    },
    jobId ? { jobId } : {}
  );
  console.log(`📥 [NOTIF QUEUE] Job '${NOTIF_TYPE_RIDER_ASSIGNED}' diproses (ID: ${job.id})`);
  return job;
};

export const addGeofenceAlertNotifJob = async ({ warningPayload }) => {
  const job = await safeAdd(NOTIF_TYPE_GEOFENCE_ALERT, {
    type: NOTIF_TYPE_GEOFENCE_ALERT,
    warningPayload,
    created_at: new Date().toISOString(),
  });
  console.log(`📥 [NOTIF QUEUE] Job '${NOTIF_TYPE_GEOFENCE_ALERT}' diproses (ID: ${job.id})`);
  return job;
};

export const addSystemBroadcastNotifJob = async ({ title, message }) => {
  const job = await safeAdd(NOTIF_TYPE_SYSTEM_BROADCAST, {
    type: NOTIF_TYPE_SYSTEM_BROADCAST,
    title,
    message,
    created_at: new Date().toISOString(),
  });
  console.log(`📥 [NOTIF QUEUE] Job '${NOTIF_TYPE_SYSTEM_BROADCAST}' diproses (ID: ${job.id})`);
  return job;
};

