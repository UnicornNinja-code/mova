<!--
  AnalyticsStateAlerts.svelte
  S7-03-11: Resilient Error & Empty State Indicators for Analytics Dashboard
  Clearly isolates PARTIAL_ERROR, API_ERROR, and NO_DATA states.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";

  const hasPartialError = $derived(historicalAnalyticsStore.hasPartialError);
  const resourceErrors = $derived(historicalAnalyticsStore.resourceErrors);
  const hasData = $derived(historicalAnalyticsStore.hasData);
  const isInitialLoading = $derived(historicalAnalyticsStore.isInitialLoading);

  const failedResources = $derived.by(() => {
    const list: Array<{ key: string; label: string; error: string }> = [];
    if (resourceErrors.summary) list.push({ key: "summary", label: "Presence Summary", error: resourceErrors.summary });
    if (resourceErrors.timeline) list.push({ key: "timeline", label: "Timeseries Timeline", error: resourceErrors.timeline });
    if (resourceErrors.deviations) list.push({ key: "deviations", label: "Deviation Episodes", error: resourceErrors.deviations });
    if (resourceErrors.zones) list.push({ key: "zones", label: "Zone Analytics", error: resourceErrors.zones });
    if (resourceErrors.riders) list.push({ key: "riders", label: "Rider Analytics", error: resourceErrors.riders });
    if (resourceErrors.comparison) list.push({ key: "comparison", label: "Period Comparison", error: resourceErrors.comparison });
    return list;
  });

  const retryFailed = async () => {
    await historicalAnalyticsStore.fetchAll();
  };
</script>

<!-- 1. PARTIAL ERROR WARNING BANNER -->
{#if hasPartialError && failedResources.length > 0}
  <div class="p-4 rounded-3xl bg-amber-950/40 border border-amber-800/40 text-xs font-outfit-400 space-y-2">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-amber-400 font-outfit-600">
        <i class="ri-alert-line text-base"></i>
        <span>Peringatan: Sebagian Endpoint Analitik Mengalami Kendala</span>
      </div>
      <button
        type="button"
        onclick={retryFailed}
        class="px-3 py-1 rounded-xl text-[11px] font-outfit-600 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors cursor-pointer"
      >
        Coba Muat Ulang
      </button>
    </div>
    <div class="space-y-1 text-[11px] text-amber-200/80">
      {#each failedResources as item}
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span><strong>{item.label}:</strong> {item.error}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- 2. NO DATA NOTICE (WHEN API IS HEALTHY BUT DATASET IS EMPTY) -->
{#if !isInitialLoading && !hasData && !hasPartialError}
  <div class="p-8 rounded-3xl bg-[#131316] border border-[#24242A] text-center space-y-3 font-outfit-400">
    <div class="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center mx-auto text-2xl">
      <i class="ri-inbox-2-line"></i>
    </div>
    <div class="space-y-1">
      <h4 class="text-sm font-outfit-600 text-white">Tidak Ada Rekaman Keberadaan Operasional</h4>
      <p class="text-xs text-[#A1A1AA] max-w-md mx-auto">
        Tidak ada event sinyal GPS, geofence check-in, atau episode deviasi yang terdeteksi pada rentang waktu ini. Coba pilih rentang preset yang lebih luas (misalnya 30 Hari).
      </p>
    </div>
  </div>
{/if}
