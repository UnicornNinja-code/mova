<!--
  PresenceTimelineCard.svelte
  S7-03-11: Presence & Compliance Temporal Timeline Timeseries Card
  Visualizes bucketed presence events and geofence compliance distribution over time.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import type { AnalyticsTimelinePoint } from "../../lib/types/analytics.types.js";

  let selectedPoint = $state<AnalyticsTimelinePoint | null>(null);

  const points = $derived(historicalAnalyticsStore.timelinePoints);
  const grain = $derived(historicalAnalyticsStore.selectedGrain);
  const timezone = $derived(historicalAnalyticsStore.selectedTimezone);

  const maxBucketEvents = $derived.by(() => {
    if (points.length === 0) return 1;
    const max = Math.max(...points.map((p) => p.totalEvents));
    return max > 0 ? max : 1;
  });

  const formatBucketLabel = (isoDateStr: string, grain: string): string => {
    try {
      const d = new Date(isoDateStr);
      if (isNaN(d.getTime())) return isoDateStr;

      switch (grain) {
        case "hour":
          return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        case "day":
          return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        case "week":
          return `W-${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`;
        case "month":
          return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
        default:
          return d.toLocaleDateString("id-ID");
      }
    } catch {
      return isoDateStr;
    }
  };
</script>

<div class="bg-[#131316] border border-[#24242A] rounded-3xl p-5 shadow-xl font-outfit-400 space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#202027]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <i class="ri-bar-chart-grouped-line text-base"></i>
      </div>
      <div>
        <h3 class="text-sm font-outfit-600 text-white leading-tight">
          Timeseries Keberadaan & Kepatuhan
        </h3>
        <p class="text-[11px] text-[#A1A1AA]">
          Distribusi volume sinyal terobservasi per bucket <strong class="text-zinc-300 capitalize">{grain}</strong> ({timezone})
        </p>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-3 text-[11px] flex-wrap">
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
        <span class="text-zinc-300">Patuh (Compliant)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
        <span class="text-zinc-300">Deviasi</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
        <span class="text-zinc-300">Di Luar (Outside)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-zinc-600"></span>
        <span class="text-zinc-300">Unassigned</span>
      </div>
    </div>
  </div>

  <!-- Timeseries Chart Body -->
  {#if points.length === 0}
    <div class="py-12 text-center text-xs text-[#71717A] space-y-2">
      <i class="ri-bar-chart-line text-3xl text-zinc-700"></i>
      <p>Tidak ada data timeseries untuk rentang tanggal yang dipilih.</p>
    </div>
  {:else}
    <div class="space-y-4">
      <!-- Bars Grid Container -->
      <div class="h-44 sm:h-52 flex items-end gap-1 sm:gap-2 pt-6 px-2 overflow-x-auto border-b border-[#24242A]">
        {#each points as pt}
          {@const heightPct = Math.max(4, Math.round((pt.totalEvents / maxBucketEvents) * 100))}
          {@const compliantPct = pt.totalEvents > 0 ? (pt.complianceDistribution.compliant / pt.totalEvents) * 100 : 0}
          {@const deviatedPct = pt.totalEvents > 0 ? (pt.complianceDistribution.deviated / pt.totalEvents) * 100 : 0}
          {@const outsidePct = pt.totalEvents > 0 ? (pt.complianceDistribution.outside / pt.totalEvents) * 100 : 0}
          {@const unassignedPct = pt.totalEvents > 0 ? (pt.complianceDistribution.unassigned / pt.totalEvents) * 100 : 0}
          {@const isHovered = selectedPoint === pt}

          <div
            class="flex-1 min-w-[28px] max-w-[56px] h-full flex flex-col justify-end items-center group cursor-pointer relative"
            onmouseenter={() => selectedPoint = pt}
            role="button"
            tabindex="0"
          >
            <!-- Bar Stack -->
            <div
              class="w-full rounded-t-lg overflow-hidden flex flex-col-reverse transition-all duration-200 {isHovered ? 'ring-2 ring-white/60 brightness-110' : 'opacity-90 hover:opacity-100'}"
              style="height: {heightPct}%;"
            >
              <!-- Compliant Segment -->
              <div class="bg-emerald-500" style="height: {compliantPct}%;"></div>
              <!-- Deviated Segment -->
              <div class="bg-rose-500" style="height: {deviatedPct}%;"></div>
              <!-- Outside Segment -->
              <div class="bg-amber-500" style="height: {outsidePct}%;"></div>
              <!-- Unassigned Segment -->
              <div class="bg-zinc-600" style="height: {unassignedPct}%;"></div>
            </div>

            <!-- X-Axis Label -->
            <span class="text-[10px] text-zinc-500 font-mono mt-2 truncate w-full text-center group-hover:text-white">
              {formatBucketLabel(pt.bucketStart, grain)}
            </span>
          </div>
        {/each}
      </div>

      <!-- Interactive Bucket Detail Popover / Callout -->
      {#if selectedPoint}
        <div class="p-3 rounded-2xl bg-[#1A1A20] border border-[#2E2E38] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-[#FF8573] font-outfit-600 font-mono">Bucket: {new Date(selectedPoint.bucketStart).toLocaleString('id-ID')}</span>
            <span class="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px]">
              Total: {selectedPoint.totalEvents} events
            </span>
          </div>
          <div class="flex items-center gap-3 text-[11px]">
            <span class="text-emerald-400">Patuh: <strong>{selectedPoint.complianceDistribution.compliant}</strong></span>
            <span class="text-rose-400">Deviasi: <strong>{selectedPoint.complianceDistribution.deviated}</strong></span>
            <span class="text-amber-400">Outside: <strong>{selectedPoint.complianceDistribution.outside}</strong></span>
            <span class="text-zinc-400">Unassigned: <strong>{selectedPoint.complianceDistribution.unassigned}</strong></span>
            <span class="text-white font-outfit-600 pl-2 border-l border-zinc-700">
              Rate: <strong class="text-emerald-300">{selectedPoint.complianceRate !== null ? `${selectedPoint.complianceRate}%` : 'N/A'}</strong>
            </span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
