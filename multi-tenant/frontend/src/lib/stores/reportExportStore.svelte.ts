/*
 * reportExportStore.svelte.ts
 * S7-05-10: Frontend Operational Reporting Reactive Store (Svelte 5 Runes)
 * 
 * Strict Invariants:
 * 1. Lifecycle Management: Coordinates async submission, bounded polling, and notifications.
 * 2. Backend Authority: Never fabricates state transitions, calculations, or internal paths.
 * 3. Non-Blocking UX: User can close modals while export jobs poll safely in background.
 * 4. Error Resilience: Graceful failure handling with explicit user toasts and error messages.
 */

import { reportExportService } from "../../services/reportExportService.js";
import { toast } from "./toast.svelte.js";
import {
  ReportType,
  ReportFormat,
  ReportJobStatus,
  type ReportExportJob,
  type CreateExportJobRequest,
  type ExportJobHistoryQuery,
} from "../types/reporting.types.js";

export interface ActiveJobItem {
  id: string;
  job: ReportExportJob;
  downloadUrl: string | null;
  polling: boolean;
  abortController: AbortController;
}

export class ReportExportStore {
  // --------------------------------------------------------------------------
  // 1. Reactive UI State
  // --------------------------------------------------------------------------
  isModalOpen = $state<boolean>(false);
  isDrawerOpen = $state<boolean>(false);
  isSubmitting = $state<boolean>(false);
  isLoadingHistory = $state<boolean>(false);

  // Prepopulated options for modal
  modalInitialReportType = $state<ReportType>(ReportType.PRESENCE_COMPLIANCE_REPORT);
  modalInitialRangeStart = $state<string>("");
  modalInitialRangeEnd = $state<string>("");
  modalInitialZoneId = $state<string | undefined>(undefined);
  modalInitialRiderId = $state<string | undefined>(undefined);

  // --------------------------------------------------------------------------
  // 2. Active Jobs & History State
  // --------------------------------------------------------------------------
  activeJobs = $state<ActiveJobItem[]>([]);
  recentJobs = $state<ReportExportJob[]>([]);
  totalJobs = $state<number>(0);

  // --------------------------------------------------------------------------
  // 3. Modal & Drawer Controls
  // --------------------------------------------------------------------------
  openExportModal(options?: {
    reportType?: ReportType;
    rangeStart?: string;
    rangeEnd?: string;
    zoneId?: string;
    riderId?: string;
  }) {
    if (options?.reportType) this.modalInitialReportType = options.reportType;
    if (options?.rangeStart) this.modalInitialRangeStart = options.rangeStart;
    if (options?.rangeEnd) this.modalInitialRangeEnd = options.rangeEnd;
    this.modalInitialZoneId = options?.zoneId;
    this.modalInitialRiderId = options?.riderId;
    this.isModalOpen = true;
  }

  closeExportModal() {
    this.isModalOpen = false;
  }

  openDrawer() {
    this.isDrawerOpen = true;
    this.loadHistory();
  }

  closeDrawer() {
    this.isDrawerOpen = false;
  }

  // --------------------------------------------------------------------------
  // 4. History Loading
  // --------------------------------------------------------------------------
  async loadHistory(query?: ExportJobHistoryQuery) {
    this.isLoadingHistory = true;
    try {
      const res = await reportExportService.listExportJobs({ limit: 20, ...query });
      this.recentJobs = res.jobs || [];
      this.totalJobs = res.total || 0;
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat riwayat export laporan.");
    } finally {
      this.isLoadingHistory = false;
    }
  }

  // --------------------------------------------------------------------------
  // 5. Submit Export Job & Start Background Polling
  // --------------------------------------------------------------------------
  async submitExportJob(payload: CreateExportJobRequest): Promise<ReportExportJob | null> {
    this.isSubmitting = true;
    try {
      const res = await reportExportService.createExportJob(payload);
      const createdJob = res.job;

      toast.info(`Job export '${createdJob.reportType}' berhasil dibuat. Memproses di background...`);
      this.closeExportModal();

      // Create tracking item with abort controller
      const abortController = new AbortController();
      const activeItem: ActiveJobItem = {
        id: createdJob.id,
        job: createdJob,
        downloadUrl: null,
        polling: true,
        abortController,
      };

      this.activeJobs = [activeItem, ...this.activeJobs];
      this.loadHistory();

      // Start background bounded polling
      this.pollJob(createdJob.id, abortController);

      return createdJob;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Gagal menginisiasi export job.");
      return null;
    } finally {
      this.isSubmitting = false;
    }
  }

  // --------------------------------------------------------------------------
  // 6. Background Polling Execution
  // --------------------------------------------------------------------------
  private async pollJob(jobId: string, abortController: AbortController) {
    try {
      const finalRes = await reportExportService.pollUntilReady(jobId, {
        signal: abortController.signal,
        onProgress: (updatedJob) => {
          // Update active job state
          const index = this.activeJobs.findIndex((item) => item.id === jobId);
          if (index !== -1) {
            this.activeJobs[index].job = updatedJob;
          }
          // Update recent jobs list if item exists there
          const historyIndex = this.recentJobs.findIndex((j) => j.id === jobId);
          if (historyIndex !== -1) {
            this.recentJobs[historyIndex] = updatedJob;
          }
        },
      });

      // Polling completed successfully
      const index = this.activeJobs.findIndex((item) => item.id === jobId);
      if (index !== -1) {
        this.activeJobs[index].job = finalRes.job;
        this.activeJobs[index].downloadUrl = finalRes.downloadUrl;
        this.activeJobs[index].polling = false;
      }

      toast.success(
        `Laporan '${finalRes.job.reportType}' (${finalRes.job.format}) siap diunduh!`,
        8000
      );

      this.loadHistory();
    } catch (err: any) {
      if (abortController.signal.aborted) return;

      const index = this.activeJobs.findIndex((item) => item.id === jobId);
      if (index !== -1) {
        this.activeJobs[index].polling = false;
        this.activeJobs[index].job.status = ReportJobStatus.FAILED;
        this.activeJobs[index].job.errorMessage = err.message;
      }

      toast.error(`Export gagal: ${err.message || "Gagal memproses laporan."}`);
      this.loadHistory();
    }
  }

  // --------------------------------------------------------------------------
  // 7. Secure Download Trigger
  // --------------------------------------------------------------------------
  async downloadJob(job: ReportExportJob) {
    try {
      toast.info(`Mengunduh laporan '${job.reportType}'...`);
      const ext = job.format.toLowerCase();
      const filename = `${job.reportType.toLowerCase()}_${job.rangeStart.slice(0, 10)}_${job.rangeEnd.slice(0, 10)}.${ext}`;
      await reportExportService.downloadArtifact(job.id, filename);
      toast.success("File laporan berhasil diunduh.");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Gagal mengunduh file laporan.");
    }
  }

  // --------------------------------------------------------------------------
  // 8. Cancel Active Polling
  // --------------------------------------------------------------------------
  cancelPolling(jobId: string) {
    const item = this.activeJobs.find((j) => j.id === jobId);
    if (item) {
      item.abortController.abort();
      item.polling = false;
    }
  }
}

export const reportExportStore = new ReportExportStore();
