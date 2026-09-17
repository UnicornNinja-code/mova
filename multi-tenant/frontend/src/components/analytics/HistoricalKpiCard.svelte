<!--
  HistoricalKpiCard.svelte
  S7-03-11: Single Authoritative Historical KPI Card
  Renders metric value, comparison delta pill, safe N/A null handling, and glassmorphism styling.
-->
<script lang="ts">
  import type { PeriodMetricComparison } from "../../lib/types/analytics.types.js";

  interface Props {
    title: string;
    value: number | string | null;
    unit?: string;
    subtitle?: string;
    iconClass: string;
    comparison?: PeriodMetricComparison | null;
    tooltip?: string;
    accent?: "coral" | "emerald" | "amber" | "rose" | "violet" | "sky";
  }

  let {
    title,
    value,
    unit = "",
    subtitle = "",
    iconClass,
    comparison = null,
    tooltip = "",
    accent = "coral",
  }: Props = $props();

  const formattedValue = $derived.by(() => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "N/A";
      return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    }
    return String(value);
  });

  const deltaPill = $derived.by(() => {
    if (!comparison) return null;
    const { direction, absoluteDelta, current, previous } = comparison;

    switch (direction) {
      case "UP": {
        const sign = absoluteDelta !== null && absoluteDelta > 0 ? `+${absoluteDelta}` : `${absoluteDelta}`;
        return {
          text: sign,
          label: "Naik",
          icon: "ri-arrow-up-line",
          className: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40",
        };
      }
      case "DOWN": {
        return {
          text: `${absoluteDelta}`,
          label: "Turun",
          icon: "ri-arrow-down-line",
          className: "bg-rose-950/60 text-rose-400 border-rose-800/40",
        };
      }
      case "UP_FROM_ZERO": {
        return {
          text: `+${current ?? 0}`,
          label: "Baru",
          icon: "ri-sparkling-line",
          className: "bg-sky-950/60 text-sky-400 border-sky-800/40",
        };
      }
      case "DOWN_TO_ZERO": {
        return {
          text: `0 (sebelumnya ${previous ?? 0})`,
          label: "Nol",
          icon: "ri-arrow-down-line",
          className: "bg-amber-950/60 text-amber-400 border-amber-800/40",
        };
      }
      case "UNCHANGED": {
        return {
          text: "0",
          label: "Tetap",
          icon: "ri-equal-line",
          className: "bg-zinc-800 text-zinc-400 border-zinc-700",
        };
      }
      case "UNAVAILABLE":
      default:
        return null;
    }
  });

  const accentStyles = {
    coral: {
      borderHover: "hover:border-[#FF634A]/40",
      iconBg: "bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/30",
    },
    emerald: {
      borderHover: "hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    amber: {
      borderHover: "hover:border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    rose: {
      borderHover: "hover:border-rose-500/40",
      iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
    violet: {
      borderHover: "hover:border-violet-500/40",
      iconBg: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    },
    sky: {
      borderHover: "hover:border-sky-500/40",
      iconBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    },
  };
</script>

<div
  class="relative bg-[#131316] border border-[#24242A] rounded-3xl p-4 sm:p-5 transition-all duration-200 shadow-lg font-outfit-400 flex flex-col justify-between {accentStyles[accent].borderHover}"
  title={tooltip || undefined}
>
  <!-- Card Header: Title & Icon -->
  <div class="flex items-start justify-between gap-2">
    <span class="text-xs font-outfit-600 text-[#A1A1AA] tracking-wide leading-tight">
      {title}
    </span>
    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border {accentStyles[accent].iconBg}">
      <i class="{iconClass} text-base"></i>
    </div>
  </div>

  <!-- Metric Value & Unit -->
  <div class="mt-3 mb-2 flex items-baseline gap-1.5 flex-wrap">
    <span class="text-2xl sm:text-3xl font-outfit-600 text-white font-extrabold tracking-tight">
      {formattedValue}
    </span>
    {#if unit && formattedValue !== 'N/A'}
      <span class="text-xs text-[#A1A1AA] font-mono">{unit}</span>
    {/if}
  </div>

  <!-- Bottom: Subtitle & Period Comparison Delta -->
  <div class="pt-2 border-t border-[#1F1F26] flex items-center justify-between gap-2 text-[11px] min-h-[26px]">
    {#if subtitle}
      <span class="text-zinc-500 truncate">{subtitle}</span>
    {:else}
      <span></span>
    {/if}

    {#if deltaPill}
      <div
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-outfit-600 border shrink-0 {deltaPill.className}"
        title="Perbandingan delta terhadap periode sebelumnya"
      >
        <i class="{deltaPill.icon}"></i>
        <span>{deltaPill.text}</span>
      </div>
    {/if}
  </div>
</div>
