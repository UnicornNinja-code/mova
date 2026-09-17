<script lang="ts">
  import DssReportTab from '../../components/reports/DssReportTab.svelte';
  import BwmConfigReportTab from '../../components/reports/BwmConfigReportTab.svelte';
  import SalesReportTab from '../../components/reports/SalesReportTab.svelte';
  import AuditLogTab from '../../components/reports/AuditLogTab.svelte';
  import { 
    FileText, 
    Award, 
    Compass, 
    DollarSign, 
    Activity, 
    Download, 
    Printer, 
    ShieldCheck, 
    Layers 
  } from 'lucide-svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let activeTab = $state<'dss_snapshots' | 'dss_config' | 'sales' | 'audit_logs'>('dss_snapshots');
</script>

<div class="space-y-6 pb-12 font-outfit-400">
  <!-- TOP TOOLBAR: Breadcrumbs & Page Title -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24242A]">
    <div>
      <div class="text-[11px] font-outfit-600 text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
        <span>Pusat Laporan & Audit</span>
        <span>•</span>
        <span class="text-[#FF634A]">Ekspor Dokumen Resmi</span>
      </div>
      <h2 class="text-xl sm:text-2xl lg:text-3xl font-outfit-600 text-white tracking-tight leading-tight mt-0.5">
        Laporan Analitika & Audit Sistem
      </h2>
    </div>

    <!-- Quick Actions -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick={() => onNavigate('/dss')}
        class="pill-btn-dark text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5">
          <Compass class="w-3.5 h-3.5 text-purple-400" />
          <span>Konfigurasi DSS</span>
        </span>
      </button>

      <button
        onclick={() => onNavigate('/dashboard')}
        class="pill-btn-white text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5 text-[#09090B]">
          <i class="ri-dashboard-line text-sm text-[#FF634A]"></i>
          <span>Kembali ke Dashboard</span>
        </span>
      </button>
    </div>
  </div>

  <!-- MAIN 4-TAB NAVIGATION BAR -->
  <div class="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#24242A]">
    <!-- Tab 1: DSS Snapshots Report -->
    <button
      type="button"
      onclick={() => (activeTab = 'dss_snapshots')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'dss_snapshots'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Award class="w-4 h-4 {activeTab === 'dss_snapshots' ? 'text-[#FF634A]' : 'text-amber-400'}" />
      <span>1. Evaluasi & Snapshot DSS</span>
    </button>

    <!-- Tab 2: DSS BWM Configs -->
    <button
      type="button"
      onclick={() => (activeTab = 'dss_config')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'dss_config'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Compass class="w-4 h-4 {activeTab === 'dss_config' ? 'text-[#FF634A]' : 'text-purple-400'}" />
      <span>2. Konfigurasi Bobot BWM</span>
    </button>

    <!-- Tab 3: Sales Report -->
    <button
      type="button"
      onclick={() => (activeTab = 'sales')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'sales'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <DollarSign class="w-4 h-4 {activeTab === 'sales' ? 'text-[#FF634A]' : 'text-emerald-400'}" />
      <span>3. Penjualan & Omzet</span>
    </button>

    <!-- Tab 4: Audit Logs -->
    <button
      type="button"
      onclick={() => (activeTab = 'audit_logs')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'audit_logs'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Activity class="w-4 h-4 {activeTab === 'audit_logs' ? 'text-[#FF634A]' : 'text-blue-400'}" />
      <span>4. Audit Log Sistem</span>
    </button>
  </div>

  <!-- TAB CONTENT DISPLAY -->
  <div>
    {#if activeTab === 'dss_snapshots'}
      <DssReportTab />
    {:else if activeTab === 'dss_config'}
      <BwmConfigReportTab />
    {:else if activeTab === 'sales'}
      <SalesReportTab />
    {:else if activeTab === 'audit_logs'}
      <AuditLogTab />
    {/if}
  </div>
</div>
