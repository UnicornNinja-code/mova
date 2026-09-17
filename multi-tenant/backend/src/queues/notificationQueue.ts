/*
 * notificationQueue.ts
 * BullMQ Queue Producer for Asynchronous Notification Dispatching in TypeScript
 */

import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";

export const NOTIFICATION_QUEUE_NAME = "notificationQueue";
export const NOTIF_TYPE_RIDER_ASSIGNED = "NOTIF_RIDER_ASSIGNED";
export const NOTIF_TYPE_GEOFENCE_ALERT = "NOTIF_GEOFENCE_ALERT";
export const NOTIF_TYPE_SYSTEM_BROADCAST = "NOTIF_SYSTEM_BROADCAST";

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection: redisOptions as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 86400, count: 500 },
  },
});

/**
 * Add Rider Zone Assignment Notification Job to BullMQ Queue
 */
export const addRiderAssignedNotifJob = async ({
  assignmentId,
  riderId,
  zoneName,
  topsisRank,
  assignmentType = "AUTO",
}: {
  assignmentId: number | string;
  riderId: number | string;
  zoneName: string;
  topsisRank?: number;
  assignmentType?: string;
}) => {
  const job = await notificationQueue.add(NOTIF_TYPE_RIDER_ASSIGNED, {
    type: NOTIF_TYPE_RIDER_ASSIGNED,
    assignmentId,
    riderId,
    zoneName,
    topsisRank,
    assignmentType,
    created_at: new Date().toISOString(),
  });
  console.log(`📥 [NOTIF QUEUE] Job '${NOTIF_TYPE_RIDER_ASSIGNED}' dikirim ke antrean (ID: ${job.id})`);
  return job;
};

/**
 * Add Geofence Breach Alert Notification Job to BullMQ Queue
 */
export const addGeofenceAlertNotifJob = async ({ warningPayload }: { warningPayload: any }) => {
  const job = await notificationQueue.add(NOTIF_TYPE_GEOFENCE_ALERT, {
    type: NOTIF_TYPE_GEOFENCE_ALERT,
    warningPayload,
    created_at: new Date().toISOString(),
  });
  console.log(`📥 [NOTIF QUEUE] Job '${NOTIF_TYPE_GEOFENCE_ALERT}' dikirim ke antrean (ID: ${job.id})`);
  return job;
};

/**
 * Add System Announcement Broadcast Notification Job to BullMQ Queue
 */
export const addSystemBroadcastNotifJob = async ({ title, message }: { title: string; message: string }) => {
  const job = await notificationQueue.add(NOTIF_TYPE_SYSTEM_BROADCAST, {
    type: NOTIF_TYPE_SYSTEM_BROADCAST,
    title,
    message,
    created_at: new Date().toISOString(),
  });
  console.log(`📥 [NOTIF QUEUE] Job '${NOTIF_TYPE_SYSTEM_BROADCAST}' dikirim ke antrean (ID: ${job.id})`);
  return job;
};
