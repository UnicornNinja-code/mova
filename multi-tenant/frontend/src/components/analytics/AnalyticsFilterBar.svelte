<!--
  AnalyticsFilterBar.svelte
  S7-03-11: Interactive Filter Bar for Historical Operational Analytics
  Controls temporal presets, custom half-open [start, end) ranges, grain, timezone,
  zone/rider filtering, open-only deviations, and previous-period comparison baseline.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { historicalAnalyticsStore, type TimePreset } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import type { AnalyticsGrain } from "../../lib/types/analytics.types.js";
  import { zoneService, type ZoneItem } from "../../services/zoneService.js";
  import { userService, type UserAccountItem } from "../../services/userService.js";

  interface Props {
    onFilterChange?: () => void;
  }

  let { onFilterChange }: Props = $props();

  let availableZones = $state<ZoneItem[]>([]);
  let availableRiders = $state<UserAccountItem[]>([]);
  let customStartDate = $state<string>("");
  let customEndDate = $state<string>("");

  onMount(async () => {
    // Sync custom date state with store initial range
    if (historicalAnalyticsStore.rangeStart && historicalAnalyticsStore.rangeEnd) {
      customStartDate = historicalAnalyticsStore.rangeStart.slice(0, 10);
      customEndDate = historicalAnalyticsStore.rangeEnd.slice(0, 10);
    }

    // Load zones and riders for filter dropdowns in parallel
    try {
      const [zonesRes, usersRes] = await Promise.allSettled([
        zoneService.getAllZones(),
        userService.getAllUsers(),
      ]);

      if (zonesRes.status === "fulfilled") {
        availableZones = zonesRes.value || [];
      }
      if (usersRes.status === "fulfilled") {
        const users = usersRes.value || [];
        availableRiders = users.filter((u) => u.role === "RIDER" || u.role === "rider");
      }
    } catch {
      // Non-blocking fallback
    }
  });

  const presets: Array<{ id: TimePreset; label: string }> = [
    { id: "today", label: "Hari Ini" },
    { id: "yesterday", label: "Kemarin" },
    { id: "last7days", label: "7 Hari" },
    { id: "last30days", label: "30 Hari" },
    { id: "thisMonth", label: "Bulan Ini" },
    { id: "custom", label: "Kustom" },
  ];

  const grains: Array<{ id: AnalyticsGrain; label: string }> = [
    { id: "hour", label: "Jam" },
    { id: "day", label: "Hari" },
    { id: "week", label: "Minggu" },
    { id: "month", label: "Bulan" },
  ];

  const timezones = [
    { id: "Asia/Jakarta", label: "WIB (Asia/Jakarta)" },
    { id: "Asia/Makassar", label: "WITA (Asia/Makassar)" },
    { id: "Asia/Jayapura", label: "WIT (Asia/Jayapura)" },
    { id: "UTC", label: "UTC" },
  ];

  const handleSelectPreset = async (preset: TimePreset) => {
    historicalAnalyticsStore.setTimePreset(preset);
    if (preset !== "custom") {
      customStartDate = historicalAnalyticsStore.rangeStart.slice(0, 10);
      customEndDate = historicalAnalyticsStore.rangeEnd.slice(0, 10);
      await triggerFetch();
    }
  };

  const handleApplyCustomRange = async () => {
    if (!customStartDate || !customEndDate) return;
    const startISO = new Date(`${customStartDate}T00:00:00.000Z`).toISOString();
    // Inclusive user day input converted to half-open exclusive end: [start, end)
    const endPlusOne = new Date(`${customEndDate}T00:00:00.000Z`);
    endPlusOne.setUTCDate(endPlusOne.getUTCDate() + 1);
    const endISO = endPlusOne.toISOString();

    historicalAnalyticsStore.setCustomRange(startISO, endISO);
    await triggerFetch();
  };

  const handleGrainChange = async (e: Event) => {
    const val = (e.target as HTMLSelectElement).value as AnalyticsGrain;
    historicalAnalyticsStore.setGrain(val);
    await triggerFetch();
  };

  const handleTimezoneChange = async (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    historicalAnalyticsStore.setTimezone(val);
    await triggerFetch();
  };

  const handleZoneChange = async (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    historicalAnalyticsStore.setZoneFilter(val ? val : null);
    await triggerFetch();
  };

  const handleRiderChange = async (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    historicalAnalyticsStore.setRiderFilter(val ? val : null);
    await triggerFetch();
  };

  const handleCompareToggle = async () => {
    historicalAnalyticsStore.setCompareWithPrevious(!historicalAnalyticsStore.compareWithPrevious);
    if (historicalAnalyticsStore.compareWithPrevious) {
      await historicalAnalyticsStore.fetchComparison();
    }
  };

  const handleOpenOnlyToggle = async () => {
    historicalAnalyticsStore.setOpenDeviationsOnly(!historicalAnalyticsStore.openDeviationsOnly);
    await historicalAnalyticsStore.fetchDeviations();
  };

  const handleReset = async () => {
    historicalAnalyticsStore.resetFilters();
    customStartDate = historicalAnalyticsStore.rangeStart.slice(0, 10);
    customEndDate = historicalAnalyticsStore.rangeEnd.slice(0, 10);
    await triggerFetch();
  };

  const triggerFetch = async () => {
    if (onFilterChange) {
      onFilterChange();
    } else {
      await historicalAnalyticsStore.fetchAll();
    }
  };
</script>

<section class="bg-[#131316] border border-[#24242A] rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl font-outfit-400">
  <!-- TOP ROW: Preset Pills & Grain Selector -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#202027]">
    <!-- Preset Buttons -->
    <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-[#1A1A20] border border-[#272730] overflow-x-auto max-w-full">
      {#each presets as p}
        {@const isSelected = historicalAnalyticsStore.selectedPreset === p.id}
        <button
          type="button"
          onclick={() => handleSelectPreset(p.id)}
          class="px-3 py-1.5 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer whitespace-nowrap
          {isSelected 
            ? 'bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] font-extrabold shadow-md shadow-[#FF634A]/20' 
            : 'text-[#A1A1AA] hover:text-white hover:bg-[#24242E]'}"
        >
          {p.label}
        </button>
      {/each}
    </div>

    <!-- Grain & Timezone Controls -->
    <div class="flex items-center gap-2.5 flex-wrap">
      <!-- Grain Selector -->
      <div class="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
        <label for="grain-select" class="text-[11px] font-outfit-600">Grain:</label>
        <select
          id="grain-select"
          value={historicalAnalyticsStore.selectedGrain}
          onchange={handleGrainChange}
          class="bg-[#1A1A20] border border-[#272730] text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#FF634A] cursor-pointer"
        >
          {#each grains as g}
            <option value={g.id}>{g.label}</option>
          {/each}
        </select>
      </div>

      <!-- Timezone Selector -->
      <div class="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
        <label for="tz-select" class="text-[11px] font-outfit-600">Timezone:</label>
        <select
          id="tz-select"
          value={historicalAnalyticsStore.selectedTimezone}
          onchange={handleTimezoneChange}
          class="bg-[#1A1A20] border border-[#272730] text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#FF634A] cursor-pointer"
        >
          {#each timezones as tz}
            <option value={tz.id}>{tz.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- MIDDLE ROW: Custom Range (if active) & Dropdown Filters -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <!-- Zone Filter -->
    <div class="space-y-1">
      <label for="zone-filter" class="text-[11px] font-outfit-600 text-[#A1A1AA] flex items-center gap-1">
        <i class="ri-road-map-line text-[#FF634A]"></i>
        <span>Filter Zona:</span>
      </label>
      <select
        id="zone-filter"
        value={historicalAnalyticsStore.selectedZoneId || ""}
        onchange={handleZoneChange}
        class="w-full bg-[#1A1A20] border border-[#272730] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF634A] cursor-pointer truncate"
      >
        <option value="">Semua Zona Terdaftar</option>
        {#each availableZones as z}
          <option value={z.id}>{z.name} {z.code ? `(${z.code})` : ''}</option>
        {/each}
      </select>
    </div>

    <!-- Rider Filter -->
    <div class="space-y-1">
      <label for="rider-filter" class="text-[11px] font-outfit-600 text-[#A1A1AA] flex items-center gap-1">
        <i class="ri-e-bike-2-line text-[#FF634A]"></i>
        <span>Filter Rider:</span>
      </label>
      <select
        id="rider-filter"
        value={historicalAnalyticsStore.selectedRiderId || ""}
        onchange={handleRiderChange}
        class="w-full bg-[#1A1A20] border border-[#272730] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF634A] cursor-pointer truncate"
      >
        <option value="">Semua Rider Aktif</option>
        {#each availableRiders as r}
          <option value={String(r.id)}>{r.name} ({r.email})</option>
        {/each}
      </select>
    </div>

    <!-- Custom Range Start & End -->
    {#if historicalAnalyticsStore.selectedPreset === 'custom'}
      <div class="space-y-1">
        <label for="custom-start" class="text-[11px] font-outfit-600 text-[#A1A1AA]">Tanggal Mulai:</label>
        <input
          id="custom-start"
          type="date"
          bind:value={customStartDate}
          onchange={handleApplyCustomRange}
          class="w-full bg-[#1A1A20] border border-[#272730] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF634A]"
        />
      </div>
      <div class="space-y-1">
        <label for="custom-end" class="text-[11px] font-outfit-600 text-[#A1A1AA]">Tanggal Selesai:</label>
        <input
          id="custom-end"
          type="date"
          bind:value={customEndDate}
          onchange={handleApplyCustomRange}
          class="w-full bg-[#1A1A20] border border-[#272730] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF634A]"
        />
      </div>
    {/if}
  </div>

  <!-- BOTTOM ROW: Toggles, Active Boundary Semantic Banner & Reset -->
  <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
    <!-- Active Toggles -->
    <div class="flex items-center gap-4 flex-wrap text-xs">
      <!-- Compare Toggle -->
      <label class="flex items-center gap-2 cursor-pointer select-none text-zinc-300">
        <input
          type="checkbox"
          checked={historicalAnalyticsStore.compareWithPrevious}
          onchange={handleCompareToggle}
          class="w-4 h-4 rounded text-[#FF634A] focus:ring-0 bg-[#1A1A20] border-[#2E2E38] cursor-pointer"
        />
        <span class="font-outfit-600">Bandingkan Periode Sebelumnya</span>
      </label>

      <!-- Open Only Deviations Toggle -->
      <label class="flex items-center gap-2 cursor-pointer select-none text-zinc-300">
        <input
          type="checkbox"
          checked={historicalAnalyticsStore.openDeviationsOnly}
          onchange={handleOpenOnlyToggle}
          class="w-4 h-4 rounded text-[#FF634A] focus:ring-0 bg-[#1A1A20] border-[#2E2E38] cursor-pointer"
        />
        <span>Hanya Deviasi Terbuka (Open)</span>
      </label>
    </div>

    <!-- Active Temporal Window Pill & Reset Button -->
    <div class="flex items-center gap-2.5">
      <div class="px-3 py-1 rounded-xl bg-[#18181E] border border-[#262630] text-[11px] text-zinc-400 font-mono">
        <span class="text-[#FF8573]">Window:</span> [{historicalAnalyticsStore.rangeStart ? historicalAnalyticsStore.rangeStart.slice(0, 10) : ''} s/d {historicalAnalyticsStore.rangeEnd ? historicalAnalyticsStore.rangeEnd.slice(0, 10) : ''})
      </div>

      <button
        type="button"
        onclick={handleReset}
        class="px-3 py-1 text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-[#1A1A20] rounded-xl transition-all cursor-pointer border border-transparent hover:border-[#272730]"
      >
        Reset Filter
      </button>
    </div>
  </div>
</section>
