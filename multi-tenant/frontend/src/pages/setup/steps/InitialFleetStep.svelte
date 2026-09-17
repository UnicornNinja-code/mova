<script lang="ts">
  import { 
    Bike, 
    Plus, 
    Trash2, 
    AlertCircle, 
    ArrowRight, 
    ArrowLeft,
    CheckCircle2,
    Info
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';
  import type { InitialFleetUnit } from '../../../services/setupService';

  interface Props {
    onNext: () => void;
    onPrev: () => void;
  }

  let { onNext, onPrev }: Props = $props();

  let validationError = $state<string | null>(null);

  const fleetTypes = [
    { value: 'MOTOR', label: 'Sepeda Motor (Bensin)' },
    { value: 'MOTOR_LISTRIK', label: 'Motor Listrik (EV)' },
    { value: 'SEPEDA', label: 'Sepeda Kargo' },
    { value: 'GEROBAK', label: 'Gerobak Keliling' },
  ];

  const addFleetUnit = () => {
    validationError = null;
    const nextIndex = setupStore.fleets.length + 1;
    const paddedCode = `M-${String(nextIndex).padStart(3, '0')}`;
    setupStore.fleets.push({
      code: paddedCode,
      name: `Armada ${paddedCode}`,
      type: 'MOTOR',
      status: 'ACTIVE',
    });
  };

  const removeFleetUnit = (index: number) => {
    validationError = null;
    if (setupStore.fleets.length <= 1) {
      validationError = 'Minimal satu unit armada wajib didaftarkan untuk memulai operasional MOVA.';
      return;
    }
    setupStore.fleets.splice(index, 1);
  };

  const validateAndProceed = () => {
    validationError = null;

    if (setupStore.fleets.length === 0) {
      validationError = 'Minimal satu unit armada wajib didaftarkan.';
      return;
    }

    // Validate that every fleet has a unique code
    const codes = new Set<string>();
    for (const f of setupStore.fleets) {
      if (!f.code || !f.code.trim()) {
        validationError = 'Setiap armada harus memiliki Kode Armada yang valid.';
        return;
      }
      const upper = f.code.trim().toUpperCase();
      if (codes.has(upper)) {
        validationError = `Kode Armada '${upper}' duplikat. Setiap unit wajib memiliki kode unik.`;
        return;
      }
      codes.add(upper);
    }

    onNext();
  };
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 03</span>
      <span>•</span>
      <span>Armada Awal</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Armada pertama apa yang akan digunakan?
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      Daftarkan minimal satu unit kendaraan operasional awal Anda untuk mulai menjalankan layanan.
    </p>
  </div>

  {#if validationError}
    <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{validationError}</span>
    </div>
  {/if}

  <!-- Fleet Units List -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Daftar Unit Armada Awal ({setupStore.fleets.length} Unit)
      </h3>
      <button
        type="button"
        onclick={addFleetUnit}
        class="px-3 py-1.5 bg-[#24242A] hover:bg-[#2e2e36] text-zinc-200 hover:text-white border border-[#272730] rounded-xl text-xs font-outfit-600 transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5 text-[#FF634A]" />
        <span>Tambah Unit</span>
      </button>
    </div>

    <div class="space-y-3">
      {#each setupStore.fleets as fleet, index}
        <div class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 space-y-4 hover:border-zinc-700 transition-all">
          <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-[#FF634A]/10 border border-[#FF634A]/20 flex items-center justify-center text-[#FF634A]">
                <Bike class="w-4 h-4" />
              </div>
              <span class="text-xs font-outfit-700 text-white">Unit #{index + 1}</span>
            </div>

            {#if setupStore.fleets.length > 1}
              <button
                type="button"
                onclick={() => removeFleetUnit(index)}
                class="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                title="Hapus unit ini"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            {/if}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Fleet Code -->
            <div class="space-y-1">
              <label for="fleet-code-{index}" class="block text-[11px] font-outfit-600 text-zinc-400 uppercase">
                Kode Armada <span class="text-[#FF634A]">*</span>
              </label>
              <input
                id="fleet-code-{index}"
                type="text"
                bind:value={fleet.code}
                placeholder="cth. L-001"
                class="w-full px-3 py-2 bg-[#121214] border border-[#272730] rounded-xl text-xs sm:text-sm text-white font-mono uppercase focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
              />
            </div>

            <!-- Fleet Type -->
            <div class="space-y-1">
              <label for="fleet-type-{index}" class="block text-[11px] font-outfit-600 text-zinc-400 uppercase">
                Jenis Kendaraan
              </label>
              <select
                id="fleet-type-{index}"
                bind:value={fleet.type}
                class="w-full px-3 py-2 bg-[#121214] border border-[#272730] rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all cursor-pointer"
              >
                {#each fleetTypes as t}
                  <option value={t.value}>{t.label}</option>
                {/each}
              </select>
            </div>

            <!-- Fleet Status -->
            <div class="space-y-1">
              <label for="fleet-status-{index}" class="block text-[11px] font-outfit-600 text-zinc-400 uppercase">
                Status Awal
              </label>
              <select
                id="fleet-status-{index}"
                bind:value={fleet.status}
                class="w-full px-3 py-2 bg-[#121214] border border-[#272730] rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all cursor-pointer"
              >
                <option value="ACTIVE">Aktif (Siap Bertugas)</option>
                <option value="MAINTENANCE">Perawatan (Maintenance)</option>
              </select>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Reassurance Notice -->
  <div class="p-3.5 bg-[#18181D] border border-[#272730] rounded-xl flex items-start gap-2.5 text-xs text-zinc-300">
    <Info class="w-4 h-4 text-[#FF634A] shrink-0 mt-0.5" />
    <span class="leading-relaxed">
      Anda dapat menambahkan, mengubah, atau menonaktifkan unit armada lainnya kapan saja melalui menu <b>Manajemen Armada</b> setelah proses inisialisasi selesai.
    </span>
  </div>

  <!-- Wizard Navigation Actions -->
  <div class="pt-4 flex items-center justify-between gap-3">
    <button
      type="button"
      onclick={onPrev}
      class="px-5 py-2.5 rounded-xl text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Kembali</span>
    </button>
    <button
      type="button"
      onclick={validateAndProceed}
      class="px-6 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-lg shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer"
    >
      <span>Lanjutkan ke Preferensi Peta</span>
      <ArrowRight class="w-4 h-4" />
    </button>
  </div>
</div>
