<script lang="ts">
  import { X, Building2, MapPin, Compass, CheckCircle2, Save } from 'lucide-svelte';
  import { systemReadinessService, type SystemReadinessReport } from '../../services/systemReadinessService';

  interface Props {
    open: boolean;
    onClose: () => void;
    currentReport: SystemReadinessReport | null;
    onSuccess: () => void;
  }

  let { open = false, onClose, currentReport = null, onSuccess }: Props = $props();

  let hubName = $state('');
  let hubAddress = $state('');
  let hubLat = $state('-7.4478');
  let hubLng = $state('112.7183');
  let radiusKm = $state('12');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);

  $effect(() => {
    if (open && currentReport?.hub_config) {
      hubName = currentReport.hub_config.name || 'Central Hub Sidoarjo';
      hubAddress = currentReport.hub_config.address || 'Jl. Pahlawan No. 1, Sidoarjo';
      hubLat = String(currentReport.hub_config.latitude || '-7.4478');
      hubLng = String(currentReport.hub_config.longitude || '112.7183');
      radiusKm = String(currentReport.hub_config.radius_km || '12');
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    submitting = true;
    errorMsg = null;

    try {
      await systemReadinessService.updateSettings({
        hub_name: hubName.trim(),
        hub_address: hubAddress.trim(),
        hub_latitude: parseFloat(hubLat),
        hub_longitude: parseFloat(hubLng),
        operational_radius_km: parseFloat(radiusKm),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan konfigurasi operasional.';
    } finally {
      submitting = false;
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-outfit-400">
    <button
      type="button"
      aria-label="Tutup modal pengaturan"
      class="fixed inset-0 bg-black/50 border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-lg bg-[#131316] border border-[#2E2E38] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center font-bold">
            <Building2 class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Fondasi Operasional & Central Hub</h3>
            <p class="text-xs text-[#A1A1AA]">Konfigurasi markas, koordinat spasial dan radius jangkauan wilayah</p>
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
        <!-- Hub Name -->
        <div class="space-y-1.5">
          <label for="form-hub-name" class="block font-outfit-600 text-zinc-300">
            Nama Markas Central Hub <span class="text-[#FF634A]">*</span>
          </label>
          <input
            id="form-hub-name"
            type="text"
            placeholder="Contoh: Central Hub Sidoarjo Kota"
            bind:value={hubName}
            required
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
          />
        </div>

        <!-- Hub Address -->
        <div class="space-y-1.5">
          <label for="form-hub-address" class="block font-outfit-600 text-zinc-300">
            Alamat Fisik Markas <span class="text-[#FF634A]">*</span>
          </label>
          <input
            id="form-hub-address"
            type="text"
            placeholder="Contoh: Jl. Pahlawan No. 1, Kab. Sidoarjo"
            bind:value={hubAddress}
            required
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
          />
        </div>

        <!-- Coordinates Row -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="form-hub-lat" class="block font-outfit-600 text-zinc-300">
              Latitude (Garis Lintang) <span class="text-[#FF634A]">*</span>
            </label>
            <input
              id="form-hub-lat"
              type="number"
              step="any"
              placeholder="-7.4478"
              bind:value={hubLat}
              required
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white font-mono text-xs focus:border-[#FF634A] focus:outline-none"
            />
          </div>

          <div class="space-y-1.5">
            <label for="form-hub-lng" class="block font-outfit-600 text-zinc-300">
              Longitude (Garis Bujur) <span class="text-[#FF634A]">*</span>
            </label>
            <input
              id="form-hub-lng"
              type="number"
              step="any"
              placeholder="112.7183"
              bind:value={hubLng}
              required
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white font-mono text-xs focus:border-[#FF634A] focus:outline-none"
            />
          </div>
        </div>

        <!-- Operational Radius (KM) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="form-hub-radius" class="block font-outfit-600 text-zinc-300">
              Radius Maksimal Operasional (Buffer Pembuatan Zona) <span class="text-[#FF634A]">*</span>
            </label>
            <span class="font-mono text-[#FF634A] font-bold">{radiusKm} KM</span>
          </div>
          <input
            id="form-hub-radius"
            type="range"
            min="3"
            max="30"
            step="1"
            bind:value={radiusKm}
            class="w-full accent-[#FF634A] cursor-pointer"
          />
          <p class="text-[10px] text-zinc-500">
            💡 Zona operasional baru yang dibuat tidak boleh keluar dari lingkaran radius ini dari Central Hub.
          </p>
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={submitting}
            class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <Save class="w-4 h-4" />
            <span>{submitting ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
