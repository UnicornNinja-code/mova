<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    distributionService, 
    type DistributionOverview, 
    type DutyQueueItem, 
    type AssignmentItem,
    type ZoneDistributionItem,
    type ArmadaAvailableItem,
    type DistributionPreviewResponse
  } from '../../services/distributionService';
  import { userService, type UserAccountItem } from '../../services/userService';
  import DistributionPreviewModal from '../../components/distribution/DistributionPreviewModal.svelte';
  import DistributionRunsModal from '../../components/distribution/DistributionRunsModal.svelte';
  import EmergencySwapModal from '../../components/distribution/EmergencySwapModal.svelte';
  import { 
    Users, 
    MapPin, 
    Bike, 
    Sparkles, 
    RefreshCw, 
    Plus, 
    CheckCircle2, 
    Clock, 
    ArrowRight, 
    AlertTriangle, 
    ShieldCheck,
    ShieldAlert,
    Radio,
    Compass,
    History,
    Calendar,
    Eye,
    UserX,
    Check
  } from 'lucide-svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let previewLoading = $state(false);
  let committing = $state(false);

  let data = $state<DistributionOverview | null>(null);
  let ridersList = $state<UserAccountItem[]>([]);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  // Modals state
  let previewModalOpen = $state(false);
  let previewData = $state<DistributionPreviewResponse | null>(null);

  let runsModalOpen = $state(false);
  let emergencyModalOpen = $state(false);

  let manualModalOpen = $state(false);
  let selectedRiderId = $state('');
  let selectedZoneId = $state('');
  let selectedArmadaId = $state('');
  let assigning = $state(false);

  const loadData = async () => {
    loading = true;
    errorMsg = null;
    try {
      const [overviewRes, allUsersRes] = await Promise.allSettled([
        distributionService.getOverview(),
        userService.getAllUsers(),
      ]);

      if (overviewRes.status === 'fulfilled') data = overviewRes.value;
      if (allUsersRes.status === 'fulfilled') {
        ridersList = (allUsersRes.value || []).filter((u: any) => u.role === 'RIDER');
      }
    } catch (err: any) {
      errorMsg = err.message || 'Gagal memuat data distribusi dan antrean tugas.';
    } finally {
      loading = false;
    }
  };

  const handleOpenPreview = async () => {
    previewLoading = true;
    errorMsg = null;
    try {
      const res = await distributionService.getPreview();
      previewData = res;
      previewModalOpen = true;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal membuat simulasi preview alokasi.';
    } finally {
      previewLoading = false;
    }
  };

  const handleConfirmDistribution = async () => {
    if (!previewData || previewData.proposed_allocations.length === 0) return;

    committing = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await distributionService.confirmDistribution({
        execution_type: 'AUTO',
        allocations: previewData.proposed_allocations,
        unassigned_riders: previewData.unassigned_riders,
      });

      successMsg = res.message || res.msg || 'Distribusi otomatis berhasil dieksekusi dan disimpan ke database.';
      previewModalOpen = false;
      await loadData();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengonfirmasi eksekusi distribusi.';
    } finally {
      committing = false;
    }
  };

  const handleManualAssign = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!selectedRiderId || !selectedZoneId) {
      errorMsg = 'Pilih rider dan zona tujuan penugasan.';
      return;
    }

    assigning = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await distributionService.manualDistribute({
        rider_id: selectedRiderId,
        zone_id: selectedZoneId,
        armada_id: selectedArmadaId || undefined,
      });
      successMsg = res.message || res.msg || 'Penugasan manual berhasil disimpan.';
      manualModalOpen = false;
      selectedRiderId = '';
      selectedZoneId = '';
      selectedArmadaId = '';
      await loadData();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan penugasan manual.';
    } finally {
      assigning = false;
    }
  };

  const handleMarkNoShow = async (riderId: string) => {
    if (!confirm('Tandai rider ini sebagai NO_SHOW (Tidak Hadir)?')) return;
    try {
      await distributionService.updateRiderDutyStatus(riderId, 'NO_SHOW', 'Ditandai tidak hadir oleh supervisor.');
      successMsg = 'Status rider diperbarui menjadi NO_SHOW.';
      await loadData();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal memperbarui status rider.';
    }
  };

  onMount(() => {
    loadData();
  });
</script>

<div class="space-y-6 max-w-7xl mx-auto pb-12 font-outfit-400">
  <!-- PAGE HEADER & OPERATIONAL SESSION BADGE -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
    <div>
      <div class="flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-2xl bg-[#FF634A]/15 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center shadow-lg">
          <Compass class="w-5 h-5" />
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-outfit-600 text-white leading-tight">
              Pusat Distribusi, Sesi & Plotting
            </h1>
            {#if data?.session}
              <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{data.session.session_code}</span>
                <span class="text-[10px] text-zinc-400">({data.session.start_time.slice(0, 5)} - {data.session.end_time.slice(0, 5)})</span>
              </span>
            {/if}
          </div>
          <p class="text-xs sm:text-sm text-[#A1A1AA] mt-0.5">
            Orkestrasi Sesi Operasional, Antrean FIFO Rider, Rekomendasi TOPSIS & Commit Distribusi
          </p>
        </div>
      </div>
    </div>

    <!-- Action Toolbar -->
    <div class="flex flex-wrap items-center gap-2.5">
      <button
        onclick={loadData}
        class="p-2.5 rounded-2xl bg-[#1A1A20] hover:bg-[#24242E] text-zinc-300 hover:text-white border border-[#2E2E38] text-xs font-outfit-600 flex items-center gap-1.5 transition-all cursor-pointer"
        title="Muat Ulang Data"
      >
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
        <span class="hidden sm:inline">Refresh</span>
      </button>

      <button
        onclick={() => (runsModalOpen = true)}
        class="px-3.5 py-2.5 rounded-2xl bg-[#1A1A20] hover:bg-[#24242E] text-purple-300 border border-purple-800/40 text-xs font-outfit-600 flex items-center gap-2 transition-all cursor-pointer shadow-md"
      >
        <History class="w-4 h-4 text-purple-400" />
        <span>Log Audit Runs</span>
      </button>

      <button
        onclick={() => (emergencyModalOpen = true)}
        class="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-outfit-600 flex items-center gap-2 transition-all cursor-pointer shadow-md"
      >
        <ShieldAlert class="w-4 h-4 text-amber-400" />
        <span>Emergency Swap</span>
      </button>

      <button
        onclick={() => (manualModalOpen = true)}
        class="px-3.5 py-2.5 rounded-2xl bg-[#1A1A20] hover:bg-[#262630] text-white border border-[#333340] text-xs font-outfit-600 flex items-center gap-2 transition-all cursor-pointer shadow-md"
      >
        <Plus class="w-4 h-4 text-[#FF634A]" />
        <span>Penugasan Manual</span>
      </button>

      <button
        onclick={handleOpenPreview}
        disabled={previewLoading || (data?.summary?.total_waiting ?? 0) === 0}
        class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:opacity-95 text-[#09090B] text-xs font-outfit-600 font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Eye class="w-4 h-4 {previewLoading ? 'animate-spin' : ''}" />
        <span>{previewLoading ? 'Menyiapkan Preview...' : 'Review & Simulasi Auto Plotting'}</span>
      </button>
    </div>
  </div>

  <!-- FEEDBACK MESSAGES -->
  {#if errorMsg}
    <div class="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5 shadow-lg">
      <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{errorMsg}</span>
    </div>
  {/if}

  {#if successMsg}
    <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg">
      <ShieldCheck class="w-4 h-4 shrink-0 text-emerald-400" />
      <span>{successMsg}</span>
    </div>
  {/if}

  <!-- SECTION 1: 4 KPI CARDS -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    <!-- 1. Antrean Standby (FIFO) -->
    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-2 shadow-lg">
      <div class="flex items-center justify-between text-xs text-[#71717A] uppercase font-outfit-600">
        <span>Antrean Standby</span>
        <Clock class="w-4 h-4 text-amber-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-amber-400 font-mono">
        {data?.summary?.total_waiting ?? 0} <span class="text-xs text-[#71717A]">Rider</span>
      </div>
      <p class="text-[11px] text-[#A1A1AA] leading-none">Menunggu konfirmasi plotting</p>
    </div>

    <!-- 2. Rider Ditugaskan Hari Ini -->
    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-2 shadow-lg">
      <div class="flex items-center justify-between text-xs text-[#71717A] uppercase font-outfit-600">
        <span>Rider Plotted</span>
        <Users class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-emerald-400 font-mono">
        {data?.summary?.total_assigned ?? 0} <span class="text-xs text-[#71717A]">Bertugas</span>
      </div>
      <p class="text-[11px] text-[#A1A1AA] leading-none">Terkonfirmasi aktif pada sesi ini</p>
    </div>

    <!-- 3. Kuota Kapasitas Terisi -->
    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-2 shadow-lg">
      <div class="flex items-center justify-between text-xs text-[#71717A] uppercase font-outfit-600">
        <span>Kapasitas Zona</span>
        <MapPin class="w-4 h-4 text-[#FF634A]" />
      </div>
      <div class="text-2xl font-outfit-600 text-white font-mono">
        {data?.summary?.total_assigned ?? 0} / {data?.summary?.total_capacity ?? 0}
      </div>
      <p class="text-[11px] text-[#A1A1AA] leading-none">Sisa kuota: {data?.summary?.total_remaining_capacity ?? 0} slot</p>
    </div>

    <!-- 4. Armada Siap Pakai di Hub -->
    <div class="p-4 rounded-3xl bg-[#131316] border border-[#24242A] space-y-2 shadow-lg">
      <div class="flex items-center justify-between text-xs text-[#71717A] uppercase font-outfit-600">
        <span>Armada Standby</span>
        <Bike class="w-4 h-4 text-blue-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-blue-400 font-mono">
        {data?.summary?.available_armadas_count ?? 0} <span class="text-xs text-[#71717A]">Unit</span>
      </div>
      <p class="text-[11px] text-[#A1A1AA] leading-none">Tersedia di Central Hub Sidoarjo</p>
    </div>
  </div>

  <!-- SECTION 2: DUAL COLUMN WORKSPACE -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- LEFT COLUMN: LIVE ASSIGNMENTS TABLE (8 cols) -->
    <div class="lg:col-span-8 space-y-4">
      <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <Radio class="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 class="text-sm font-outfit-600 text-white">
              Daftar Penugasan Aktif Sesi Ini ({data?.session?.session_code || 'Live'})
            </h3>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
            {data?.assignments?.length ?? 0} Terplot
          </span>
        </div>

        {#if loading}
          <div class="py-16 text-center text-xs text-[#71717A] animate-pulse">
            Memuat daftar penugasan operasional...
          </div>
        {:else if !data?.assignments || data.assignments.length === 0}
          <div class="py-16 text-center text-xs text-[#71717A] space-y-2">
            <i class="ri-user-unfollow-line text-3xl text-zinc-600"></i>
            <p>Belum ada penugasan aktif pada sesi operasional ini.</p>
            <p class="text-[11px] text-zinc-500">Klik "Review & Simulasi Auto Plotting" untuk memulai penugasan batch.</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-[#A1A1AA]">
              <thead class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] border-b border-[#24242A] bg-[#17171C]">
                <tr>
                  <th class="p-3">Rider</th>
                  <th class="p-3">Zona Wilayah</th>
                  <th class="p-3">Armada</th>
                  <th class="p-3">Metode</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#202026]">
                {#each data.assignments as item}
                  {@const isCheckedIn = item.status === 'CHECKED_IN'}
                  <tr class="hover:bg-[#1A1A22] transition-colors">
                    <td class="p-3">
                      <div class="font-outfit-600 text-white">{item.rider_name}</div>
                      <div class="text-[10px] text-[#71717A] font-mono">{item.rider_email || '-'}</div>
                    </td>
                    <td class="p-3 font-outfit-600 text-zinc-200">
                      <div class="flex items-center gap-1.5">
                        <MapPin class="w-3.5 h-3.5 text-[#FF634A]" />
                        <span>{item.zone_name}</span>
                      </div>
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-lg bg-[#1F1F26] border border-[#2E2E38] text-zinc-300 font-mono text-[11px]">
                        {item.armada_code || 'Belum Klaim'}
                      </span>
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-bold {item.assignment_type === 'AUTO' ? 'bg-purple-950/60 text-purple-400 border border-purple-800/40' : 'bg-blue-950/60 text-blue-400 border border-blue-800/40'}">
                        {item.assignment_type}
                      </span>
                    </td>
                    <td class="p-3">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold {isCheckedIn ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'}">
                        {item.status}
                      </span>
                    </td>
                    <td class="p-3 text-right font-mono text-[10px] text-[#71717A]">
                      {item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Menunggu Check-In'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>

    <!-- RIGHT COLUMN: FIFO DUTY QUEUE & TOPSIS ZONE CAPACITIES (4 cols) -->
    <div class="lg:col-span-4 space-y-6">
      <!-- 1. FIFO Duty Queue Card -->
      <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-3">
        <div class="flex items-center justify-between pb-2.5 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <Clock class="w-4 h-4 text-amber-400" />
            <h4 class="text-xs font-outfit-600 text-white">Antrean FIFO Rider Standby</h4>
          </div>
          <span class="text-[10px] font-mono text-[#A1A1AA]">{data?.duty_queue?.length ?? 0} Antrean</span>
        </div>

        {#if !data?.duty_queue || data.duty_queue.length === 0}
          <div class="py-8 text-center text-xs text-[#71717A] space-y-1">
            <CheckCircle2 class="w-5 h-5 text-emerald-400 mx-auto opacity-60" />
            <p>Seluruh antrean rider telah di-plot ke zona wilayah.</p>
          </div>
        {:else}
          <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
            {#each data.duty_queue as q, idx}
              <div class="p-2.5 rounded-2xl bg-[#18181D] border border-[#24242A] flex items-center justify-between text-xs">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                    #{idx + 1}
                  </div>
                  <div class="min-w-0">
                    <span class="font-outfit-600 text-white truncate block">{q.rider_name}</span>
                    <span class="text-[10px] text-[#71717A] font-mono">
                      Check-in: {new Date(q.confirmed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onclick={() => handleMarkNoShow(q.rider_id)}
                    class="p-1 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Tandai Tidak Hadir (NO_SHOW)"
                  >
                    <UserX class="w-3.5 h-3.5" />
                  </button>
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-amber-950/50 text-amber-400 border border-amber-800/40">
                    WAITING
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 2. TOPSIS Zone Rankings & Remaining Capacities -->
      <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-3">
        <div class="flex items-center justify-between pb-2.5 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-[#FF634A]" />
            <h4 class="text-xs font-outfit-600 text-white">Prioritas Rekomendasi TOPSIS</h4>
          </div>
          <span class="text-[10px] text-[#FF634A] font-outfit-600 uppercase font-mono">
            Slot {data?.time_slot || 'PAGI'}
          </span>
        </div>

        {#if !data?.zones || data.zones.length === 0}
          <div class="py-6 text-center text-xs text-[#71717A]">
            Belum ada zona operasional aktif.
          </div>
        {:else}
          <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
            {#each data.zones as z, idx}
              <div class="p-2.5 rounded-2xl bg-[#18181D] border border-[#24242A] space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-4 h-4 rounded-full bg-[#FF634A]/20 text-[#FF634A] text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <strong class="text-white truncate">{z.zone_name}</strong>
                  </div>
                  <span class="text-[10px] font-mono text-[#71717A]">
                    Skor: {(z.topsis_score || z.score || 0.85).toFixed(3)}
                  </span>
                </div>

                <div class="flex items-center justify-between text-[10px] text-[#A1A1AA] pt-1 border-t border-[#24242A]">
                  <span>Kapasitas Terisi: <strong class="text-zinc-200">{z.assigned_count} / {z.max_capacity}</strong></span>
                  <span class="px-1.5 py-0.2 rounded text-[9px] font-mono {z.is_full ? 'bg-rose-950 text-rose-400' : 'bg-emerald-950 text-emerald-400'}">
                    {z.is_full ? 'PENUH' : `Sisa ${z.remaining_capacity}`}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- PREVIEW & SIMULATION MODAL -->
<DistributionPreviewModal
  open={previewModalOpen}
  onClose={() => (previewModalOpen = false)}
  previewData={previewData}
  onConfirm={handleConfirmDistribution}
  confirming={committing}
/>

<!-- RUNS AUDIT LOG MODAL -->
<DistributionRunsModal
  open={runsModalOpen}
  onClose={() => (runsModalOpen = false)}
/>

<!-- MANUAL ASSIGNMENT MODAL -->
{#if manualModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-outfit-400">
    <div class="w-full max-w-md bg-[#16161A] rounded-3xl border border-[#2E2E38] p-5 sm:p-6 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-2">
          <Plus class="w-5 h-5 text-[#FF634A]" />
          <h3 class="text-base font-outfit-600 text-white">Penugasan Manual Rider</h3>
        </div>
        <button onclick={() => (manualModalOpen = false)} aria-label="Tutup modal" class="text-[#71717A] hover:text-white cursor-pointer">
          <i class="ri-close-line text-xl"></i>
        </button>
      </div>

      <form onsubmit={handleManualAssign} class="space-y-3.5 text-xs">
        <!-- 1. Pilih Rider -->
        <div class="space-y-1">
          <label for="manual-rider-select" class="text-[#A1A1AA] font-bold block">Pilih Rider</label>
          <select
            id="manual-rider-select"
            bind:value={selectedRiderId}
            required
            class="w-full p-2.5 rounded-xl bg-[#1A1A20] border border-[#2E2E38] text-white focus:outline-none focus:border-[#FF634A]"
          >
            <option value="">-- Pilih Rider Bertugas --</option>
            {#each ridersList as r}
              <option value={r.id}>{r.name} ({r.email})</option>
            {/each}
          </select>
        </div>

        <!-- 2. Pilih Zona Tujuan -->
        <div class="space-y-1">
          <label for="manual-zone-select" class="text-[#A1A1AA] font-bold block">Pilih Zona Wilayah</label>
          <select
            id="manual-zone-select"
            bind:value={selectedZoneId}
            required
            class="w-full p-2.5 rounded-xl bg-[#1A1A20] border border-[#2E2E38] text-white focus:outline-none focus:border-[#FF634A]"
          >
            <option value="">-- Pilih Zona Tujuan --</option>
            {#each data?.zones || [] as z}
              <option value={z.zone_id || z.id} disabled={z.is_full}>
                {z.zone_name} (Sisa Kuota: {z.remaining_capacity}) {z.is_full ? '[PENUH]' : ''}
              </option>
            {/each}
          </select>
        </div>

        <!-- 3. Pilih Armada (Opsional) -->
        <div class="space-y-1">
          <label for="manual-armada-select" class="text-[#A1A1AA] font-bold block">Pilih Unit Armada (Opsional)</label>
          <select
            id="manual-armada-select"
            bind:value={selectedArmadaId}
            class="w-full p-2.5 rounded-xl bg-[#1A1A20] border border-[#2E2E38] text-white focus:outline-none focus:border-[#FF634A]"
          >
            <option value="">-- Biarkan Rider Mengklaim Mandiri --</option>
            {#each data?.available_armadas || [] as a}
              <option value={a.id}>{a.code} ({a.type})</option>
            {/each}
          </select>
        </div>

        <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={() => (manualModalOpen = false)}
            class="px-4 py-2 rounded-xl bg-[#202027] hover:bg-[#282832] text-zinc-300 text-xs font-outfit-600 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={assigning}
            class="px-4 py-2 rounded-xl bg-[#FF634A] hover:bg-[#FF4D30] text-white text-xs font-outfit-600 flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
          >
            <span>{assigning ? 'Menyimpan...' : 'Simpan Penugasan'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 3. Mid-Day Emergency Incident / Swap Modal -->
<EmergencySwapModal
  open={emergencyModalOpen}
  onClose={() => (emergencyModalOpen = false)}
  activeAssignments={data?.assignments || []}
  availableRiders={ridersList}
  onSuccess={(msg) => {
    successMsg = msg;
    loadData();
  }}
/>
