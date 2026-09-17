<!--
  PeriodComparisonMatrix.svelte
  S7-03-11: Authoritative Period-Over-Period Comparison Matrix
  Presents 10 domain metrics comparing current period against symmetric previous baseline.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import type { PeriodMetricComparison } from "../../lib/types/analytics.types.js";

  const comparison = $derived(historicalAnalyticsStore.comparisonResult);
  const metrics = $derived(comparison?.metrics);
  const context = $derived(comparison?.context);

  const formatVal = (v: number | null): string => {
    if (v === null || v === undefined) return "N/A";
    return Number.isInteger(v) ? v.toLocaleString("id-ID") : v.toFixed(2);
  };

  const getDeltaBadge = (comp: PeriodMetricComparison | undefined) => {
    if (!comp) return null;
    const { direction, absoluteDelta, current, previous } = comp;

    switch (direction) {
      case "UP": {
        const sign = absoluteDelta !== null && absoluteDelta > 0 ? `+${absoluteDelta}` : `${absoluteDelta}`;
        return {
          text: sign,
          label: "Naik",
          className: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40",
          icon: "ri-arrow-up-line",
        };
      }
      case "DOWN": {
        return {
          text: `${absoluteDelta}`,
          label: "Turun",
          className: "bg-rose-950/60 text-rose-400 border-rose-800/40",
          icon: "ri-arrow-down-line",
        };
      }
      case "UP_FROM_ZERO": {
        return {
          text: `+${current ?? 0}`,
          label: "Baru",
          className: "bg-sky-950/60 text-sky-400 border-sky-800/40",
          icon: "ri-sparkling-line",
        };
      }
      case "DOWN_TO_ZERO": {
        return {
          text: `0 (dari ${previous ?? 0})`,
          label: "Nol",
          className: "bg-amber-950/60 text-amber-400 border-amber-800/40",
          icon: "ri-arrow-down-line",
        };
      }
      case "UNCHANGED": {
        return {
          text: "0",
          label: "Tetap",
          className: "bg-zinc-800 text-zinc-400 border-zinc-700",
          icon: "ri-equal-line",
        };
      }
      case "UNAVAILABLE":
      default:
        return {
          text: "N/A",
          label: "N/A",
          className: "bg-zinc-800/60 text-zinc-500 border-zinc-700/50",
          icon: "ri-subtract-line",
        };
    }
  };

  const metricRows = $derived.by(() => {
    if (!metrics) return [];
    return [
      { label: "Rider Terobservasi", data: metrics.observedRiders, unit: "rider" },
      { label: "Total Event Keberadaan", data: metrics.totalEvents, unit: "event" },
      { label: "Event Patuh (Compliant)", data: metrics.compliantEvents, unit: "event" },
      { label: "Event Deviasi", data: metrics.deviatedEvents, unit: "event" },
      { label: "Event di Luar Zona (Outside)", data: metrics.outsideEvents, unit: "event" },
      { label: "Event Tanpa Tugas (Unassigned)", data: metrics.unassignedEvents, unit: "event" },
      { label: "Denominator Evaluasi (Eligible)", data: metrics.eligibleEvents, unit: "event" },
      { label: "Tingkat Kepatuhan (Compliance Rate)", data: metrics.complianceRate, unit: "%" },
      { label: "Episode Deviasi", data: metrics.deviationEpisodes, unit: "episode" },
      { label: "Episode Deviasi Terbuka (Open)", data: metrics.openDeviationEpisodes, unit: "episode" },
    ];
  });
</script>

<div class="bg-[#131316] border border-[#24242A] rounded-3xl p-5 shadow-xl font-outfit-400 space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#202027]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shrink-0 shadow-md shadow-[#FF634A]/20">
        <i class="ri-swap-box-line text-base"></i>
      </div>
      <div>
        <h3 class="text-sm font-outfit-600 text-white leading-tight">
          Matriks Perbandingan Periode (Period-over-Period)
        </h3>
        <p class="text-[11px] text-[#A1A1AA]">
          Evaluasi pergeseran 10 metrik autoritatif terhadap baseline periode sebelumnya
        </p>
      </div>
    </div>

    <!-- Context Range Windows -->
    {#if context}
      <div class="flex items-center gap-2 text-[11px] font-mono">
        <span class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-emerald-400">
          Saat Ini: [{context.current.rangeStart.slice(0, 10)} s/d {context.current.rangeEnd.slice(0, 10)})
        </span>
        <span class="text-zinc-600">vs</span>
        <span class="px-2.5 py-1 rounded-xl bg-[#1A1A20] border border-[#272730] text-zinc-400">
          Sebelumnya: [{context.previous.rangeStart.slice(0, 10)} s/d {context.previous.rangeEnd.slice(0, 10)})
        </span>
      </div>
    {/if}
  </div>

  <!-- Table Body -->
  {#if !comparison || !metrics}
    <div class="py-8 text-center text-xs text-[#71717A] space-y-1.5">
      <i class="ri-swap-line text-2xl text-zinc-700"></i>
      <p>Perbandingan periode dinonaktifkan atau belum tersedia.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-[#18181E] text-[11px] font-outfit-600 text-zinc-400 border-b border-[#24242A]">
          <tr>
            <th class="py-2.5 px-3">Metrik Operasional</th>
            <th class="py-2.5 px-3 text-right">Periode Saat Ini</th>
            <th class="py-2.5 px-3 text-right">Periode Sebelumnya</th>
            <th class="py-2.5 px-3 text-right">Perubahan Delta</th>
            <th class="py-2.5 px-3 text-center">Arah Tren</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1D1D24]">
          {#each metricRows as row}
            {@const badge = getDeltaBadge(row.data)}
            <tr class="hover:bg-[#1A1A20] transition-colors">
              <!-- Metric Label -->
              <td class="py-2.5 px-3 font-outfit-600 text-white">
                {row.label}
              </td>

              <!-- Current -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-200">
                {formatVal(row.data.current)} {row.data.current !== null && row.unit !== '%' ? row.unit : ''}
              </td>

              <!-- Previous -->
              <td class="py-2.5 px-3 text-right font-mono text-zinc-400">
                {formatVal(row.data.previous)} {row.data.previous !== null && row.unit !== '%' ? row.unit : ''}
              </td>

              <!-- Absolute Delta -->
              <td class="py-2.5 px-3 text-right font-mono font-bold {badge ? badge.className.split(' ')[1] : 'text-zinc-400'}">
                {#if badge}
                  {badge.text} {row.unit !== '%' ? row.unit : '%'}
                {:else}
                  -
                {/if}
              </td>

              <!-- Direction Badge -->
              <td class="py-2.5 px-3 text-center">
                {#if badge}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-outfit-600 border {badge.className}">
                    <i class="{badge.icon}"></i>
                    <span>{badge.label}</span>
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
