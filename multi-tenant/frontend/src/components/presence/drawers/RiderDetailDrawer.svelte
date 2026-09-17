<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { axiosInstance } from '../../../lib/axios.js';
  import { X, Clock, MapPin, Activity, CheckCircle2, AlertTriangle, Shield } from 'lucide-svelte';

  interface Props {
    riderId: string;
    onClose: () => void;
  }

  let { riderId, onClose }: Props = $props();

  let drawerElement: HTMLDivElement | null = null;
  let previouslyFocusedElement: HTMLElement | null = null;
  let loading = $state(true);
  let historyEvents = $state<any[]>([]);
  let errorMsg = $state<string | null>(null);

  const fetchHistory = async () => {
    loading = true;
    errorMsg = null;
    try {
      const res = await axiosInstance.get(`/lbs/riders/${riderId}/presence-history`, {
        params: { limit: 30 },
      });
      if (res.data && res.data.data) {
        historyEvents = res.data.data;
      }
    } catch (err: any) {
      errorMsg = err.message || 'Gagal memuat riwayat kehadiran';
    } finally {
      loading = false;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  onMount(() => {
    previouslyFocusedElement = document.activeElement as HTMLElement;
    window.addEventListener('keydown', handleKeyDown);
    fetchHistory();
    // Focus close button inside drawer for accessibility
    const closeBtn = drawerElement?.querySelector('button');
    closeBtn?.focus();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    // Restore focus to trigger element for screen readers & keyboard users
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
    }
  });
</script>

<div
  bind:this={drawerElement}
  role="dialog"
  aria-modal="true"
  aria-labelledby="rider-drawer-title"
  class="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-[500] flex flex-col"
>
  <!-- Drawer Header -->
  <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
    <div class="flex items-center gap-2">
      <Activity class="w-4 h-4 text-amber-400" />
      <h3 id="rider-drawer-title" class="text-sm font-bold text-zinc-100">
        Riwayat Kehadiran & Transisi Spasial
      </h3>
    </div>
    <button
      type="button"
      onclick={onClose}
      aria-label="Tutup panel riwayat"
      class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
    >
      <X class="w-4 h-4" />
    </button>
  </div>

  <!-- Content Body -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    {#if loading}
      <div class="py-12 text-center text-xs text-zinc-400" role="status">
        <div class="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Memuat riwayat transisi geofence...
      </div>
    {:else if errorMsg}
      <div class="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs" role="alert">
        {errorMsg}
      </div>
    {:else if historyEvents.length === 0}
      <div class="py-12 text-center text-xs text-zinc-500">
        Belum ada riwayat transisi zona yang tercatat untuk rider ini.
      </div>
    {:else}
      <div class="space-y-3">
        {#each historyEvents as ev (ev.id)}
          <div class="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800 text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded font-extrabold text-[10px] border {ev.event_type === 'ENTER' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : ev.event_type === 'EXIT' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}">
                {ev.event_type}
              </span>
              <span class="text-[10px] text-zinc-400 flex items-center gap-1">
                <Clock class="w-3 h-3" />
                {new Date(ev.captured_at).toLocaleTimeString()} • {new Date(ev.captured_at).toLocaleDateString()}
              </span>
            </div>

            <div class="text-zinc-200">
              <b>Zona Terdeteksi:</b> {ev.zone_name || 'Di Luar Wilayah Operasional'}
            </div>

            <div class="text-[11px] text-zinc-400">
              <b>Status Kepatuhan:</b> <span class="{ev.compliance_status === 'COMPLIANT' ? 'text-emerald-400' : 'text-amber-400'} font-semibold">{ev.compliance_status}</span>
              {#if ev.assigned_zone_name}
                (Tugas: {ev.assigned_zone_name})
              {/if}
            </div>

            <div class="text-[10px] text-zinc-500 font-mono">
              Lat: {ev.latitude.toFixed(5)}, Lon: {ev.longitude.toFixed(5)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
