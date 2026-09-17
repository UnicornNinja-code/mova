<script lang="ts">
  import { X, Bike, CheckCircle2, Shield } from 'lucide-svelte';
  import { armadaService, type ArmadaItem } from '../../services/armadaService';

  interface Props {
    open: boolean;
    onClose: () => void;
    armadaToEdit?: ArmadaItem | null;
    onSuccess?: () => void;
  }

  let { open = false, onClose, armadaToEdit = null, onSuccess }: Props = $props();

  let code = $state('');
  let type = $state('GEROBAK');
  let status = $state('ACTIVE');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);

  const isEditMode = $derived(!!armadaToEdit);

  $effect(() => {
    if (open) {
      errorMsg = null;
      if (armadaToEdit) {
        code = armadaToEdit.code || '';
        type = armadaToEdit.type || 'GEROBAK';
        status = armadaToEdit.status || 'ACTIVE';
      } else {
        code = '';
        type = 'GEROBAK';
        status = 'ACTIVE';
      }
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!code.trim()) {
      errorMsg = 'Kode seri atau plat armada wajib diisi.';
      return;
    }

    submitting = true;
    errorMsg = null;

    try {
      if (isEditMode && armadaToEdit) {
        await armadaService.updateArmada(armadaToEdit.id, {
          code: code.trim(),
          type,
          status,
        });
      } else {
        await armadaService.createArmada({
          code: code.trim(),
          type,
          status,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan data armada.';
    } finally {
      submitting = false;
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup modal armada"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-md bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/20">
            <Bike class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">
              {isEditMode ? 'Edit Data Armada' : 'Registrasi Unit Armada Baru'}
            </h3>
            <p class="text-xs text-[#A1A1AA]">
              {isEditMode ? `ID Unit #${armadaToEdit?.id}` : 'Tambahkan unit gerobak / e-bike kopi keliling'}
            </p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if errorMsg}
        <div class="p-3 bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs rounded-2xl">
          {errorMsg}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-4 text-xs">
        <!-- Serial Code / Plat Nomor -->
        <div class="space-y-1.5">
          <label for="form-armada-code" class="block font-outfit-600 text-zinc-300">
            Nomor Seri / Plat Unit <span class="text-[#FF634A]">*</span>
          </label>
          <input
            id="form-armada-code"
            type="text"
            placeholder="Contoh: ARM-01 atau W 1234 COZ"
            bind:value={code}
            required
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white font-mono text-xs sm:text-sm font-bold tracking-wide focus:border-[#FF634A] focus:outline-none uppercase"
          />
        </div>

        <!-- Armada Type -->
        <div class="space-y-1.5">
          <label for="form-armada-type" class="block font-outfit-600 text-zinc-300">
            Tipe Armada <span class="text-[#FF634A]">*</span>
          </label>
          <select
            id="form-armada-type"
            bind:value={type}
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
          >
            <option value="GEROBAK">GEROBAK MANUAL (Gerobak Kopi Dorong/Sepeda)</option>
            <option value="MOTOR_LISTRIK">MOTOR LISTRIK / E-BIKE (Armada Box Modern)</option>
            <option value="LAINNYA">LAINNYA (Unit Khusus Event / Booth Portable)</option>
          </select>
        </div>

        <!-- Operational Lifecycle Status -->
        <div class="space-y-1.5">
          <label for="form-armada-status" class="block font-outfit-600 text-zinc-300">
            Status Lifecycle Armada <span class="text-[#FF634A]">*</span>
          </label>
          <select
            id="form-armada-status"
            bind:value={status}
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
          >
            <option value="ACTIVE">ACTIVE (Armada Aktif & Layak Operasi)</option>
            <option value="MAINTENANCE">MAINTENANCE (Dalam Perawatan / Perbaikan)</option>
            <option value="RETIRED">RETIRED (Pensiun / Nonaktif Permanen)</option>
          </select>
          <p class="text-[10px] text-zinc-500">
            💡 Status reservasi (HELD) dan penugasan (IN_USE) diatur otomatis oleh sistem operasional harian.
          </p>
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={submitting}
            class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50"
          >
            <span class="px-5 py-2 flex items-center gap-1.5 text-white font-bold">
              <CheckCircle2 class="w-4 h-4" />
              <span>{submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Daftarkan Armada'}</span>
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
