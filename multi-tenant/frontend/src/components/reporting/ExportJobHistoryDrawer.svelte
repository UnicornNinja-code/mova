<!--
  ExportJobHistoryDrawer.svelte
  S7-05-10: Slide-out Drawer for Operational Export Job History & Secure Download
  MOVA Architecture - High-Fidelity UI with Live Status Polling
-->
<script lang="ts">
  import { reportExportStore } from "../../lib/stores/reportExportStore.svelte.js";
  import {
    ReportType,
    ReportFormat,
    ReportJobStatus,
    REPORT_CAPABILITY_REGISTRY,
    type ReportExportJob,
  } from "../../lib/types/reporting.types.js";
  import {
    X,
    RefreshCw,
    Download,
    FileText,
    FileSpreadsheet,
    FileCode,
    AlertTriangle,
    CheckCircle2,
    Clock,
    AlertCircle,
    Layers,
    Sparkles,
  } from "lucide-svelte";

  function getFormatIcon(format: ReportFormat) {
    switch (format) {
      case ReportFormat.PDF:
        return FileText;
      case ReportFormat.XLSX:
        return FileSpreadsheet;
      case ReportFormat.CSV:
        return FileCode;
    }
  }

  function getReportTitle(type: ReportType) {
    return REPORT_CAPABILITY_REGISTRY[type]?.title || type;
  }

  function formatDate(iso: string) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

{#if reportExportStore.isDrawerOpen}
  <!-- Backdrop -->
  <button
    type="button"
    aria-label="Tutup panel riwayat export"
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity w-full h-full border-none cursor-default"
    onclick={() => reportExportStore.closeDrawer()}
  ></button>

  <!-- Drawer Container -->
  <div
    class="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-700/60 shadow-2xl flex flex-col transform transition-transform animate-slide-left"
  >
    <!-- Drawer Header -->
    <div class="px-5 py-4 bg-slate-800/80 border-b border-slate-700/50 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Layers class="w-4 h-4" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-white">Riwayat Export Laporan</h3>
          <p class="text-[11px] text-slate-400">Status job dan unduhan berkas terenkapsulasi</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          onclick={() => reportExportStore.loadHistory()}
          disabled={reportExportStore.isLoadingHistory}
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          title="Segarkan Riwayat"
        >
          <RefreshCw class="w-4 h-4 {reportExportStore.isLoadingHistory ? 'animate-spin text-indigo-400' : ''}" />
        </button>
        <button
          onclick={() => reportExportStore.closeDrawer()}
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          aria-label="Tutup"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Drawer Body / Job List -->
    <div class="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
      {#if reportExportStore.isLoadingHistory && reportExportStore.recentJobs.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
          <div class="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
          <span>Memuat riwayat export...</span>
        </div>
      {:else if reportExportStore.recentJobs.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-center text-slate-400">
          <div class="p-3 rounded-full bg-slate-800 text-slate-500 mb-3">
            <FileText class="w-8 h-8" />
          </div>
          <div class="text-sm font-medium text-slate-300 mb-1">Belum Ada Export Laporan</div>
          <p class="text-xs text-slate-500 max-w-xs mb-4">
            Anda belum pernah membuat job export laporan. Klik tombol di bawah untuk membuat laporan baru.
          </p>
          <button
            onclick={() => {
              reportExportStore.closeDrawer();
              reportExportStore.openExportModal();
            }}
            class="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Buat Export Baru</span>
          </button>
        </div>
      {:else}
        {#each reportExportStore.recentJobs as job (job.id)}
          {@const FormatIcon = getFormatIcon(job.format)}
          <div
            class="p-4 rounded-xl border bg-slate-800/40 border-slate-700/60 hover:border-slate-600 transition-all space-y-3"
          >
            <!-- Job Card Header -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2.5">
                <div class="p-2 rounded-lg bg-slate-800 border border-slate-700 text-indigo-400 mt-0.5">
                  <FormatIcon class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-slate-200">
                    {getReportTitle(job.reportType)}
                  </h4>
                  <div class="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                    <span class="font-mono text-slate-300 font-semibold">{job.format}</span>
                    <span>•</span>
                    <span>{formatDate(job.createdAt)}</span>
                  </div>
                </div>
              </div>

              <!-- Status Badge -->
              {#if job.status === ReportJobStatus.COMPLETED}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 class="w-3 h-3" />
                  SELESAI
                </span>
              {:else if job.status === ReportJobStatus.PROCESSING}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                  <div class="w-2.5 h-2.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></div>
                  PROSES ({job.progress}%)
                </span>
              {:else if job.status === ReportJobStatus.QUEUED}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  ANTRE
                </span>
              {:else if job.status === ReportJobStatus.FAILED}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                  <AlertCircle class="w-3 h-3" />
                  GAGAL
                </span>
              {/if}
            </div>

            <!-- Progress Bar if Processing -->
            {#if job.status === ReportJobStatus.PROCESSING}
              <div class="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                <div
                  class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  style="width: {job.progress}%"
                ></div>
              </div>
            {/if}

            <!-- Truncation Banner -->
            {#if job.truncated}
              <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-1.5">
                <AlertTriangle class="w-3.5 h-3.5 flex-shrink-0" />
                <span>Hasil dibatasi pada hard limit 100.000 baris.</span>
              </div>
            {/if}

            <!-- Error Message if Failed -->
            {#if job.status === ReportJobStatus.FAILED && job.errorMessage}
              <div class="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
                <AlertCircle class="w-3.5 h-3.5 flex-shrink-0" />
                <span>{job.errorMessage}</span>
              </div>
            {/if}

            <!-- Card Footer (Metadata & Actions) -->
            <div class="flex items-center justify-between pt-1 border-t border-slate-700/30 text-[11px] text-slate-400">
              <div>
                {#if job.rowCount !== null}
                  <span>{job.rowCount.toLocaleString("id-ID")} baris data</span>
                {:else}
                  <span>{job.rangeStart.slice(0, 10)} s/d {job.rangeEnd.slice(0, 10)}</span>
                {/if}
              </div>

              <div>
                {#if job.status === ReportJobStatus.COMPLETED}
                  <button
                    onclick={() => reportExportStore.downloadJob(job)}
                    class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Download class="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Drawer Footer -->
    <div class="p-4 bg-slate-800/80 border-t border-slate-700/50">
      <button
        onclick={() => {
          reportExportStore.closeDrawer();
          reportExportStore.openExportModal();
        }}
        class="w-full py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
      >
        <Sparkles class="w-4 h-4" />
        <span>Buat Export Laporan Baru</span>
      </button>
    </div>
  </div>
{/if}
