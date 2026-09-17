<!--
  ComplianceDistributionCard.svelte
  S7-03-11: Geofence Compliance Distribution & Presence Event Breakdown Card
  Presents compliance categories and physical transition event counters with zero fake math.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";

  const metrics = $derived(historicalAnalyticsStore.summaryMetrics);

  const total = $derived(metrics.totalEvents);
  const compliant = $derived(metrics.compliantEvents);
  const deviated = $derived(metrics.deviatedEvents);
  const outside = $derived(metrics.outsideEvents);
  const unassigned = $derived(metrics.unassignedEvents);

  const compliantPct = $derived(total > 0 ? ((compliant / total) * 100).toFixed(1) : "0.0");
  const deviatedPct = $derived(total > 0 ? ((deviated / total) * 100).toFixed(1) : "0.0");
  const outsidePct = $derived(total > 0 ? ((outside / total) * 100).toFixed(1) : "0.0");
  const unassignedPct = $derived(total > 0 ? ((unassigned / total) * 100).toFixed(1) : "0.0");
</script>

<div class="bg-[#131316] border border-[#24242A] rounded-3xl p-5 shadow-xl font-outfit-400 space-y-4">
  <!-- Card Header -->
  <div class="flex items-center gap-2.5 pb-3 border-b border-[#202027]">
    <div class="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
      <i class="ri-pie-chart-2-line text-base"></i>
    </div>
    <div>
      <h3 class="text-sm font-outfit-600 text-white leading-tight">
        Distribusi Kepatuhan Geofence
      </h3>
      <p class="text-[11px] text-[#A1A1AA]">
        Klasifikasi posisi rider terhadap penugasan zona operasional aktif
      </p>
    </div>
  </div>

  <!-- Proportional Stacked Bar -->
  <div class="space-y-1.5">
    <div class="h-3.5 w-full bg-[#1A1A20] rounded-full overflow-hidden flex p-0.5 border border-[#272730]">
      {#if total > 0}
        <div class="bg-emerald-500 rounded-l-full transition-all duration-300" style="width: {compliantPct}%;" title="Patuh: {compliant} ({compliantPct}%)"></div>
        <div class="bg-rose-500 transition-all duration-300" style="width: {deviatedPct}%;" title="Deviasi: {deviated} ({deviatedPct}%)"></div>
        <div class="bg-amber-500 transition-all duration-300" style="width: {outsidePct}%;" title="Outside: {outside} ({outsidePct}%)"></div>
        <div class="bg-zinc-600 rounded-r-full transition-all duration-300" style="width: {unassignedPct}%;" title="Unassigned: {unassigned} ({unassignedPct}%)"></div>
      {:else}
        <div class="w-full h-full bg-zinc-800 rounded-full"></div>
      {/if}
    </div>
    <div class="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
      <span>0%</span>
      <span>Denominator Evaluasi: {metrics.eligibleEventsCount} events</span>
      <span>100%</span>
    </div>
  </div>

  <!-- Breakdown Cards Grid -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
    <!-- Compliant -->
    <div class="p-3 rounded-2xl bg-[#18181E] border border-emerald-950/40 space-y-1">
      <div class="flex items-center gap-1.5 text-[11px] text-emerald-400 font-outfit-600">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>Patuh (Compliant)</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-base font-outfit-600 font-bold text-white">{compliant}</span>
        <span class="text-[11px] font-mono text-emerald-400">{compliantPct}%</span>
      </div>
    </div>

    <!-- Deviated -->
    <div class="p-3 rounded-2xl bg-[#18181E] border border-rose-950/40 space-y-1">
      <div class="flex items-center gap-1.5 text-[11px] text-rose-400 font-outfit-600">
        <span class="w-2 h-2 rounded-full bg-rose-500"></span>
        <span>Deviasi (Deviated)</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-base font-outfit-600 font-bold text-white">{deviated}</span>
        <span class="text-[11px] font-mono text-rose-400">{deviatedPct}%</span>
      </div>
    </div>

    <!-- Outside -->
    <div class="p-3 rounded-2xl bg-[#18181E] border border-amber-950/40 space-y-1">
      <div class="flex items-center gap-1.5 text-[11px] text-amber-400 font-outfit-600">
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>Di Luar Zona</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-base font-outfit-600 font-bold text-white">{outside}</span>
        <span class="text-[11px] font-mono text-amber-400">{outsidePct}%</span>
      </div>
    </div>

    <!-- Unassigned -->
    <div class="p-3 rounded-2xl bg-[#18181E] border border-zinc-800 space-y-1">
      <div class="flex items-center gap-1.5 text-[11px] text-zinc-400 font-outfit-600">
        <span class="w-2 h-2 rounded-full bg-zinc-600"></span>
        <span>Tanpa Tugas</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-base font-outfit-600 font-bold text-white">{unassigned}</span>
        <span class="text-[11px] font-mono text-zinc-400">{unassignedPct}%</span>
      </div>
    </div>
  </div>

  <!-- Physical Transition Events Breakdown (ENTER, EXIT, ON_SITE, OUTSIDE_ZONE, DEVIATED) -->
  <div class="pt-3 border-t border-[#202027] space-y-2">
    <span class="text-[11px] font-outfit-600 text-zinc-400 uppercase tracking-wider block">
      Event Transisi Geofence
    </span>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <div class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-zinc-300">
        ENTER: <strong class="text-white font-mono">{metrics.presenceEventTypes.ENTER}</strong>
      </div>
      <div class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-zinc-300">
        EXIT: <strong class="text-white font-mono">{metrics.presenceEventTypes.EXIT}</strong>
      </div>
      <div class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-zinc-300">
        ON_SITE: <strong class="text-white font-mono">{metrics.presenceEventTypes.ON_SITE}</strong>
      </div>
      <div class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-zinc-300">
        OUTSIDE_ZONE: <strong class="text-white font-mono">{metrics.presenceEventTypes.OUTSIDE_ZONE}</strong>
      </div>
      <div class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-zinc-300">
        DEVIATED: <strong class="text-white font-mono">{metrics.presenceEventTypes.DEVIATED}</strong>
      </div>
    </div>
  </div>
</div>
