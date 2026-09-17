<!--
  RiderAnalyticsTable.svelte
  S7-03-11: Rider Historical Operational Performance Table
  Presents deterministic rider rankings with active days, observed zones, events, and compliance.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import type { RiderAnalyticsMetrics } from "../../lib/types/analytics.types.js";

  let searchQuery = $state<string>("");

  const riders = $derived(historicalAnalyticsStore.riderRankings);

  const filteredRiders = $derived.by((): RiderAnalyticsMetrics[] => {
    if (!searchQuery.trim()) return riders;
    const q = searchQuery.toLowerCase();
    return riders.filter(
      (r) =>
        (r.riderName && r.riderName.toLowerCase().includes(q)) ||
        r.riderId.toLowerCase().includes(q)
    );
  });
</script>

<div class="bg-[#131316] border border-[#24242A] rounded-3xl p-5 shadow-xl font-outfit-400 space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#202027]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
        <i class="ri-user-star-line text-base"></i>
      </div>
      <div>
        <h3 class="text-sm font-outfit-600 text-white leading-tight">
          Performa Historis Rider
        </h3>
        <p class="text-[11px] text-[#A1A1AA]">
          Hari dinas aktif, diversifikasi zona, dan konsistensi kepatuhan geofence per rider
        </p>
      </div>
    </div>

    <!-- Search Input -->
    <div class="w-full sm:w-64 relative">
      <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs"></i>
      <input
        type="text"
        placeholder="Cari nama rider..."
        bind:value={searchQuery}
        class="w-full pl-8 pr-3 py-1.5 text-xs bg-[#1A1A20] border border-[#272730] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]"
      />
    </div>
  </div>

  <!-- Table -->
  {#if filteredRiders.length === 0}
    <div class="py-8 text-center text-xs text-[#71717A] space-y-1.5">
      <i class="ri-user-unfollow-line text-2xl text-zinc-700"></i>
      <p>{riders.length === 0 ? "Tidak ada rekaman rider aktif pada rentang waktu ini." : "Tidak ada rider yang cocok dengan pencarian."}</p>
    </div>
  {:else}
    <div class="overflow-x-auto max-h-80 pr-1">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="sticky top-0 bg-[#131316] text-[11px] font-outfit-600 text-zinc-400 border-b border-[#24242A]">
          <tr>
            <th class="py-2.5 px-3 w-10">#</th>
            <th class="py-2.5 px-3">Nama Rider</th>
            <th class="py-2.5 px-3 text-center">Hari Aktif</th>
            <th class="py-2.5 px-3 text-center">Zona Diamati</th>
            <th class="py-2.5 px-3 text-right">Total Event</th>
            <th class="py-2.5 px-3">Tingkat Kepatuhan</th>
            <th class="py-2.5 px-3 text-right">Deviasi Event</th>
            <th class="py-2.5 px-3 text-right">Episode</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1D1D24]">
          {#each filteredRiders as r, idx}
            <tr class="hover:bg-[#1A1A20] transition-colors">
              <!-- Rank -->
              <td class="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">{idx + 1}</td>

              <!-- Rider Name -->
              <td class="py-2.5 px-3">
                <div class="font-outfit-600 text-white">{r.riderName || r.riderId}</div>
                <div class="text-[10px] text-zinc-500 font-mono">{r.riderId}</div>
              </td>

              <!-- Active Observed Days -->
              <td class="py-2.5 px-3 text-center font-mono text-zinc-300">
                <span class="px-2 py-0.5 rounded-md bg-[#1A1A20] border border-[#262630]">
                  {r.observedDays} hari
                </span>
              </td>

              <!-- Affected Distinct Zones -->
              <td class="py-2.5 px-3 text-center font-mono text-zinc-300">
                {r.affectedZones} zona
              </td>

              <!-- Total Events -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-300">
                {r.totalEvents}
              </td>

              <!-- Compliance Rate with Progress Bar -->
              <td class="py-2.5 px-3">
                <div class="flex items-center gap-2">
                  <div class="w-20 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    {#if r.complianceRate !== null}
                      <div
                        class="bg-emerald-500 h-full rounded-full"
                        style="width: {Math.min(100, Math.max(0, r.complianceRate))}%;"
                      ></div>
                    {/if}
                  </div>
                  <span class="font-mono text-[11px] {r.complianceRate !== null ? 'text-emerald-400 font-bold' : 'text-zinc-500'}">
                    {r.complianceRate !== null ? `${r.complianceRate}%` : 'N/A'}
                  </span>
                </div>
              </td>

              <!-- Deviation Events -->
              <td class="py-2.5 px-3 text-right font-mono {r.deviationEvents > 0 ? 'text-rose-400 font-bold' : 'text-zinc-500'}">
                {r.deviationEvents}
              </td>

              <!-- Deviation Episodes -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-300">
                {r.deviationEpisodes}
                {#if r.openDeviationEpisodes > 0}
                  <span class="text-[10px] text-amber-400">({r.openDeviationEpisodes} aktif)</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
