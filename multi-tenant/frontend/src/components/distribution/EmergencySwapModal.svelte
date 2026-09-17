<script lang="ts">
  import { X, AlertTriangle, ArrowRight, ShieldAlert, Bike, MapPin, User, CheckCircle2 } from 'lucide-svelte';
  import { distributionService, type AssignmentItem } from '../../services/distributionService';
  import type { UserAccountItem } from '../../services/userService';

  interface Props {
    open: boolean;
    onClose: () => void;
    activeAssignments: AssignmentItem[];
    availableRiders: UserAccountItem[];
    onSuccess: (msg: string) => void;
  }

  let { open = false, onClose, activeAssignments = [], availableRiders = [], onSuccess }: Props = $props();

  let selectedPreviousRiderId = $state('');
  let selectedNewRiderId = $state('');
  let incidentType = $state('FLAT_TIRE');
  let armadaAction = $state<'KEEP_ARMADA' | 'SWAP_ARMADA'>('KEEP_ARMADA');
  let notes = $state('');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);

  const incidentOptions = [
    { value: 'FLAT_TIRE', label: 'Ban Bocor / Kempes', icon: '🛞' },
    { value: 'VEHICLE_BREAKDOWN', label: 'Kerusakan Mesin / Rangka', icon: '⚙️' },
    { value: 'EQUIPMENT_DAMAGE', label: 'Kerusakan Komponen / Rantai', icon: '🔧' },
    { value: 'ACCIDENT', label: 'Insiden / Kecelakaan Ringan', icon: '💥' },
    { value: 'MEDICAL', label: 'Rider Sakit / Kelelahan', icon: '🩺' },
    { value: 'WEATHER', label: 'Cuaca Ekstrem / Banjir', icon: '⛈️' },
    { value: 'OTHER', label: 'Lain-lain', icon: '📝' },
  ];

  const selectedOldAssignment = $derived(
    activeAssignments.find((a) => String(a.rider_id) === String(selectedPreviousRiderId))
  );

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!selectedPreviousRiderId || !selectedNewRiderId) {
      errorMsg = 'Pilih rider yang mengalami insiden dan rider pengganti.';
      return;
    }

    if (selectedPreviousRiderId === selectedNewRiderId) {
      errorMsg = 'Rider pengganti tidak boleh sama dengan rider yang mengalami insiden.';
      return;
    }

    submitting = true;
    errorMsg = null;
    try {
      const res = await distributionService.emergencySwap({
        previous_rider_id: selectedPreviousRiderId,
        new_rider_id: selectedNewRiderId,
        incident_type: incidentType,
        notes: notes.trim() || 'Pengalihan tugas darurat di lapangan oleh Supervisor',
        armada_action: armadaAction,
      });

      onSuccess(res.msg || 'Pengalihan tugas darurat berhasil dieksekusi!');
      onClose();
      // Reset form
      selectedPreviousRiderId = '';
      selectedNewRiderId = '';
      notes = '';
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memproses pengalihan tugas darurat.';
    } finally {
      submitting = false;
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-outfit-400 animate-in fade-in duration-200">
    <!-- Backdrop button -->
    <button
      type="button"
      aria-label="Tutup modal pengalihan tugas darurat"
      class="fixed inset-0 bg-transparent border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-2xl bg-[#131317] border border-amber-500/30 rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[92vh] overflow-y-auto flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242E]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <ShieldAlert class="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-outfit-600 font-bold text-white">Protokol Pengalihan Tugas Darurat</h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Mid-Day Incident
              </span>
            </div>
            <p class="text-xs text-zinc-400">
              Transfer penugasan zona dan gerobak saat terjadi insiden di lapangan
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick={onClose}
          class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1E1E28] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if errorMsg}
        <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-4 text-xs">
        <!-- 1. Rider yang Mengalami Kendala -->
        <div class="space-y-1.5">
          <label for="old-rider-select" class="text-zinc-300 font-bold block flex items-center gap-1.5">
            <User class="w-3.5 h-3.5 text-amber-400" />
            1. Rider Bertugas yang Mengalami Insiden
          </label>
          <select
            id="old-rider-select"
            bind:value={selectedPreviousRiderId}
            required
            class="w-full p-2.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">-- Pilih Rider Aktif di Lapangan --</option>
            {#each activeAssignments as a}
              <option value={a.rider_id}>
                {a.rider_name || 'Rider'} — Zona: {a.zone_name || 'Zona'} {a.armada_code ? `[Armada: ${a.armada_code}]` : ''} ({a.status})
              </option>
            {/each}
          </select>
        </div>

        <!-- Info Card Rider Lama -->
        {#if selectedOldAssignment}
          <div class="p-3 rounded-2xl bg-[#181822] border border-[#2B2B3C] space-y-1.5 text-zinc-300">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-zinc-400">Zona Penugasan Saat Ini:</span>
              <span class="font-bold text-white flex items-center gap-1">
                <MapPin class="w-3.5 h-3.5 text-[#FF634A]" />
                {selectedOldAssignment.zone_name || '-'}
              </span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-zinc-400">Armada Terpasang:</span>
              <span class="font-bold text-emerald-400 flex items-center gap-1">
                <Bike class="w-3.5 h-3.5" />
                {selectedOldAssignment.armada_code || 'Belum Klaim Armada'}
              </span>
            </div>
          </div>
        {/if}

        <!-- 2. Rider Pengganti (Relief Rider) -->
        <div class="space-y-1.5">
          <label for="new-rider-select" class="text-zinc-300 font-bold block flex items-center gap-1.5">
            <ArrowRight class="w-3.5 h-3.5 text-emerald-400" />
            2. Rider Pengganti (Relief Rider)
          </label>
          <select
            id="new-rider-select"
            bind:value={selectedNewRiderId}
            required
            class="w-full p-2.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">-- Pilih Rider Siaga / Standby --</option>
            {#each availableRiders as r}
              {#if String(r.id) !== String(selectedPreviousRiderId)}
                <option value={r.id}>
                  {r.name} ({r.email})
                </option>
              {/if}
            {/each}
          </select>
        </div>

        <!-- 3. Jenis Insiden & Tindakan Armada -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="incident-type-select" class="text-zinc-300 font-bold block">
              3. Jenis Insiden Lapangan
            </label>
            <select
              id="incident-type-select"
              bind:value={incidentType}
              class="w-full p-2.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white focus:outline-none focus:border-amber-500"
            >
              {#each incidentOptions as opt}
                <option value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              {/each}
            </select>
          </div>

          <div class="space-y-1.5">
            <span class="text-zinc-300 font-bold block">
              4. Tindakan Terhadap Armada
            </span>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onclick={() => (armadaAction = 'KEEP_ARMADA')}
                class={`p-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                  armadaAction === 'KEEP_ARMADA'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-[#181822] border-[#2A2A38] text-zinc-400 hover:text-white'
                }`}
              >
                Gunakan Unit Sama
              </button>
              <button
                type="button"
                onclick={() => (armadaAction = 'SWAP_ARMADA')}
                class={`p-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                  armadaAction === 'SWAP_ARMADA'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-[#181822] border-[#2A2A38] text-zinc-400 hover:text-white'
                }`}
              >
                Tarik Service Hub
              </button>
            </div>
          </div>
        </div>

        <!-- 5. Catatan Detail Insiden -->
        <div class="space-y-1.5">
          <label for="incident-notes-input" class="text-zinc-300 font-bold block">
            5. Catatan Detail Insiden / Instruksi Supervisor
          </label>
          <textarea
            id="incident-notes-input"
            bind:value={notes}
            rows="2"
            placeholder="Contoh: Ban belakang bocor di Jl. Tunjungan dekat Hotel Majapahit, rider pengganti langsung menuju lokasi fisik."
            class="w-full p-2.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
          ></textarea>
        </div>

        <!-- Action Buttons -->
        <div class="pt-3 border-t border-[#24242E] flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 rounded-xl bg-[#1F1F28] hover:bg-[#282834] text-zinc-300 text-xs font-outfit-600 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            class="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{submitting ? 'Memproses Pengalihan...' : 'Eksekusi Pengalihan Tugas'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
