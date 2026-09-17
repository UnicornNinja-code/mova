/*
 * reportExportWorker.ts
 * S7-05-07: BullMQ Worker Consumer for Operational Reporting & Export Engine
 * MOVA Architecture
 */

import { Worker, Job } from "bullmq";
import { redisOptions } from "../config/redisConfig.js";
import {
  REPORT_EXPORT_QUEUE_NAME,
  ReportExportJobPayload,
} from "../queues/reportExportQueue.js";
import { reportExportProcessor } from "../services/reporting/reportExportProcessor.js";
import { auditLogger } from "../utils/AuditLogger.js";

console.log("⚙️ [BULLMQ WORKER] Memulai Operational Report Export Background Worker...");

export const reportExportWorker = new Worker<ReportExportJobPayload>(
  REPORT_EXPORT_QUEUE_NAME,
  async (job: Job<ReportExportJobPayload>) => {
    const { jobId, tenantId, reportType, format } = job.data;
    console.log(
      `📊 [REPORT WORKER] Memproses Export Job '${jobId}' (${reportType} | ${format}) untuk Tenant '${tenantId}'...`
    );

    await reportExportProcessor.processExportJob(jobId, tenantId);

    return { jobId, tenantId, status: "COMPLETED" };
  },
  {
    connection: redisOptions as any,
    concurrency: 4, // Bounded global worker concurrency
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

reportExportWorker.on("completed", async (job) => {
  console.log(
    `✅ [REPORT WORKER COMPLETED] Export Job ID '${job.id}' (${job.data.reportType} -> ${job.data.format}) Berhasil Diselesaikan!`
  );

  await auditLogger.logAction({
    action: "REPORT_EXPORT_COMPLETED",
    entityType: "REPORT_EXPORT_JOB",
    entityId: job.data.jobId,
    details: {
      tenant_id: job.data.tenantId,
      report_type: job.data.reportType,
      format: job.data.format,
    },
  });
});

reportExportWorker.on("failed", async (job, err) => {
  console.error(
    `💥 [REPORT WORKER FAILED] Export Job ID '${job?.id}' (${job?.data?.reportType}) Gagal: ${err.message}`
  );

  if (job?.data) {
    await auditLogger.logAction({
      action: "REPORT_EXPORT_FAILED",
      entityType: "REPORT_EXPORT_JOB",
      entityId: job.data.jobId,
      status: "FAILURE",
      details: {
        tenant_id: job.data.tenantId,
        report_type: job.data.reportType,
        format: job.data.format,
        error_message: err.message,
      },
    });
  }
});
