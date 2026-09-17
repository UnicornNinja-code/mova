<!--
  ExportReportModal.svelte
  S7-05-10: Operational Report Export Configuration & Async Initiation Modal
  MOVA Architecture - High-Fidelity UI with Glassmorphism
-->
<script lang="ts">
  import { reportExportStore } from "../../lib/stores/reportExportStore.svelte.js";
  import {
    ReportType,
    ReportFormat,
    REPORT_CAPABILITY_REGISTRY,
    REPORT_GOVERNANCE,
    isExecutableReportType,
  } from "../../lib/types/reporting.types.js";
  import {
    FileText,
    FileSpreadsheet,
    FileCode,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    Clock,
    X,
    Layers,
    ShieldAlert,
    Sparkles,
  } from "lucide-svelte";

  // Local form state
  let selectedType = $state<ReportType>(
    reportExportStore.modalInitialReportType || ReportType.PRESENCE_COMPLIANCE_REPORT
  );
  let selectedFormat = $state<ReportFormat>(ReportFormat.PDF);
  let startDate = $state<string>("");
  let endDate = $state<string>("");
  let timezone = $state<string>(REPORT_GOVERNANCE.DEFAULT_TIMEZONE);
  let validationError = $state<string | null>(null);

  // Sync with store initial values when modal opens
  $effect(() => {
    if (reportExportStore.isModalOpen) {
      selectedType = reportExportStore.modalInitialReportType || ReportType.PRESENCE_COMPLIANCE_REPORT;
      if (reportExportStore.modalInitialRangeStart) {
        startDate = reportExportStore.modalInitialRangeStart.slice(0, 10);
      } else {
        // Default to last 7 days
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 86400000);
        startDate = start.toISOString().slice(0, 10);
        endDate = end.toISOString().slice(0, 10);
      }
      if (reportExportStore.modalInitialRangeEnd) {
        endDate = reportExportStore.modalInitialRangeEnd.slice(0, 10);
      }
    }
  });

  // Calculate day difference and early validate
  let daysDiff = $derived.by(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
  });

  $effect(() => {
    if (!startDate || !endDate) {
      validationError = "Silakan pilih rentang tanggal laporan.";
    } else if (new Date(startDate) >= new Date(endDate)) {
      validationError = "Tanggal awal harus lebih awal dari tanggal akhir.";
    } else if (daysDiff > REPORT_GOVERNANCE.MAX_RANGE_DAYS) {
      validationError = `Rentang tanggal melebihi batas maksimal ${REPORT_GOVERNANCE.MAX_RANGE_DAYS} hari (${daysDiff} hari dipilih).`;
    } else {
      validationError = null;
    }
  });

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    startDate = start.toISOString().slice(0, 10);
    endDate = end.toISOString().slice(0, 10);
  }

  async function handleSubmit() {
    if (validationError || !isExecutableReportType(selectedType)) return;

    const rangeStart = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`).toISOString();

    await reportExportStore.submitExportJob({
      reportType: selectedType,
      format: selectedFormat,
      rangeStart,
      rangeEnd,
      timezone,
      zoneId: reportExportStore.modalInitialZoneId,
      riderId: reportExportStore.modalInitialRiderId,
    });
  }
</script>

{#if reportExportStore.isModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
    <div
      class="relative w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/50">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">Export Laporan Operasional</h2>
            <p class="text-xs text-slate-400">Asynchronous report engine dengan tata kelola resource baku</p>
          </div>
        </div>
        <button
          onclick={() => reportExportStore.closeExportModal()}
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body Form -->
      <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
        <!-- 1. Report Type Selection -->
        <div class="space-y-3">
          <label class="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers class="w-4 h-4 text-indigo-400" />
            Pilih Jenis Laporan
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {#each Object.values(REPORT_CAPABILITY_REGISTRY) as spec}
              {@const isReady = spec.availability === "READY"}
              {@const isSelected = selectedType === spec.reportType}
              <button
                type="button"
                disabled={!isReady}
                onclick={() => { if (isReady) selectedType = spec.reportType; }}
                class="relative text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between {
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                    : isReady
                    ? 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                    : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'
                }"
              >
                <div>
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-medium text-sm {isSelected ? 'text-indigo-300' : isReady ? 'text-slate-200' : 'text-slate-500'}">
                      {spec.title}
                    </span>
                    {#if isReady}
                      <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        READY
                      </span>
                    {:else}
                      <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        DEFERRED
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs text-slate-400 line-clamp-2">
                    {spec.description}
                  </p>
                </div>
                {#if !isReady && spec.deferredReason}
                  <div class="mt-2 text-[11px] text-amber-400/90 flex items-center gap-1.5 bg-amber-500/5 p-1.5 rounded-lg border border-amber-500/10">
                    <AlertTriangle class="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{spec.deferredReason}</span>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- 2. Export Format Selection -->
        <div class="space-y-3">
          <label class="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <FileText class="w-4 h-4 text-indigo-400" />
            Format Berkas
          </label>
          <div class="grid grid-cols-3 gap-3">
            <button
              type="button"
              onclick={() => (selectedFormat = ReportFormat.PDF)}
              class="p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2 {
                selectedFormat === ReportFormat.PDF
                  ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }"
            >
              <FileText class="w-6 h-6 text-rose-400" />
              <div>
                <div class="text-sm font-semibold">PDF</div>
                <div class="text-[11px] text-slate-400">Ringkasan Eksekutif A4</div>
              </div>
            </button>

            <button
              type="button"
              onclick={() => (selectedFormat = ReportFormat.XLSX)}
              class="p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2 {
                selectedFormat === ReportFormat.XLSX
                  ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }"
            >
              <FileSpreadsheet class="w-6 h-6 text-emerald-400" />
              <div>
                <div class="text-sm font-semibold">Excel (XLSX)</div>
                <div class="text-[11px] text-slate-400">Multi-Sheet Workbook</div>
              </div>
            </button>

            <button
              type="button"
              onclick={() => (selectedFormat = ReportFormat.CSV)}
              class="p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2 {
                selectedFormat === ReportFormat.CSV
                  ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }"
            >
              <FileCode class="w-6 h-6 text-cyan-400" />
              <div>
                <div class="text-sm font-semibold">CSV</div>
                <div class="text-[11px] text-slate-400">Streaming RFC 4180</div>
              </div>
            </button>
          </div>
        </div>

        <!-- 3. Date Range Selection & Presets -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar class="w-4 h-4 text-indigo-400" />
              Rentang Waktu Laporan (Maks. 90 Hari)
            </label>
            <div class="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onclick={() => applyPreset(7)}
                class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                7 Hari
              </button>
              <button
                type="button"
                onclick={() => applyPreset(30)}
                class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                30 Hari
              </button>
              <button
                type="button"
                onclick={() => applyPreset(90)}
                class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                90 Hari
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span class="block text-xs text-slate-400 mb-1">Tanggal Mulai</span>
              <input
                type="date"
                bind:value={startDate}
                class="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <span class="block text-xs text-slate-400 mb-1">Tanggal Selesai</span>
              <input
                type="date"
                bind:value={endDate}
                class="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <!-- Early UX Validation Message -->
          {#if validationError}
            <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle class="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          {/if}
        </div>

        <!-- 4. Governance Limit Notice -->
        <div class="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-400 space-y-1.5">
          <div class="font-medium text-slate-300 flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-indigo-400" />
            Aturan Resource Governor
          </div>
          <ul class="list-disc list-inside space-y-0.5 text-[11px]">
            <li>Maksimal 2 proses export aktif per tenant dalam satu waktu.</li>
            <li>Hasil dibatasi hard limit 100.000 baris dengan flag pemotongan otomatis.</li>
            <li>Berkas laporan disimpan selama 24 jam sebelum pembersihan otomatis.</li>
          </ul>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 bg-slate-800/80 border-t border-slate-700/50 flex items-center justify-between">
        <button
          type="button"
          onclick={() => {
            reportExportStore.closeExportModal();
            reportExportStore.openDrawer();
          }}
          class="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Lihat Riwayat Export →
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => reportExportStore.closeExportModal()}
            class="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!!validationError || reportExportStore.isSubmitting || !isExecutableReportType(selectedType)}
            onclick={handleSubmit}
            class="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            {#if reportExportStore.isSubmitting}
              <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Memproses...</span>
            {:else}
              <Sparkles class="w-3.5 h-3.5" />
              <span>Inisiasi Export</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
