<!--
  ZoneAnalyticsTable.svelte
  S7-03-11: Zone Historical Operational Performance & Compliance Table
  Renders deterministic zone rankings with event volumes, compliance rate, and deviation impact.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import type { ZoneAnalyticsMetrics } from "../../lib/types/analytics.types.js";

  let searchQuery = $state<string>("");

  const zones = $derived(historicalAnalyticsStore.zoneRankings);

  const filteredZones = $derived.by((): ZoneAnalyticsMetrics[] => {
    if (!searchQuery.trim()) return zones;
    const q = searchQuery.toLowerCase();
    return zones.filter(
      (z) => z.zoneName.toLowerCase().includes(q) || z.zoneId.toLowerCase().includes(q)
    );
  });
</script>

<div class="bg-[#131316] border border-[#24242A] rounded-3xl p-5 shadow-xl font-outfit-400 space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#202027]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
        <i class="ri-road-map-line text-base"></i>
      </div>
      <div>
        <h3 class="text-sm font-outfit-600 text-white leading-tight">
          Performa Historis Zona Wilayah
        </h3>
        <p class="text-[11px] text-[#A1A1AA]">
          Evaluasi volume keberadaan, kepatuhan wilayah, dan rider terdampak per zona
        </p>
      </div>
    </div>

    <!-- Search Input -->
    <div class="w-full sm:w-64 relative">
      <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs"></i>
      <input
        type="text"
        placeholder="Cari nama zona..."
        bind:value={searchQuery}
        class="w-full pl-8 pr-3 py-1.5 text-xs bg-[#1A1A20] border border-[#272730] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]"
      />
    </div>
  </div>

  <!-- Table -->
  {#if filteredZones.length === 0}
    <div class="py-8 text-center text-xs text-[#71717A] space-y-1.5">
      <i class="ri-map-pin-line text-2xl text-zinc-700"></i>
      <p>{zones.length === 0 ? "Tidak ada rekaman zona aktif pada rentang waktu ini." : "Tidak ada zona yang cocok dengan pencarian."}</p>
    </div>
  {:else}
    <div class="overflow-x-auto max-h-80 pr-1">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="sticky top-0 bg-[#131316] text-[11px] font-outfit-600 text-zinc-400 border-b border-[#24242A]">
          <tr>
            <th class="py-2.5 px-3 w-10">#</th>
            <th class="py-2.5 px-3">Nama Zona</th>
            <th class="py-2.5 px-3 text-right">Total Event</th>
            <th class="py-2.5 px-3 text-right">Rider Terobservasi</th>
            <th class="py-2.5 px-3">Tingkat Kepatuhan</th>
            <th class="py-2.5 px-3 text-right">Rider Deviasi</th>
            <th class="py-2.5 px-3 text-right">Episode Deviasi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1D1D24]">
          {#each filteredZones as z, idx}
            <tr class="hover:bg-[#1A1A20] transition-colors">
              <!-- Rank -->
              <td class="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">{idx + 1}</td>

              <!-- Zone Name -->
              <td class="py-2.5 px-3">
                <div class="font-outfit-600 text-white">{z.zoneName}</div>
                <div class="text-[10px] text-zinc-500 font-mono">{z.zoneId}</div>
              </td>

              <!-- Total Events -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-300">
                {z.totalEvents}
              </td>

              <!-- Observed Riders -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-300">
                {z.observedRiders}
              </td>

              <!-- Compliance Rate with Progress Bar -->
              <td class="py-2.5 px-3">
                <div class="flex items-center gap-2">
                  <div class="w-20 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    {#if z.complianceRate !== null}
                      <div
                        class="bg-emerald-500 h-full rounded-full"
                        style="width: {Math.min(100, Math.max(0, z.complianceRate))}%;"
                      ></div>
                    {/if}
                  </div>
                  <span class="font-mono text-[11px] {z.complianceRate !== null ? 'text-emerald-400 font-bold' : 'text-zinc-500'}">
                    {z.complianceRate !== null ? `${z.complianceRate}%` : 'N/A'}
                  </span>
                </div>
              </td>

              <!-- Affected Riders -->
              <td class="py-2.5 px-3 text-right font-mono {z.affectedRiders > 0 ? 'text-rose-400 font-bold' : 'text-zinc-500'}">
                {z.affectedRiders}
              </td>

              <!-- Deviation Episodes -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-300">
                {z.deviationEpisodes}
                {#if z.openDeviationEpisodes > 0}
                  <span class="text-[10px] text-amber-400">({z.openDeviationEpisodes} aktif)</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
