<script lang="ts">
  import { Search, History, Edit2, Wrench, Trash2 } from 'lucide-svelte';
  import type { ArmadaItem } from '../../services/armadaService';

  interface Props {
    armadas: ArmadaItem[];
    loading: boolean;
    searchQuery: string;
    selectedType: string;
    selectedStatus: string;
    selectedReservation: string;
    onUpdateSearch: (val: string) => void;
    onUpdateType: (val: string) => void;
    onUpdateStatus: (val: string) => void;
    onUpdateReservation: (val: string) => void;
    onOpenHistory: (item: ArmadaItem) => void;
    onOpenEdit: (item: ArmadaItem) => void;
    onToggleMaintenance: (item: ArmadaItem) => void;
    onDelete: (item: ArmadaItem) => void;
  }

  let {
    armadas,
    loading,
    searchQuery,
    selectedType,
    selectedStatus,
    selectedReservation,
    onUpdateSearch,
    onUpdateType,
    onUpdateStatus,
    onUpdateReservation,
    onOpenHistory,
    onOpenEdit,
    onToggleMaintenance,
    onDelete,
  }: Props = $props();

  let filteredArmadas = $derived(
    armadas.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.current_rider_name && item.current_rider_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedType === 'ALL' || item.type === selectedType;
      const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
      const matchReservation =
        selectedReservation === 'ALL' ||
        (selectedReservation === 'HELD' ? item.reservation_state === 'HELD' : item.reservation_state !== 'HELD');

      return matchSearch && matchType && matchStatus && matchReservation;
    })
  );
</script>

<div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
  <!-- Filter Toolbar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <!-- Search Input -->
    <div class="relative flex-1 max-w-sm">
      <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
      <input
        type="text"
        placeholder="Cari nomor seri, rider..."
        value={searchQuery}
        oninput={(e) => onUpdateSearch((e.target as HTMLInputElement).value)}
        class="w-full pl-9 pr-4 py-2 text-xs bg-[#1A1A1F] border border-[#2E2E38] rounded-xl text-white placeholder-[#71717A] focus:border-[#FF634A] focus:outline-none"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <!-- Type Filter -->
      <select
        value={selectedType}
        onchange={(e) => onUpdateType((e.target as HTMLSelectElement).value)}
        class="px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
      >
        <option value="ALL">Semua Tipe</option>
        <option value="GEROBAK">Gerobak Manual</option>
        <option value="MOTOR_LISTRIK">Motor Listrik (E-Bike)</option>
        <option value="LAINNYA">Lainnya</option>
      </select>

      <!-- Status Lifecycle Filter -->
      <select
        value={selectedStatus}
        onchange={(e) => onUpdateStatus((e.target as HTMLSelectElement).value)}
        class="px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
      >
        <option value="ALL">Semua Lifecycle</option>
        <option value="ACTIVE">ACTIVE (Layak Operasi)</option>
        <option value="MAINTENANCE">MAINTENANCE (Perbaikan)</option>
        <option value="RETIRED">RETIRED (Pensiun)</option>
      </select>

      <!-- Reservation State Filter -->
      <select
        value={selectedReservation}
        onchange={(e) => onUpdateReservation((e.target as HTMLSelectElement).value)}
        class="px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
      >
        <option value="ALL">Semua Reservasi</option>
        <option value="AVAILABLE">AVAILABLE (Bebas)</option>
        <option value="HELD">HELD (Di-Hold 5 Mnt)</option>
      </select>
    </div>
  </div>

  <!-- Table -->
  <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
    <table class="w-full text-xs text-left">
      <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
        <tr>
          <th class="py-3 px-4">Nomor Seri / Kode Unit</th>
          <th class="py-3 px-4">Tipe Armada</th>
          <th class="py-3 px-3 text-center">Status Lifecycle</th>
          <th class="py-3 px-3 text-center">Reservasi 5-Mnt</th>
          <th class="py-3 px-4">Penugasan Rider</th>
          <th class="py-3 px-4 text-center">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[#24242A]">
        {#if loading}
          <tr>
            <td colspan="6" class="py-8 text-center text-xs text-[#A1A1AA]">
              <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
              <div>Memuat data master armada gerobak...</div>
            </td>
          </tr>
        {:else if filteredArmadas.length === 0}
          <tr>
            <td colspan="6" class="py-8 text-center text-xs text-[#71717A]">
              Tidak ada data unit armada yang sesuai filter pencarian.
            </td>
          </tr>
        {:else}
          {#each filteredArmadas as item}
            <tr class="hover:bg-[#1D1D24] transition-colors {item.status === 'RETIRED' ? 'opacity-50' : ''}">
              <td class="py-3.5 px-4 font-mono font-bold text-white">
                <div class="flex items-center gap-2">
                  <span class="text-[#FF8573]">{item.code}</span>
                  <span class="text-zinc-500 font-sans font-normal text-[11px] truncate max-w-[150px]">ID #{item.id}</span>
                </div>
              </td>
              <td class="py-3.5 px-4 text-zinc-300">
                <span class="px-2 py-0.5 rounded-lg bg-[#202028] border border-[#2B2B36] text-[11px]">
                  {item.type}
                </span>
              </td>
              <td class="py-3.5 px-3 text-center">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 font-bold
                {item.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 
                 item.status === 'MAINTENANCE' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 
                 'bg-zinc-800 text-zinc-400'}">
                  {item.status}
                </span>
              </td>
              <td class="py-3.5 px-3 text-center">
                {#if item.reservation_state === 'HELD'}
                  <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono animate-pulse">
                    HELD (5M)
                  </span>
                {:else}
                  <span class="text-[11px] text-zinc-500 font-mono">AVAILABLE</span>
                {/if}
              </td>
              <td class="py-3.5 px-4">
                {#if item.current_rider_name}
                  <div class="text-zinc-200 font-outfit-600">{item.current_rider_name}</div>
                {:else}
                  <span class="text-zinc-500 italic text-[11px]">Belum ditugaskan</span>
                {/if}
              </td>
              <td class="py-3.5 px-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onclick={() => onOpenHistory(item)}
                    class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#24242C] transition-colors cursor-pointer"
                    title="Riwayat Pemakaian & Servis"
                  >
                    <History class="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onclick={() => onOpenEdit(item)}
                    class="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-[#24242C] transition-colors cursor-pointer"
                    title="Edit Data Armada"
                  >
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onclick={() => onToggleMaintenance(item)}
                    class="p-1.5 rounded-lg transition-colors cursor-pointer
                    {item.status === 'MAINTENANCE' ? 'text-emerald-400 hover:bg-emerald-950/40' : 'text-amber-400 hover:bg-amber-950/40'}"
                    title={item.status === 'MAINTENANCE' ? 'Selesai Servis (Set ACTIVE)' : 'Set Masuk Bengkel (MAINTENANCE)'}
                  >
                    <Wrench class="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onclick={() => onDelete(item)}
                    disabled={!!item.current_rider_id || item.status === 'IN_USE'}
                    class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Hapus Unit Armada"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
