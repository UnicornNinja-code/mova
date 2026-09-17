<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    dashboardService, 
    type DashboardSummary, 
    type SalesTrendItem, 
    type ProductPerformanceItem,
    type ZonePerformanceItem 
  } from '../../services/dashboardService';
  import { dssService, type ActiveDssConfig } from '../../services/dssService';
  import { getSocket } from '../../lib/socket';

  import StatCard from '../../components/dashboard/StatCard.svelte';
  import SalesChart from '../../components/dashboard/SalesChart.svelte';
  import TopSellingProductsCard from '../../components/dashboard/TopSellingProductsCard.svelte';
  import DashboardMiniMap from '../../components/dashboard/DashboardMiniMap.svelte';
  import DssStatusCard from '../../components/dashboard/DssStatusCard.svelte';
  import ActivityFeed, { type ActivityItem } from '../../components/dashboard/ActivityFeed.svelte';
  import HubAtmosphericRadarCard from '../../components/dashboard/HubAtmosphericRadarCard.svelte';
  import SystemReadinessWidget from '../../components/system/SystemReadinessWidget.svelte';

  import SyncWeatherModal from '../../components/dashboard/SyncWeatherModal.svelte';
  import RecalculateDssModal from '../../components/dashboard/RecalculateDssModal.svelte';
  import QuickAlertPanel from '../../components/dashboard/QuickAlertPanel.svelte';
  import FirstRunSetupModal from '../../components/onboarding/FirstRunSetupModal.svelte';
  import { setupStore } from '../../lib/stores/setupStore.svelte';
  import { confirmModal } from '../../lib/stores/confirmModal.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let summary = $state<DashboardSummary | null>(null);
  let salesTrend = $state<SalesTrendItem[]>([]);
  let productPerformance = $state<ProductPerformanceItem[]>([]);
  let zonePerformance = $state<ZonePerformanceItem[]>([]);
  let dssConfig = $state<ActiveDssConfig | null>(null);
  
  let range = $state('7d');
  let startDate = $state('');
  let endDate = $state('');

  let weatherModalOpen = $state(false);
  let dssModalOpen = $state(false);

  // Live Activity Feed State sourced from PostgreSQL Audit Logs & Socket
  let activities = $state<ActivityItem[]>([]);

  const loadDashboardData = async () => {
    loading = true;
    try {
      const [sumRes, trendRes, prodRes, zoneRes, dssRes, auditRes] = await Promise.allSettled([
        dashboardService.getSummary(),
        dashboardService.getSalesTrend({ range, startDate, endDate }),
        dashboardService.getProductPerformance({ range, startDate, endDate }),
        dashboardService.getZonePerformance(),
        dssService.getActiveConfig(),
        dashboardService.getAuditLogs(10),
      ]);

      if (sumRes.status === 'fulfilled') summary = sumRes.value;
      if (trendRes.status === 'fulfilled') salesTrend = trendRes.value;
      if (prodRes.status === 'fulfilled') productPerformance = prodRes.value;
      if (zoneRes.status === 'fulfilled') zonePerformance = zoneRes.value;
      if (dssRes.status === 'fulfilled') dssConfig = dssRes.value;

      if (auditRes.status === 'fulfilled' && Array.isArray(auditRes.value) && auditRes.value.length > 0) {
        activities = auditRes.value.map((log: any) => ({
          id: log.id || String(Math.random()),
          timestamp: log.created_at
            ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : 'Baru saja',
          type: (log.entity_type?.toUpperCase() === 'RIDER' ? 'RIDER' : log.entity_type?.toUpperCase() === 'ZONE' ? 'ZONE' : 'CRON') as any,
          title: log.action || 'Audit Log Event',
          details: log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : log.status,
        }));
      } else {
        activities = [];
      }
    } catch (err) {
      console.warn('Gagal memuat dashboard:', err);
    } finally {
      loading = false;
    }
  };

  const handleRangeChange = async (newRange: string, customStart?: string, customEnd?: string) => {
    range = newRange;
    startDate = customStart || '';
    endDate = customEnd || '';
    try {
      const [trend, prod] = await Promise.all([
        dashboardService.getSalesTrend({ range: newRange, startDate: customStart, endDate: customEnd }),
        dashboardService.getProductPerformance({ range: newRange, startDate: customStart, endDate: customEnd }),
      ]);
      salesTrend = trend;
      productPerformance = prod;
    } catch (e) {
      console.warn('Gagal reload sales trend:', e);
    }
  };

  onMount(() => {
    loadDashboardData();

    // Socket real-time listeners
    const socket = getSocket();
    socket.on('rider:location_updated', (data: any) => {
      if (data && data.name) {
        activities = [
          {
            id: String(Date.now()),
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            type: 'RIDER',
            title: `${data.name} Update GPS`,
            details: `Kecepatan: ${data.speed || 0} km/h`,
          },
          ...activities.slice(0, 19),
        ];
      }
    });

    socket.on('fleet:status_updated', (data: any) => {
      activities = [
        {
          id: String(Date.now()),
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'FLEET',
          title: `Status Armada: ${data.plateNumber || 'Unit'}`,
          details: `Status: ${data.status}`,
        },
        ...activities.slice(0, 19),
      ];
    });

    // Check system initialization state from PostgreSQL
    setupStore.checkStatus();
  });

  const handleTriggerWeatherSync = async () => {
    await confirmModal.verify({
      context: 'WEATHER_SYNC_BROADCAST',
      targetName: 'Satelit Cuaca Sidoarjo & Sekitarnya',
      onConfirm: async () => {
        await dashboardService.syncWeather();
        await loadDashboardData();
      },
    });
  };

  const handleTriggerDssRecalculate = async () => {
    await confirmModal.verify({
      context: 'DSS_RECALIBRATE',
      targetName: 'Kalibrasi Bobot Standar Sidoarjo (BWM-TOPSIS)',
      onConfirm: async () => {
        await dssService.calculateBwmWeights({
          name: 'Konfigurasi Bobot BWM Kalibrasi Sidoarjo',
          best_criteria_id: '1',
          worst_criteria_id: '5',
          best_to_others: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 7, '6': 5 },
          worst_to_others: { '1': 7, '2': 5, '3': 4, '4': 3, '5': 1, '6': 2 },
        });
        await loadDashboardData();
      },
    });
  };
</script>

<div class="relative min-h-full font-outfit-400 select-none">
  <!-- First-Run System Setup Initialization Gate Modal -->
  {#if setupStore.isSetupRequired}
    <FirstRunSetupModal onStartSetup={() => onNavigate('/setup')} />
  {/if}

  <div class="space-y-5 pb-8 transition-all duration-500 {setupStore.isSetupRequired ? 'filter blur-xs opacity-25 pointer-events-none' : ''}">
    <!-- TOP TOOLBAR: Breadcrumb & Quick Action Bar with Split-Pill Design -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24242A]">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-outfit-600 text-[#71717A] uppercase tracking-wider">Super Admin Workspace</span>
          {#if setupStore.isCompleted}
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[10px] font-mono font-bold text-emerald-400 shadow-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SYSTEM ONLINE
            </span>
          {:else}
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/40 text-[10px] font-mono font-bold text-amber-400 shadow-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              SETUP REQUIRED
            </span>
          {/if}
        </div>
        <h2 class="text-xl sm:text-2xl lg:text-3xl font-outfit-600 text-white tracking-tight leading-tight mt-0.5">
          Executive Dashboard
        </h2>
      </div>

    <!-- Quick Action Bar (Pill Buttons as in screenshot) -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Sync Cuaca Pill -->
      <button
        onclick={handleTriggerWeatherSync}
        class="pill-btn-dark text-xs cursor-pointer"
      >
        <span class="px-3 py-1.5 flex items-center gap-1.5 font-outfit-600">
          <i class="bx bx-cloud-lightning text-amber-400"></i>
          <span>Cuaca</span>
        </span>
      </button>

      <!-- Hitung Ulang DSS Pill -->
      <button
        onclick={handleTriggerDssRecalculate}
        class="pill-btn-dark text-xs cursor-pointer"
      >
        <span class="px-3 py-1.5 flex items-center gap-1.5 font-outfit-600">
          <i class="bx bx-compass text-blue-400"></i>
          <span>DSS Engine</span>
        </span>
      </button>

      <!-- Katalog Pill (White Button) -->
      <button
        onclick={() => onNavigate('/catalog')}
        class="pill-btn-white text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5">
          <i class="bx bx-coffee text-sm text-[#FF634A]"></i>
          <span>Katalog Menu</span>
        </span>
      </button>

      <!-- Tambah User Pill (Orange Gradient Accent) -->
      <button
        onclick={() => onNavigate('/users')}
        class="pill-btn-orange text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5 text-white">
          <i class="bx bx-user-plus text-base"></i>
          <span>Tambah User</span>
        </span>
      </button>
    </div>
  </div>

  <!-- SECTION 0.5: QUICK ALERT CENTER (Perimeter Lapangan, Geofence, Baterai) -->
  <QuickAlertPanel
    {onNavigate}
    fleetAlertsCount={summary?.fleet?.maintenance_units || 0}
  />

  <!-- SECTION 1: 4 KPI CARDS (Penjualan Hari Ini di posisi paling kiri) -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    <StatCard
      title="Penjualan Hari Ini"
      value={`Rp ${((summary?.financials?.total_revenue || 0)).toLocaleString('id-ID')}`}
      subtitle={`${summary?.financials?.total_units_sold ?? 0} Cup (${summary?.financials?.total_transactions ?? 0} Trx)`}
      trendBadge="Realtime"
      trendType="success"
      iconClass="bx bx-shopping-bag"
      iconColor="text-[#FF634A] bg-[#FF634A]/10 border border-[#FF634A]/20"
      {loading}
    />

    <StatCard
      title="Bobot BWM (CR)"
      value={`ξ* ${(dssConfig?.consistency_ratio ?? 0.042).toFixed(3)}`}
      subtitle={`Best: ${dssConfig?.best_criterion || 'POTENSI_PASAR'} • Worst: ${dssConfig?.worst_criterion || 'JARAK_HUB'}`}
      trendBadge={(dssConfig?.consistency_ratio ?? 0.042) <= 0.1 || dssConfig?.is_consistent ? "Konsisten" : "Kalibrasi"}
      trendType={(dssConfig?.consistency_ratio ?? 0.042) <= 0.1 || dssConfig?.is_consistent ? "success" : "danger"}
      pulseBadge={(dssConfig?.consistency_ratio ?? 0.042) <= 0.1 || dssConfig?.is_consistent}
      iconClass="bx bx-compass"
      iconColor="text-purple-400 bg-purple-950/40 border border-purple-800/40"
      {loading}
    />

    <StatCard
      title="Rider Bertugas"
      value={`${summary?.operations?.assigned_riders ?? summary?.operations?.checked_in_riders ?? 0} / ${summary?.operations?.registered_riders ?? 0}`}
      subtitle="Sinyal GPS Bertugas"
      trendBadge="● LIVE"
      trendType="success"
      pulseBadge
      iconClass="bx bx-map-pin"
      iconColor="text-emerald-400 bg-emerald-950/40 border border-emerald-800/40"
      {loading}
    />

    <StatCard
      title="Armada Digunakan"
      value={`${summary?.fleet?.in_use_units ?? 0} / ${summary?.fleet?.total_units ?? 0}`}
      subtitle={`Utilisasi Armada (${summary?.fleet?.utilization_rate_percentage ?? 0}%)`}
      trendBadge={`${summary?.fleet?.maintenance_units ?? 0} Servis`}
      trendType={summary?.fleet?.maintenance_units ? "warning" : "neutral"}
      iconClass="bx bx-cycling"
      iconColor="text-amber-400 bg-amber-950/40 border border-amber-800/40"
      {loading}
    />
  </div>

  <!-- SECTION 1.5: HUB ATMOSPHERIC WEATHER RADAR WIDGET -->
  <HubAtmosphericRadarCard
    onSyncRequest={loadDashboardData}
  />

  <!-- SECTION 1.6: SYSTEM READINESS ORCHESTRATION WIDGET -->
  <SystemReadinessWidget
    {onNavigate}
  />

  <!-- SECTION 2: GRID ROW 1 (Sales Trend Chart + Produk Terlaris Leaderboard) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <div class="lg:col-span-8">
      <SalesChart
        trendData={salesTrend}
        {range}
        {startDate}
        {endDate}
        onRangeChange={handleRangeChange}
        {loading}
      />
    </div>

    <div class="lg:col-span-4">
      <TopSellingProductsCard
        products={productPerformance}
        {loading}
        onViewAll={() => onNavigate('/catalog')}
      />
    </div>
  </div>

  <!-- SECTION 3: GRID ROW 2 (Mini-Map Sebaran Live + DSS Engine Health + Activity Stream) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <div class="lg:col-span-6">
      <DashboardMiniMap
        onOpenFullMap={() => onNavigate('/map')}
      />
    </div>

    <div class="lg:col-span-3">
      <DssStatusCard
        {dssConfig}
        onRecalculateClick={() => dssModalOpen = true}
        {loading}
      />
    </div>

    <div class="lg:col-span-3">
      <ActivityFeed
        {activities}
        onClear={() => activities = []}
      />
    </div>
    </div>
  </div>
</div>

<!-- Modal Dialogs -->
<SyncWeatherModal
  isOpen={weatherModalOpen}
  onClose={() => weatherModalOpen = false}
  onSuccess={loadDashboardData}
/>

<RecalculateDssModal
  isOpen={dssModalOpen}
  onClose={() => dssModalOpen = false}
  onSuccess={loadDashboardData}
/>
