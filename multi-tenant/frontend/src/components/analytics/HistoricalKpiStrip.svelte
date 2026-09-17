<!--
  HistoricalKpiStrip.svelte
  S7-03-11: Authoritative KPI Summary Strip (6 Metrics Grid)
  Presents total events, active riders, safe compliance rate, deviation counts,
  deviation episodes, and average resolution duration with delta comparisons.
-->
<script lang="ts">
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import HistoricalKpiCard from "./HistoricalKpiCard.svelte";

  const metrics = $derived(historicalAnalyticsStore.summaryMetrics);
  const comparison = $derived(historicalAnalyticsStore.comparisonCards);

  const formattedAvgDuration = $derived.by(() => {
    const sec = metrics.averageDeviationDurationSeconds;
    if (sec === null || sec === undefined) return "N/A";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} dtk`;
    return `${m}m ${s}s`;
  });
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
  <!-- 1. Total Presence Events -->
  <HistoricalKpiCard
    title="Total Event Keberadaan"
    value={metrics.totalEvents}
    subtitle="Total sinyal GPS terproses"
    iconClass="ri-broadcast-line"
    accent="coral"
    comparison={comparison?.totalEvents}
  />

  <!-- 2. Observed Active Riders -->
  <HistoricalKpiCard
    title="Rider Terobservasi"
    value={metrics.observedRiders}
    subtitle="Rider dengan sinyal valid"
    iconClass="ri-e-bike-2-line"
    accent="sky"
    comparison={comparison?.observedRiders}
  />

  <!-- 3. Compliance Rate -->
  <HistoricalKpiCard
    title="Tingkat Kepatuhan"
    value={metrics.complianceRate}
    unit="%"
    subtitle="Compliant / Eligible Events"
    iconClass="ri-shield-check-line"
    accent="emerald"
    comparison={comparison?.complianceRate}
    tooltip="Rasio kepatuhan geofence terhadap wilayah tugas resmi. Bernilai N/A jika tidak ada event yang dapat dievaluasi."
  />

  <!-- 4. Deviated Events Count -->
  <HistoricalKpiCard
    title="Event Deviasi"
    value={metrics.deviatedEvents}
    subtitle="Sinyal di luar zona tugas"
    iconClass="ri-error-warning-line"
    accent="rose"
    comparison={comparison?.deviatedEvents}
  />

  <!-- 5. Deviation Episodes -->
  <HistoricalKpiCard
    title="Episode Deviasi"
    value={metrics.deviationEpisodesCount}
    subtitle="{metrics.openEpisodesCount} episode masih aktif"
    iconClass="ri-route-line"
    accent="amber"
    comparison={comparison?.deviationEpisodes}
    tooltip="Rangkaian berurutan sinyal DEVIATED yang direkonstruksi secara deterministik."
  />

  <!-- 6. Average Deviation Duration -->
  <HistoricalKpiCard
    title="Rata-rata Durasi Deviasi"
    value={formattedAvgDuration}
    subtitle="Episode yang telah selesai"
    iconClass="ri-timer-line"
    accent="violet"
    tooltip="Durasi rata-rata rider berada dalam status deviasi sebelum kembali patuh atau checkout."
  />
</div>
