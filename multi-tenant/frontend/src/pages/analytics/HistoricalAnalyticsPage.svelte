<!--
  HistoricalAnalyticsPage.svelte
  S7-03-11: Master Historical Operational Analytics Dashboard Page
  Assembles header, filter bar, KPI summary strip, timeline charts,
  compliance distributions, deviation episodes, zone/rider tables, and period comparisons.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { historicalAnalyticsStore } from "../../lib/stores/historicalAnalyticsStore.svelte.js";
  import AnalyticsHeader from "../../components/analytics/AnalyticsHeader.svelte";
  import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar.svelte";
  import AnalyticsStateAlerts from "../../components/analytics/AnalyticsStateAlerts.svelte";
  import HistoricalKpiStrip from "../../components/analytics/HistoricalKpiStrip.svelte";
  import PresenceTimelineCard from "../../components/analytics/PresenceTimelineCard.svelte";
  import ComplianceDistributionCard from "../../components/analytics/ComplianceDistributionCard.svelte";
  import DeviationEpisodesCard from "../../components/analytics/DeviationEpisodesCard.svelte";
  import ZoneAnalyticsTable from "../../components/analytics/ZoneAnalyticsTable.svelte";
  import RiderAnalyticsTable from "../../components/analytics/RiderAnalyticsTable.svelte";
  import PeriodComparisonMatrix from "../../components/analytics/PeriodComparisonMatrix.svelte";

  interface Props {
    onNavigate?: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  onMount(async () => {
    // Initial load of historical analytics dataset
    await historicalAnalyticsStore.fetchAll();
  });
</script>

<svelte:head>
  <title>Historical Operational Analytics | MOVA Intelligence</title>
</svelte:head>

<div class="space-y-6 pb-12 font-outfit-400">
  <!-- 1. Header with Title, Sync Indicators, Refresh Action -->
  <AnalyticsHeader />

  <!-- 2. State & Error Alerts (Partial Error, API Error, Empty Notice) -->
  <AnalyticsStateAlerts />

  <!-- 3. Interactive Filter Bar (Presets, Grain, Timezone, Filters) -->
  <AnalyticsFilterBar />

  <!-- 4. Main Analytics Content Area -->
  {#if historicalAnalyticsStore.isInitialLoading}
    <!-- Initial Loading Skeleton Shimmer -->
    <div class="space-y-6 animate-pulse">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {#each Array(6) as _}
          <div class="h-28 bg-[#131316] border border-[#24242A] rounded-3xl"></div>
        {/each}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="h-72 bg-[#131316] border border-[#24242A] rounded-3xl"></div>
        <div class="h-72 bg-[#131316] border border-[#24242A] rounded-3xl"></div>
      </div>
    </div>
  {:else}
    <!-- Authoritative KPI Summary Strip (6 Metrics) -->
    <HistoricalKpiStrip />

    <!-- Timeseries Timeline & Geofence Compliance Distribution -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PresenceTimelineCard />
      <ComplianceDistributionCard />
    </div>

    <!-- Zone & Rider Operational Analytics Rankings -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ZoneAnalyticsTable />
      <RiderAnalyticsTable />
    </div>

    <!-- Reconstructed Deviation Episodes Inspection -->
    <DeviationEpisodesCard />

    <!-- Period-Over-Period Comparison Matrix -->
    {#if historicalAnalyticsStore.compareWithPrevious}
      <PeriodComparisonMatrix />
    {/if}
  {/if}
</div>
