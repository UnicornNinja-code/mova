<!--
  AnalyticsHeader.svelte
  S7-03-11: Header component for Historical Operational Analytics Dashboard
  Displays title, tenant context, active timezone, last sync timestamp, and refresh action.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import { reportExportStore } from "../../lib/stores/reportExportStore.svelte.js";
  import { authStore } from "../../lib/stores/auth.svelte.js";

  interface Props {
    onRefresh?: () => void;
  }

  let { onRefresh }: Props = $props();

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    } else {
      await historicalAnalyticsStore.fetchAll();
    }
  };

  const handleOpenExport = () => {
    reportExportStore.openExportModal({
      rangeStart: historicalAnalyticsStore.rangeStart,
      rangeEnd: historicalAnalyticsStore.rangeEnd,
    });
  };

  const formattedLastSync = $derived.by(() => {
    if (!historicalAnalyticsStore.lastFetchedAt) return "Belum disinkronisasi";
    const d = new Date(historicalAnalyticsStore.lastFetchedAt);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });

  const activeExportsCount = $derived.by(() => {
    return reportExportStore.activeJobs.filter((j) => j.polling).length;
  });
</script>

<header class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#24242A]">
  <!-- Left Title & Description -->
  <div class="space-y-1.5">
    <div class="flex items-center gap-2.5 flex-wrap">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center text-[#09090B] shadow-md shadow-[#FF634A]/20 shrink-0">
        <i class="ri-history-fill text-lg font-bold"></i>
      </div>
      <h1 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
        Historical Operational Analytics
      </h1>
      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-[#1A1A20] text-[#FF8573] border border-[#2E2E38]">
        v4.2.0 Pipeline
      </span>
      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-zinc-900 text-zinc-400 border border-zinc-800">
        Role: {authStore.user?.role || "SUPERADMIN"}
      </span>
    </div>
    <p class="text-xs text-[#A1A1AA] leading-relaxed max-w-2xl">
      Observasi rekaman historis kehadiran rider, distribusi kepatuhan geofence, episode deviasi deterministik, serta perbandingan periode tanpa fabrikasi data sintetis.
    </p>
  </div>

  <!-- Right Actions & Meta Indicators -->
  <div class="flex items-center gap-2.5 shrink-0 self-start md:self-auto flex-wrap">
    <!-- Timezone Badge -->
    <div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#16161A] border border-[#272730] text-xs text-[#A1A1AA]">
      <i class="ri-time-line text-[#FF634A]"></i>
      <span class="font-mono text-[11px] text-zinc-300">{historicalAnalyticsStore.selectedTimezone}</span>
    </div>

    <!-- Last Updated Status -->
    <div class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#16161A] border border-[#272730] text-xs text-[#A1A1AA]">
      <span class="w-2 h-2 rounded-full {historicalAnalyticsStore.isRefreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}"></span>
      <span class="text-[11px]">Sync: <strong class="text-white font-mono">{formattedLastSync}</strong></span>
    </div>

    <!-- Export History Trigger Button -->
    <button
      type="button"
      onclick={() => reportExportStore.openDrawer()}
      class="relative flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-outfit-600 text-zinc-300 bg-[#1A1A20] hover:bg-[#23232A] active:scale-95 border border-[#272730] transition-all cursor-pointer shadow-xs"
      title="Buka riwayat export laporan"
    >
      <i class="ri-folder-download-line text-base text-indigo-400"></i>
      <span class="hidden sm:inline">Riwayat</span>
      {#if activeExportsCount > 0}
        <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white animate-pulse">
          {activeExportsCount}
        </span>
      {/if}
    </button>

    <!-- Export Report Trigger Button -->
    <button
      type="button"
      onclick={handleOpenExport}
      class="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-outfit-600 text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
      title="Export data laporan operasional (CSV / XLSX / PDF)"
    >
      <i class="ri-file-download-line text-base"></i>
      <span>Export Laporan</span>
    </button>

    <!-- Refresh Button -->
    <button
      type="button"
      onclick={handleRefresh}
      disabled={historicalAnalyticsStore.isInitialLoading || historicalAnalyticsStore.isRefreshing}
      class="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-outfit-600 text-white bg-[#1A1A20] hover:bg-[#23232A] active:scale-95 border border-[#272730] transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
      title="Sinkronisasi ulang seluruh data analitik historis"
    >
      <i class="ri-refresh-line text-base text-[#FF634A] {historicalAnalyticsStore.isRefreshing ? 'animate-spin' : ''}"></i>
      <span class="hidden sm:inline">{historicalAnalyticsStore.isRefreshing ? 'Memuat...' : 'Refresh'}</span>
    </button>
  </div>
</header>
