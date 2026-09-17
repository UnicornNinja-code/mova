/*
 * reportExportService.ts
 * S7-05-10: Frontend Operational Reporting & Asynchronous Export REST Service
 * Exclusive Client Gateway for OpenAPI v4.2.0 Reporting Endpoints (/api/reports/export/*)
 * 
 * Strict Invariants:
 * 1. Consumes exclusively canonical backend endpoints (/reports/export/*).
 * 2. Authenticated session token injected automatically via axiosInstance.
 * 3. Bounded polling lifecycle with exponential backoff & timeout guard.
 * 4. Never fabricates fake metrics, state transitions, or internal filesystem paths.
 */

import { axiosInstance } from "../lib/axios.js";
import type {
  CreateExportJobRequest,
  CreateExportJobResponse,
  ExportJobStatusResponse,
  ExportJobListResponse,
  ExportJobHistoryQuery,
  ReportExportJob,
} from "../lib/types/reporting.types.js";

export interface PollOptions {
  onProgress?: (job: ReportExportJob) => void;
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
  maxDurationMs?: number;
  signal?: AbortSignal;
}

export const reportExportService = {
  /**
   * POST /api/reports/export
   * Initiates an asynchronous report export job (HTTP 202 Accepted)
   */
  createExportJob: async (payload: CreateExportJobRequest): Promise<CreateExportJobResponse> => {
    const res = await axiosInstance.post("/reports/export", payload);
    return res.data?.data || res.data;
  },

  /**
   * GET /api/reports/export/:id
   * Queries status, progress (0..100), and downloadUrl of an export job
   */
  getExportJobStatus: async (id: string): Promise<ExportJobStatusResponse> => {
    const res = await axiosInstance.get(`/reports/export/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * GET /api/reports/export
   * Fetches paginated export job history for authenticated tenant
   */
  listExportJobs: async (query?: ExportJobHistoryQuery): Promise<ExportJobListResponse> => {
    const res = await axiosInstance.get("/reports/export", { params: query });
    return res.data?.data || res.data;
  },

  /**
   * GET /api/reports/export/:id/download
   * Secure, authenticated binary file download via browser blob
   */
  downloadArtifact: async (id: string, fallbackFilename?: string): Promise<void> => {
    const res = await axiosInstance.get(`/reports/export/${id}/download`, {
      responseType: "blob",
      skipGlobalToast: true,
    } as any);

    // Extract filename from Content-Disposition header if available
    let filename = fallbackFilename || `report_${id}`;
    const disposition = res.headers["content-disposition"] || res.headers["Content-Disposition"];
    if (disposition) {
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    // Trigger browser file download
    const blob = new Blob([res.data], {
      type: (res.headers["content-type"] as string) || "application/octet-stream",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * pollUntilReady: Bounded exponential backoff poller
   * Safely polls job status until COMPLETED, FAILED, timeout, or abort
   */
  pollUntilReady: async (
    id: string,
    options: PollOptions = {}
  ): Promise<ExportJobStatusResponse> => {
    const initialInterval = options.initialIntervalMs ?? 1000;
    const maxInterval = options.maxIntervalMs ?? 5000;
    const backoff = options.backoffFactor ?? 1.3;
    const maxDuration = options.maxDurationMs ?? 180000; // 3 minutes timeout

    let currentInterval = initialInterval;
    const startTime = Date.now();

    while (true) {
      if (options.signal?.aborted) {
        throw new Error("Export polling aborted by user.");
      }

      if (Date.now() - startTime > maxDuration) {
        throw new Error(`Report generation timed out after ${Math.round(maxDuration / 1000)}s.`);
      }

      const statusRes = await reportExportService.getExportJobStatus(id);
      const job = statusRes.job;

      if (options.onProgress && job) {
        options.onProgress(job);
      }

      if (job.status === "COMPLETED") {
        return statusRes;
      }

      if (job.status === "FAILED") {
        throw new Error(job.errorMessage || "Report generation failed on server.");
      }

      // Wait for current interval with abort signal support
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, currentInterval);
        if (options.signal) {
          options.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("Export polling aborted."));
          }, { once: true });
        }
      });

      // Increase interval with exponential backoff capped at maxInterval
      currentInterval = Math.min(currentInterval * backoff, maxInterval);
    }
  },
};
