<script lang="ts">
  import { onMount } from 'svelte';
  import { armadaService, type ArmadaItem, type FleetIssueItem } from '../../services/armadaService';
  import ArmadaFormModal from '../../components/fleet/ArmadaFormModal.svelte';
  import ArmadaHistoryModal from '../../components/fleet/ArmadaHistoryModal.svelte';
  import FleetInventoryGrid from '../../components/fleet/FleetInventoryGrid.svelte';
  import FleetIssuesTable from '../../components/fleet/FleetIssuesTable.svelte';
  import { confirmModal } from '../../lib/stores/confirmModal.svelte';
  import { 
    Bike, 
    Plus, 
    Search, 
    Filter, 
    CheckCircle2, 
    AlertTriangle, 
    Wrench, 
    Trash2, 
    Edit2, 
    Layers, 
    User,
    Clock,
    RefreshCw,
    History,
    ShieldAlert,
    Check,
    Tag,
    Inbox
  } from 'lucide-svelte';
  import Alert from '../../components/ui/Alert.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let activeTab = $state<'INVENTARIS' | 'ISSUES'>('INVENTARIS');

  let loading = $state(true);
  let armadas = $state<ArmadaItem[]>([]);
  let issues = $state<FleetIssueItem[]>([]);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  // Filters
  let searchQuery = $state('');
  let selectedType = $state('ALL');
  let selectedStatus = $state('ALL');
  let selectedReservation = $state('ALL');

  // Modals state
  let formModalOpen = $state(false);
  let historyModalOpen = $state(false);
  let selectedArmada = $state<ArmadaItem | null>(null);

  const loadData = async () => {
    loading = true;
    errorMsg = null;
    try {
      const [armadaData, issueData] = await Promise.all([
        armadaService.getAllArmadas(),
        armadaService.getAllIssueReports(),
      ]);
      armadas = armadaData;
      issues = issueData;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat data armada gerobak.';
    } finally {
      loading = false;
    }
  };

  const handleToggleMaintenance = async (item: ArmadaItem) => {
    const isMaintenance = item.status === 'MAINTENANCE';
    const nextStatus = isMaintenance ? 'ACTIVE' : 'MAINTENANCE';

    if (!isMaintenance && item.current_rider_id) {
      errorMsg = `Unit ${item.code} sedang bertugas di lapangan. Pengembalian harus diselesaikan terlebih dahulu.`;
      setTimeout(() => (errorMsg = null), 4000);
      return;
    }

    await confirmModal.verify({
      context: 'ARMADA_MAINTENANCE_OVERRIDE',
      title: nextStatus === 'MAINTENANCE' ? 'Alihkan Armada ke Mode Maintenance' : 'Aktifkan Kembali Unit Armada',
      subtitle: nextStatus === 'MAINTENANCE'
        ? `Mengalihkan unit ${item.code} (${item.type}) ke bengkel perbaikan. Unit tidak akan tersedia untuk penugasan.`
        : `Mengaktifkan kembali unit ${item.code} ke status siap pakai (ACTIVE) di Central Hub.`,
      targetName: `${item.code} — ${item.type}`,
      severity: nextStatus === 'MAINTENANCE' ? 'warning' : 'success',
      confirmLabel: nextStatus === 'MAINTENANCE' ? 'Alihkan ke Perbaikan' : 'Aktifkan Armada',
      verificationLabel: nextStatus === 'MAINTENANCE'
        ? `Saya mengonfirmasi bahwa unit ${item.code} telah berada di Central Hub untuk servis teknis.`
        : `Saya memastikan unit ${item.code} telah selesai diperbaiki dan siap jalan.`,
      onConfirm: async () => {
        await armadaService.updateArmada(item.id, { status: nextStatus });
        armadas = armadas.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a));
        successMsg = `Status unit ${item.code} diubah menjadi ${nextStatus}.`;
        setTimeout(() => (successMsg = null), 3000);
      },
    });
  };

  const handleDeleteArmada = async (item: ArmadaItem) => {
    if (item.current_rider_id || item.status === 'IN_USE') {
      errorMsg = `Unit ${item.code} sedang bertugas di lapangan dan tidak dapat dihapus.`;
      setTimeout(() => (errorMsg = null), 3500);
      return;
    }

    await confirmModal.verify({
      context: 'ARMADA_DELETE',
      targetName: `${item.code} — ${item.type}`,
      subtitle: `Hapus unit armada "${item.code}" dari sistem inventaris. Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        await armadaService.deleteArmada(item.id);
        armadas = armadas.filter((a) => a.id !== item.id);
        successMsg = `Unit armada ${item.code} berhasil dihapus.`;
        setTimeout(() => (successMsg = null), 3000);
      },
    });
  };

  const handleResolveIssue = async (issueId: string, action: 'RESOLVED' | 'SENT_TO_MAINTENANCE') => {
    await confirmModal.verify({
      context: action === 'SENT_TO_MAINTENANCE' ? 'ARMADA_MAINTENANCE_OVERRIDE' : 'CUSTOM',
      title: action === 'SENT_TO_MAINTENANCE' ? 'Pindahkan Armada ke Bengkel Servis' : 'Selesaikan Laporan Kendala',
      subtitle: action === 'SENT_TO_MAINTENANCE'
        ? 'Memindahkan unit armada terkait laporan kendala ke status MAINTENANCE.'
        : 'Menandai laporan kendala ini telah selesai ditangani secara teknis.',
      targetName: `Laporan Kendala #${issueId.slice(0, 8)}`,
      severity: action === 'SENT_TO_MAINTENANCE' ? 'warning' : 'success',
      confirmLabel: action === 'SENT_TO_MAINTENANCE' ? 'Kirim ke Bengkel' : 'Tandai Selesai',
      verificationLabel: 'Saya telah memverifikasi laporan teknis kendala armada ini.',
      onConfirm: async () => {
        await armadaService.resolveIssueReport(issueId, {
          status: action,
          resolution_notes: action === 'SENT_TO_MAINTENANCE' ? 'Unit dipindahkan ke bengkel perbaikan oleh admin.' : 'Masalah telah selesai ditangani.',
        });
        successMsg = action === 'SENT_TO_MAINTENANCE' ? 'Unit armada dipindahkan ke status MAINTENANCE.' : 'Kendala ditandai telah selesai.';
        setTimeout(() => (successMsg = null), 3000);
        loadData();
      },
    });
  };

  const openCreateModal = () => {
    selectedArmada = null;
    formModalOpen = true;
  };

  const openEditModal = (item: ArmadaItem) => {
    selectedArmada = item;
    formModalOpen = true;
  };

  const openHistoryModal = (item: ArmadaItem) => {
    selectedArmada = item;
    historyModalOpen = true;
  };

  const filteredArmadas = $derived(
    armadas.filter((a) => {
      const matchSearch =
        (a.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.current_rider_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = selectedType === 'ALL' || a.type === selectedType;
      const matchStatus = selectedStatus === 'ALL' || a.status === selectedStatus;
      const matchRes = selectedReservation === 'ALL' || a.reservation_state === selectedReservation;
      return matchSearch && matchType && matchStatus && matchRes;
    })
  );

  onMount(() => {
    loadData();
  });
</script>

<div class="space-y-6 pb-12 font-outfit-400">
  <!-- TOP TOOLBAR: Breadcrumbs & Page Title -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24242A]">
    <div>
      <div class="text-[11px] font-outfit-600 text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
        <span>Master Data</span>
        <span>•</span>
        <span class="text-[#FF634A]">Manajemen Armada 3-Dimensi</span>
      </div>
      <h2 class="text-xl sm:text-2xl lg:text-3xl font-outfit-600 text-white tracking-tight leading-tight mt-0.5">
        Master Armada, Status 3-Dimensi & Bengkel
      </h2>
    </div>

    <!-- Quick Actions -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick={openCreateModal}
        class="pill-btn-orange text-xs font-outfit-600 cursor-pointer"
      >
        <span class="px-4 py-2 flex items-center gap-1.5 text-white font-bold">
          <Plus class="w-4 h-4" />
          <span>Registrasi Armada</span>
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

  <!-- QUICK STATS CARDS: 3-DIMENSION METRICS -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-1 shadow-md">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Total Unit</span>
        <Bike class="w-4 h-4 text-white" />
      </div>
      <div class="text-2xl font-outfit-600 text-white font-mono">{armadas.length} <span class="text-xs text-[#A1A1AA] font-normal">Unit</span></div>
      <span class="text-[11px] text-[#A1A1AA]">Seluruh Inventaris</span>
    </div>

    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-1 shadow-md">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Aktif di Lapangan</span>
        <span class="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
      </div>
      <div class="text-2xl font-outfit-600 text-blue-400 font-mono">
        {armadas.filter((a) => a.current_rider_id || a.assignment_state === 'IN_USE').length} <span class="text-xs text-blue-400/70 font-normal">Unit</span>
      </div>
      <span class="text-[11px] text-blue-400/80">Penugasan Bertugas</span>
    </div>

    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-1 shadow-md">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Standby di Hub</span>
        <CheckCircle2 class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-emerald-400 font-mono">
        {armadas.filter((a) => a.status === 'ACTIVE' && !a.current_rider_id && a.reservation_state !== 'HELD').length} <span class="text-xs text-emerald-400/70 font-normal">Unit</span>
      </div>
      <span class="text-[11px] text-emerald-400/80">Siap Ditugaskan</span>
    </div>

    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-1 shadow-md">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Perawatan / Bengkel</span>
        <Wrench class="w-4 h-4 text-rose-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-rose-400 font-mono">
        {armadas.filter((a) => a.status === 'MAINTENANCE').length} <span class="text-xs text-rose-400/70 font-normal">Unit</span>
      </div>
      <span class="text-[11px] text-rose-400/80">Dalam Perbaikan</span>
    </div>
  </div>

  <!-- TAB NAVIGATION -->
  <div class="flex items-center gap-2 border-b border-[#24242A] pb-2">
    <button
      type="button"
      onclick={() => (activeTab = 'INVENTARIS')}
      class="px-4 py-2 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer flex items-center gap-2
      {activeTab === 'INVENTARIS' ? 'bg-[#FF634A] text-[#09090B] font-bold shadow-md shadow-[#FF634A]/20' : 'bg-[#18181D] text-zinc-400 hover:text-white'}"
    >
      <Bike class="w-4 h-4" />
      <span>Daftar Inventaris Armada</span>
      <span class="px-1.5 py-0.2 rounded-md text-[10px] {activeTab === 'INVENTARIS' ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'} font-mono">
        {armadas.length}
      </span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'ISSUES')}
      class="px-4 py-2 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer flex items-center gap-2
      {activeTab === 'ISSUES' ? 'bg-[#FF634A] text-[#09090B] font-bold shadow-md shadow-[#FF634A]/20' : 'bg-[#18181D] text-zinc-400 hover:text-white'}"
    >
      <ShieldAlert class="w-4 h-4" />
      <span>Laporan Kerusakan & Bengkel</span>
      {#if issues.filter(i => i.status === 'REPORTED').length > 0}
        <span class="px-1.5 py-0.2 rounded-md bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
          {issues.filter(i => i.status === 'REPORTED').length}
        </span>
      {/if}
    </button>
  </div>

  <!-- Feedback Alerts -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala">{errorMsg}</Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Berhasil">{successMsg}</Alert>
  {/if}

  {#if activeTab === 'INVENTARIS'}
    <FleetInventoryGrid
      {armadas}
      {loading}
      {searchQuery}
      {selectedType}
      {selectedStatus}
      {selectedReservation}
      onUpdateSearch={(val) => (searchQuery = val)}
      onUpdateType={(val) => (selectedType = val)}
      onUpdateStatus={(val) => (selectedStatus = val)}
      onUpdateReservation={(val) => (selectedReservation = val)}
      onOpenHistory={openHistoryModal}
      onOpenEdit={openEditModal}
      onToggleMaintenance={handleToggleMaintenance}
      onDelete={handleDeleteArmada}
    />
  {:else}
    <FleetIssuesTable
      {issues}
      onRefresh={loadData}
      onResolveIssue={handleResolveIssue}
    />
  {/if}
</div>

<!-- MODALS -->
<ArmadaFormModal
  open={formModalOpen}
  onClose={() => (formModalOpen = false)}
  armadaToEdit={selectedArmada}
  onSuccess={loadData}
/>

<ArmadaHistoryModal
  open={historyModalOpen}
  onClose={() => (historyModalOpen = false)}
  armada={selectedArmada}
/>
