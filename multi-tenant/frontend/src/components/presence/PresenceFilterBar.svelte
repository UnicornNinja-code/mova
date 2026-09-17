<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { presenceStore } from '../../lib/stores/presenceStore.svelte';
  import { presenceTelemetry } from '../../lib/stores/presenceTelemetry.svelte';
  import { Search, RotateCcw, Filter, Radio, AlertCircle, WifiOff } from 'lucide-svelte';

  let timeAgoText = $state("1s lalu");
  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    intervalId = setInterval(() => {
      const last = presenceTelemetry.metrics.lastSocketEventAt || new Date(presenceStore.lastSyncTimestamp).getTime();
      const diffSec = Math.max(1, Math.floor((Date.now() - last) / 1000));
      if (diffSec < 60) {
        timeAgoText = `${diffSec}s lalu`;
      } else {
        timeAgoText = `${Math.floor(diffSec / 60)}m lalu`;
      }
    }, 1000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const resetFilters = () => {
    presenceStore.activeStatusFilter = 'ALL';
    presenceStore.selectedZoneFilter = 'ALL';
    presenceStore.searchQuery = '';
  };
</script>

<div class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
  <!-- Left Side: Filters -->
  <div class="flex flex-wrap items-center gap-3">
    <!-- Zone Selector -->
    <div class="flex items-center gap-2">
      <Filter class="w-4 h-4 text-zinc-400" />
      <select
        aria-label="Filter berdasarkan Zona Operasi"
        bind:value={presenceStore.selectedZoneFilter}
        class="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
      >
        <option value="ALL">Semua Zona Operasi</option>
        {#each presenceStore.zonesGeoJson as zone}
          <option value={zone.id}>{zone.name}</option>
        {/each}
      </select>
    </div>

    <!-- Status Selector -->
    <select
      aria-label="Filter berdasarkan Status Kepatuhan"
      bind:value={presenceStore.activeStatusFilter}
      class="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
    >
      <option value="ALL">Semua Status Kepatuhan</option>
      <option value="COMPLIANT">Sesuai Tugas (Compliant)</option>
      <option value="DEVIATED">Deviasi (Deviated)</option>
      <option value="UNASSIGNED">Belum Ditugaskan</option>
      <option value="OUTSIDE">Di Luar Zona (Transit)</option>
    </select>

    <!-- Reset Filter Button -->
    {#if presenceStore.activeStatusFilter !== 'ALL' || presenceStore.selectedZoneFilter !== 'ALL' || presenceStore.searchQuery.trim().length > 0}
      <button
        type="button"
        onclick={resetFilters}
        class="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 transition-colors cursor-pointer"
        aria-label="Reset semua filter"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        Reset Filter
      </button>
    {/if}
  </div>

  <!-- Right Side: Search & Live Heartbeat Indicator -->
  <div class="flex items-center gap-3">
    <!-- Search Input -->
    <div class="relative w-full md:w-64">
      <Search class="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        placeholder="Cari nama rider / armada..."
        aria-label="Cari nama rider atau armada"
        bind:value={presenceStore.searchQuery}
        class="w-full bg-zinc-800/90 border border-zinc-700 text-zinc-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-amber-500"
      />
    </div>

    <!-- Live Telemetry Status Badge (Explicit Multi-State) -->
    <div
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold"
      role="status"
      aria-live="polite"
    >
      {#if presenceStore.connectionState === 'LIVE'}
        <span class="flex items-center gap-1.5 text-emerald-400">
          <Radio class="w-3.5 h-3.5 animate-pulse" />
          LIVE ● <span class="font-normal text-[11px] text-zinc-400">({timeAgoText})</span>
        </span>
      {:else if presenceStore.connectionState === 'RECONNECTING'}
        <span class="flex items-center gap-1.5 text-amber-400">
          <RotateCcw class="w-3.5 h-3.5 animate-spin" />
          RECONNECTING <span class="font-normal text-[11px] text-zinc-400">(Coba #{presenceStore.reconnectAttempts})</span>
        </span>
      {:else if presenceStore.connectionState === 'STALE'}
        <span class="flex items-center gap-1.5 text-orange-400">
          <AlertCircle class="w-3.5 h-3.5" />
          STALE <span class="font-normal text-[11px] text-zinc-400">({timeAgoText})</span>
        </span>
      {:else}
        <span class="flex items-center gap-1.5 text-rose-400">
          <WifiOff class="w-3.5 h-3.5" />
          OFFLINE
        </span>
      {/if}
    </div>
  </div>
</div>
