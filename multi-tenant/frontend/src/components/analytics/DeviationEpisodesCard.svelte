<!--
  DeviationEpisodesCard.svelte
  S7-03-11: Deterministic Deviation Episodes Inspection Card
  Presents reconstructed deviation episodes with start/end timestamps, duration, and status.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import type { DeviationEpisode } from "../../lib/types/analytics.types.js";

  let searchQuery = $state<string>("");

  const episodes = $derived(historicalAnalyticsStore.deviationEpisodes);
  const metrics = $derived(historicalAnalyticsStore.summaryMetrics);

  const filteredEpisodes = $derived.by((): DeviationEpisode[] => {
    if (!searchQuery.trim()) return episodes;
    const q = searchQuery.toLowerCase();
    return episodes.filter(
      (ep) =>
        (ep.riderName && ep.riderName.toLowerCase().includes(q)) ||
        ep.riderId.toLowerCase().includes(q) ||
        (ep.zoneName && ep.zoneName.toLowerCase().includes(q)) ||
        (ep.assignedZoneName && ep.assignedZoneName.toLowerCase().includes(q))
    );
  });

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return "N/A (Terbuka)";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} dtk`;
    return `${m}m ${s}s`;
  };

  const formatTimestamp = (iso: string | null): string => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };
</script>

<div class="bg-[#131316] border border-[#24242A] rounded-3xl p-5 shadow-xl font-outfit-400 space-y-4">
  <!-- Card Header & Summary Stats -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#202027]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
        <i class="ri-route-line text-base"></i>
      </div>
      <div>
        <h3 class="text-sm font-outfit-600 text-white leading-tight">
          Rekonstruksi Episode Deviasi
        </h3>
        <p class="text-[11px] text-[#A1A1AA]">
          {metrics.deviationEpisodesCount} total episode ({metrics.openEpisodesCount} aktif, {metrics.affectedRidersCount} rider terdampak)
        </p>
      </div>
    </div>

    <!-- Search Input -->
    <div class="w-full sm:w-64 relative">
      <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs"></i>
      <input
        type="text"
        placeholder="Cari rider atau zona..."
        bind:value={searchQuery}
        class="w-full pl-8 pr-3 py-1.5 text-xs bg-[#1A1A20] border border-[#272730] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]"
      />
    </div>
  </div>

  <!-- Table Body -->
  {#if filteredEpisodes.length === 0}
    <div class="py-8 text-center text-xs text-[#71717A] space-y-1.5">
      <i class="ri-checkbox-circle-line text-2xl text-emerald-500/60"></i>
      <p>{episodes.length === 0 ? "Tidak ada episode deviasi yang tercatat pada periode ini." : "Tidak ada episode deviasi yang cocok dengan pencarian."}</p>
    </div>
  {:else}
    <div class="overflow-x-auto max-h-80 pr-1">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="sticky top-0 bg-[#131316] text-[11px] font-outfit-600 text-zinc-400 border-b border-[#24242A]">
          <tr>
            <th class="py-2.5 px-3">Rider</th>
            <th class="py-2.5 px-3">Zona Tugas</th>
            <th class="py-2.5 px-3">Zona Terdeteksi</th>
            <th class="py-2.5 px-3">Mulai Deviasi</th>
            <th class="py-2.5 px-3">Selesai</th>
            <th class="py-2.5 px-3 text-right">Durasi</th>
            <th class="py-2.5 px-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1D1D24]">
          {#each filteredEpisodes as ep}
            <tr class="hover:bg-[#1A1A20] transition-colors">
              <!-- Rider Info -->
              <td class="py-2.5 px-3">
                <div class="font-outfit-600 text-white">{ep.riderName || ep.riderId}</div>
                <div class="text-[10px] text-zinc-500 font-mono">{ep.riderId}</div>
              </td>

              <!-- Assigned Zone -->
              <td class="py-2.5 px-3 text-zinc-300">
                {ep.assignedZoneName || (ep.assignedZoneId ? `Zone (${ep.assignedZoneId})` : '-')}
              </td>

              <!-- Actual Detected Zone -->
              <td class="py-2.5 px-3 text-rose-300">
                {ep.zoneName || (ep.zoneId ? `Zone (${ep.zoneId})` : 'Di Luar Geofence')}
              </td>

              <!-- Started At -->
              <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-300">
                {formatTimestamp(ep.startedAt)}
              </td>

              <!-- Ended At -->
              <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-400">
                {ep.endedAt ? formatTimestamp(ep.endedAt) : '-'}
              </td>

              <!-- Duration -->
              <td class="py-2.5 px-3 text-right font-mono text-[11px] text-zinc-300">
                {formatDuration(ep.durationSeconds)}
              </td>

              <!-- Status Badge -->
              <td class="py-2.5 px-3 text-center">
                {#if ep.open}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-amber-950/60 text-amber-400 border border-amber-800/40 animate-pulse">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Aktif</span>
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/30">
                    <span>Selesai</span>
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
