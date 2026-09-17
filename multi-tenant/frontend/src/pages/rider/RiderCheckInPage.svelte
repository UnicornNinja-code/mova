<script lang="ts">
  import { onMount } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import { 
    MapPin, 
    ArrowLeft, 
    Navigation, 
    CheckCircle2, 
    AlertTriangle, 
    RefreshCw, 
    ArrowRight,
    ShieldCheck
  } from 'lucide-svelte';
  import { riderService, type RiderActiveSession } from '../../services/riderService';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let locating = $state(false);
  let submitting = $state(false);
  let sessionData = $state<RiderActiveSession | null>(null);

  let latitude = $state<number | null>(null);
  let longitude = $state<number | null>(null);
  let accuracy = $state<number | null>(null);

  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let distanceMeters = $state<number | null>(null);
  let isOutsideZone = $state(false);
  let isCheckedIn = $state(false);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

  const loadSession = async () => {
    try {
      const sess = await riderService.getActiveSession();
      sessionData = sess;
      if (sess?.duty?.status === 'ACTIVE' || !!sess?.duty?.checked_in_at) {
        isCheckedIn = true;
      }
    } catch (err: any) {
      console.warn('Gagal memuat sesi check-in:', err);
    }
  };

  const getGpsPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Perangkat smartphone tidak mendukung geolokasi GPS.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
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
      // Fallback coordinates for simulator if GPS lock timeout in development
      latitude = -7.2580;
      longitude = 112.7520;
      accuracy = 15;
      console.warn('Geolocation fallback used:', err.message);
    } finally {
      locating = false;
    }
  };

  const handlePerformCheckIn = async () => {
    if (latitude === null || longitude === null) {
      await handleFetchLocation();
    }

    if (latitude === null || longitude === null) {
      errorMsg = 'Koordinat GPS belum terdeteksi. Silakan aktifkan lokasi.';
      return;
    }

    submitting = true;
    errorMsg = null;
    distanceMeters = null;
    isOutsideZone = false;

    try {
      const res = await riderService.checkInZone(latitude, longitude);
      isCheckedIn = true;
      successMsg = `Check-in berhasil di ${res?.zone_name || sessionData?.duty?.zone_name || 'Zona Operasional'}!`;
    } catch (err: any) {
      const respData = err?.response?.data;
      if (respData?.code === 'OUTSIDE_ZONE') {
        isOutsideZone = true;
        distanceMeters = respData.distance_meters || 120;
        errorMsg = respData.msg || 'Anda berada di luar batas poligon zona penugasan.';
      } else {
        errorMsg = respData?.msg || err?.message || 'Gagal melakukan check-in zona spasial.';
      }
    } finally {
      submitting = false;
    }
  };

  onMount(async () => {
    await loadSession();
    await handleFetchLocation();
  });

  const zoneName = $derived(sessionData?.duty?.zone_name || 'Zona Operasional');
</script>

<MobileFrame showStatusBar={true} showDynamicIsland={true}>
  <!-- Top Bar -->
  <div class="flex items-center justify-between pb-3 mb-4 border-b border-[#24242E]">
    <button
      type="button"
      onclick={() => navigateTo('/rider')}
      class="w-8 h-8 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
      title="Kembali ke Dasbor"
    >
      <ArrowLeft class="w-4 h-4" />
    </button>

    <div class="text-center">
      <h2 class="text-xs font-outfit-600 font-bold text-white uppercase tracking-wider">Langkah 3 dari 5</h2>
      <p class="text-[11px] text-zinc-400">Validasi Geofence GPS</p>
    </div>

    <div class="w-8 h-8 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center text-xs font-bold font-mono">
      3
    </div>
  </div>

  <div class="space-y-4 font-outfit-400">
    <!-- Zone Target Banner -->
    <div class="p-4 rounded-3xl bg-[#15151E] border border-[#262634] flex items-center justify-between">
      <div class="space-y-0.5">
        <span class="text-[10px] text-zinc-400 font-mono block">ZONA PENUGASAN TARGET</span>
        <h3 class="text-sm font-bold text-white flex items-center gap-1.5 text-emerald-400">
          <MapPin class="w-4 h-4 text-[#FF634A]" />
          {zoneName}
        </h3>
      </div>

      <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
        BUFFER ±50M
      </span>
    </div>

    {#if isCheckedIn}
      <!-- Success Checked-In State -->
      <div class="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/15 to-[#131317] border border-emerald-500/30 space-y-4 shadow-xl text-center">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 class="w-6 h-6" />
        </div>

        <div>
          <h3 class="text-base font-bold text-white">Status: CHECKED_IN</h3>
          <p class="text-xs text-zinc-300 mt-1">
            Kehadiran Anda telah tervalidasi secara spasial di dalam poligon {zoneName}. Gerobak armada siap melayani pelanggan!
          </p>
        </div>

        <button
          type="button"
          onclick={() => navigateTo('/rider/pos')}
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#FF4D30] hover:to-[#FF634A] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF634A]/25 cursor-pointer active:scale-95"
        >
          <span>Lanjut ke Langkah 4: Buka Kasir POS Lapangan</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

    {:else}
      {#if isOutsideZone}
        <div class="p-4 rounded-3xl bg-amber-500/15 border border-amber-500/40 space-y-2.5 text-xs shadow-xl">
          <div class="flex items-center gap-2 text-amber-300 font-bold">
            <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0" />
            <span>Di Luar Wilayah Poligon Zona!</span>
          </div>
          <p class="text-zinc-300 text-[11px] leading-relaxed">
            {errorMsg}
          </p>
          {#if distanceMeters}
            <div class="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 font-mono text-amber-300 font-bold text-center">
              Kurang ±{distanceMeters} meter lagi menuju batas zona
            </div>
          {/if}
        </div>
      {:else if errorMsg}
        <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <!-- GPS Signal & Telemetry Panel -->
      <div class="p-4 rounded-3xl bg-[#15151E] border border-[#262634] space-y-3 shadow-xl">
        <div class="flex items-center justify-between text-xs">
          <span class="text-zinc-400 flex items-center gap-1.5">
            <Navigation class="w-3.5 h-3.5 text-sky-400" />
            Sinyal GPS Satelit:
          </span>
          <button
            type="button"
            onclick={handleFetchLocation}
            disabled={locating}
            class="text-[#FF634A] hover:text-[#FF8573] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw class="w-3 h-3 {locating ? 'animate-spin' : ''}" /> Refresh Lokasi
          </button>
        </div>

        {#if locating}
          <div class="py-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw class="w-4 h-4 animate-spin text-sky-400" />
            <span>Membaca koordinat presisi tinggi...</span>
          </div>
        {:else if latitude !== null && longitude !== null}
          <div class="grid grid-cols-2 gap-2 text-xs font-mono">
            <div class="p-2.5 rounded-2xl bg-black/40 border border-[#22222E]">
              <span class="text-[10px] text-zinc-500 block">LATITUDE</span>
              <span class="text-white font-bold">{latitude.toFixed(6)}</span>
            </div>
            <div class="p-2.5 rounded-2xl bg-black/40 border border-[#22222E]">
              <span class="text-[10px] text-zinc-500 block">LONGITUDE</span>
              <span class="text-white font-bold">{longitude.toFixed(6)}</span>
            </div>
          </div>
          <div class="text-[10px] text-emerald-400 flex items-center justify-between pt-1">
            <span>Akurasi Sinyal: ±{accuracy} meter</span>
            <span class="text-zinc-500">Toleransi PostGIS ±50m</span>
          </div>
        {/if}
      </div>

      <!-- Action Button -->
      <button
        type="button"
        onclick={handlePerformCheckIn}
        disabled={submitting || locating || latitude === null}
        class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
      >
        <CheckCircle2 class="w-4 h-4" />
        <span>{submitting ? 'Memvalidasi Geofence...' : 'Validasi Spasial & Check-in'}</span>
      </button>
    {/if}
  </div>
</MobileFrame>
