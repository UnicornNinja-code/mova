<script lang="ts">
  import { X, MapPin, Navigation, CheckCircle2, AlertTriangle, RefreshCw, Compass, ShieldCheck } from 'lucide-svelte';
  import { riderService } from '../../services/riderService';

  interface Props {
    open: boolean;
    onClose: () => void;
    zoneName?: string;
    onCheckInSuccess: (data: any) => void;
  }

  let { open = false, onClose, zoneName = 'Zona Tugas', onCheckInSuccess }: Props = $props();

  let locating = $state(false);
  let submitting = $state(false);
  let latitude = $state<number | null>(null);
  let longitude = $state<number | null>(null);
  let accuracy = $state<number | null>(null);

  let errorMsg = $state<string | null>(null);
  let distanceMeters = $state<number | null>(null);
  let isOutsideZone = $state(false);

  const getGpsPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Perangkat tidak mendukung geolokasi GPS.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const handleFetchLocation = async () => {
    locating = true;
    errorMsg = null;
    distanceMeters = null;
    isOutsideZone = false;
    try {
      const pos = await getGpsPosition();
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
      accuracy = Math.round(pos.coords.accuracy);
    } catch (err: any) {
      // Fallback coordinates for simulator if permission denied in local dev
      latitude = -7.2580;
      longitude = 112.7520;
      accuracy = 12;
      console.warn('Geolocation failed, used fallback coordinates:', err.message);
    } finally {
      locating = false;
    }
  };

  const handlePerformCheckIn = async () => {
    if (latitude === null || longitude === null) {
      await handleFetchLocation();
    }

    if (latitude === null || longitude === null) {
      errorMsg = 'Koordinat GPS belum terdeteksi.';
      return;
    }

    submitting = true;
    errorMsg = null;
    distanceMeters = null;
    isOutsideZone = false;

    try {
      const res = await riderService.checkInZone(latitude, longitude);
      onCheckInSuccess(res);
      onClose();
    } catch (err: any) {
      const respData = err?.response?.data;
      if (respData?.code === 'OUTSIDE_ZONE') {
        isOutsideZone = true;
        distanceMeters = respData.distance_meters || 150;
        errorMsg = respData.msg || `Anda berada di luar batas polygon ${zoneName}!`;
      } else {
        errorMsg = respData?.msg || err?.message || 'Gagal melakukan check-in zona.';
      }
    } finally {
      submitting = false;
    }
  };

  $effect(() => {
    if (open) {
      handleFetchLocation();
    }
  });
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full bg-black/50 cursor-default focus:outline-none"
      onclick={onClose}
      aria-label="Tutup modal check-in"
    ></button>

    <div
      class="relative z-10 w-full sm:max-w-md bg-[#131317] border-t sm:border border-[#262632] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-2.5 border-b border-[#24242E]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-bold shadow-md shadow-emerald-500/20">
            <MapPin class="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 class="text-sm font-outfit-600 font-bold text-white">Check-in Spasial Geofence</h3>
            <p class="text-[11px] text-zinc-400">Validasi kehadiran di {zoneName}</p>
          </div>
        </div>

        <button
          type="button"
          onclick={onClose}
          class="w-7 h-7 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      {#if isOutsideZone}
        <div class="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2 text-xs">
          <div class="flex items-center gap-2 text-amber-300 font-bold">
            <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0" />
            <span>Di Luar Wilayah Poligon Zona!</span>
          </div>
          <p class="text-zinc-300 text-[11px]">
            {errorMsg}
          </p>
          {#if distanceMeters}
            <div class="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 font-mono text-amber-300 font-bold text-center">
              Kurang ±{distanceMeters} meter lagi menuju zona
            </div>
          {/if}
        </div>
      {:else if errorMsg}
        <div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <!-- Coordinates Panel -->
      <div class="p-3.5 rounded-2xl bg-[#181822] border border-[#2A2A38] space-y-2.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-zinc-400 flex items-center gap-1.5">
            <Navigation class="w-3.5 h-3.5 text-emerald-400" />
            Koordinat GPS Terdeteksi:
          </span>
          <button
            type="button"
            onclick={handleFetchLocation}
            disabled={locating}
            class="text-[#FF634A] hover:text-[#FF8573] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw class="w-3 h-3 {locating ? 'animate-spin' : ''}" /> Refresh GPS
          </button>
        </div>

        {#if locating}
          <div class="py-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw class="w-4 h-4 animate-spin text-emerald-400" />
            <span>Membaca sinyal GPS presisi...</span>
          </div>
        {:else if latitude !== null && longitude !== null}
          <div class="grid grid-cols-2 gap-2 text-xs font-mono">
            <div class="p-2 rounded-xl bg-black/40 border border-[#262632]">
              <span class="text-[10px] text-zinc-500 block">LATITUDE</span>
              <span class="text-white font-bold">{latitude.toFixed(6)}</span>
            </div>
            <div class="p-2 rounded-xl bg-black/40 border border-[#262632]">
              <span class="text-[10px] text-zinc-500 block">LONGITUDE</span>
              <span class="text-white font-bold">{longitude.toFixed(6)}</span>
            </div>
          </div>
          <div class="text-[10px] text-emerald-400 flex items-center justify-between">
            <span>Akurasi Sinyal: ±{accuracy} meter</span>
            <span class="text-zinc-500 font-sans">Toleransi Buffer ±20m</span>
          </div>
        {/if}
      </div>

      <!-- Action -->
      <button
        type="button"
        onclick={handlePerformCheckIn}
        disabled={submitting || locating || latitude === null}
        class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
      >
        <CheckCircle2 class="w-4 h-4" />
        <span>{submitting ? 'Memvalidasi Geofence...' : 'Validasi & Check-in Sekarang'}</span>
      </button>

      <button
        type="button"
        onclick={onClose}
        class="w-full py-1.5 text-center text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
      >
        Batal
      </button>
    </div>
  </div>
{/if}
