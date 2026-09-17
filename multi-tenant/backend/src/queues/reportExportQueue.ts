/*
 * reportExportQueue.ts
 * S7-05-07: BullMQ Queue Producer for Asynchronous Report Exports
 * MOVA Architecture
 */

import { Queue } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import { ReportType, ReportFormat } from "../types/reporting.types.js";
import { reportResourceGovernor } from "../services/reporting/reportResourceGovernor.js";

export const REPORT_EXPORT_QUEUE_NAME = "mova-reports-export";

export interface ReportExportJobPayload {
  jobId: string;
  tenantId: string;
  reportType: ReportType;
  format: ReportFormat;
  enqueuedAt: string;
}

export const reportExportQueue = new Queue<ReportExportJobPayload>(REPORT_EXPORT_QUEUE_NAME, {
  connection: redisOptions as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 86400, count: 500 }, // 24h retention
    removeOnFail: { age: 86400, count: 500 },
  },
});

/**
 * Enqueues a new asynchronous report export execution with Governor check
 */
export async function enqueueReportExportJob(payload: {
  jobId: string;
  tenantId: string;
  reportType: ReportType;
  format: ReportFormat;
}) {
  // 1. Enforce Resource Governor concurrency limit (Max 2 active jobs / tenant)
  await reportResourceGovernor.checkTenantConcurrency(payload.tenantId);

  // 2. Add to BullMQ Queue
  const job = await reportExportQueue.add(
    `export:${payload.reportType}:${payload.format}`,
    {
      ...payload,
      enqueuedAt: new Date().toISOString(),
    },
    {
      jobId: payload.jobId,
    }
  );

  return job;
}
