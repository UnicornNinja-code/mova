/*
 * reportExportController.ts
 * S7-05-08: HTTP Controller for Operational Report Export & Secure Download API
 * MOVA Architecture
 */

import { Request, Response } from "express";
import fs from "fs";
import {
  CreateExportJobRequest,
  ReportType,
  ReportFormat,
  REPORT_GOVERNANCE,
} from "../types/reporting.types.js";
import { validateExportRequest } from "../lib/reporting/reportingStateMachine.js";
import { reportJobRepository } from "../repositories/reportJobRepository.js";
import { enqueueReportExportJob } from "../queues/reportExportQueue.js";
import { artifactSecurityService } from "../services/reporting/artifactSecurityService.js";

function sanitizeJobForApi(job: any) {
  if (!job) return job;
  const { artifactPath, ...publicJob } = job;
  return publicJob;
}

export class ReportExportController {
  /**
   * POST /api/reports/export
   * Initiates an asynchronous report export job
   */
  public static async createExportJob(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenant_id || "thesis-default";
      const createdBy = (req as any).user?.id || null;

      const body: CreateExportJobRequest = {
        reportType: req.body.reportType as ReportType,
        format: req.body.format as ReportFormat,
        rangeStart: req.body.rangeStart,
        rangeEnd: req.body.rangeEnd,
        timezone: req.body.timezone || REPORT_GOVERNANCE.DEFAULT_TIMEZONE,
        zoneId: req.body.zoneId,
        riderId: req.body.riderId,
      };

      // 1. Validate domain request invariants (range <= 90d, start < end, capability READY)
      validateExportRequest(body);

      // 2. Persist export job in QUEUED status
      const job = await reportJobRepository.createJob({
        tenantId,
        reportType: body.reportType,
        format: body.format,
        rangeStart: body.rangeStart,
        rangeEnd: body.rangeEnd,
        timezone: body.timezone,
        zoneId: body.zoneId,
        riderId: body.riderId,
        createdBy,
      });

      // 3. Enqueue to BullMQ worker with Resource Governor concurrency check
      await enqueueReportExportJob({
        jobId: job.id,
        tenantId: job.tenantId,
        reportType: job.reportType,
        format: job.format,
      });

      res.status(202).json({
        success: true,
        message: "Report export job successfully queued for asynchronous generation.",
        data: {
          job: sanitizeJobForApi(job),
          statusUrl: `/api/reports/export/${job.id}`,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        code: err.code || "CREATE_EXPORT_JOB_FAILED",
        error: err.message || "Failed to initiate report export job.",
      });
    }
  }

  /**
   * GET /api/reports/export/:id
   * Queries status and progress of an asynchronous export job
   */
  public static async getExportJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenant_id || "thesis-default";
      const { id } = req.params;

      const job = await reportJobRepository.findById(id, tenantId);
      if (!job) {
        res.status(404).json({
          success: false,
          code: "REPORT_JOB_NOT_FOUND",
          error: `Export job '${id}' not found.`,
        });
        return;
      }

      const isExpired = job.artifactExpiresAt
        ? new Date(job.artifactExpiresAt).getTime() <= Date.now()
        : false;

      const downloadUrl =
        job.status === "COMPLETED" && !isExpired && job.artifactPath
          ? `/api/reports/export/${job.id}/download`
          : null;

      res.status(200).json({
        success: true,
        data: {
          job: sanitizeJobForApi(job),
          downloadUrl,
          isExpired,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        code: "GET_JOB_STATUS_FAILED",
        error: err.message,
      });
    }
  }

  /**
   * GET /api/reports/export
   * List export job history for authenticated tenant
   */
  public static async listExportJobs(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenant_id || "thesis-default";
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const status = req.query.status as any;
      const reportType = req.query.reportType as any;

      const { jobs, total } = await reportJobRepository.listJobs(tenantId, {
        limit,
        offset,
        status,
        reportType,
      });

      res.status(200).json({
        success: true,
        data: {
          jobs: jobs.map(sanitizeJobForApi),
          total,
          limit,
          offset,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        code: "LIST_EXPORT_JOBS_FAILED",
        error: err.message,
      });
    }
  }

  /**
   * GET /api/reports/export/:id/download
   * Authenticated, application-mediated secure artifact download
   */
  public static async downloadArtifact(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenant_id || "thesis-default";
      const { id } = req.params;

      // Authorize download with tenant isolation, expiration, and path containment guards
      const authorized = await artifactSecurityService.authorizeDownload(id, tenantId);

      res.setHeader("Content-Type", authorized.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${authorized.downloadFilename}"`);
      res.setHeader("Content-Length", authorized.fileSizeBytes);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");

      const fileStream = fs.createReadStream(authorized.filePath);
      fileStream.pipe(res);
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === "REPORT_JOB_NOT_FOUND" ? 404 : 400);
      res.status(statusCode).json({
        success: false,
        code: err.code || "DOWNLOAD_FAILED",
        error: err.message,
      });
    }
  }
}
