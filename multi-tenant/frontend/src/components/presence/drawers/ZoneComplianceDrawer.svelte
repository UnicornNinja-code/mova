<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { axiosInstance } from '../../../lib/axios.js';
  import { X, Layers, CheckCircle2, AlertTriangle, Users } from 'lucide-svelte';

  interface Props {
    zoneId: string;
    onClose: () => void;
  }

  let { zoneId, onClose }: Props = $props();

  let drawerElement: HTMLDivElement | null = null;
  let previouslyFocusedElement: HTMLElement | null = null;
  let loading = $state(true);
  let summary = $state<any | null>(null);
  let errorMsg = $state<string | null>(null);

  const fetchSummary = async () => {
    loading = true;
    errorMsg = null;
    try {
      const res = await axiosInstance.get(`/lbs/zones/${zoneId}/compliance-summary`);
      if (res.data && res.data.data) {
        summary = res.data.data;
      }
    } catch (err: any) {
      errorMsg = err.message || 'Gagal memuat ringkasan kepatuhan zona';
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
    fetchSummary();
    const closeBtn = drawerElement?.querySelector('button');
    closeBtn?.focus();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
    }
  });
</script>

<div
  bind:this={drawerElement}
  role="dialog"
  aria-modal="true"
  aria-labelledby="zone-drawer-title"
  class="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-[500] flex flex-col"
>
  <!-- Drawer Header -->
  <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
    <div class="flex items-center gap-2">
      <Layers class="w-4 h-4 text-amber-400" />
      <h3 id="zone-drawer-title" class="text-sm font-bold text-zinc-100">
        Ringkasan Kepatuhan Zona
      </h3>
    </div>
    <button
      type="button"
      onclick={onClose}
      aria-label="Tutup ringkasan zona"
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
        Memuat metrik occupancy & kepatuhan zona...
      </div>
    {:else if errorMsg}
      <div class="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs" role="alert">
        {errorMsg}
      </div>
    {:else if summary}
      <div class="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
        <div>
          <div class="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Nama Zona Operasi</div>
          <div class="text-base font-extrabold text-zinc-100">{summary.zone_name}</div>
        </div>

        <!-- Metric Grid -->
        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800">
          <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <div class="text-[10px] text-zinc-400 font-semibold">Total Hadir</div>
            <div class="text-xl font-extrabold text-zinc-100 mt-0.5">{summary.total_present}</div>
          </div>
          <div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
            <div class="text-[10px] text-emerald-400 font-semibold">Sesuai Tugas</div>
            <div class="text-xl font-extrabold text-emerald-400 mt-0.5">{summary.compliant_count}</div>
          </div>
          <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
            <div class="text-[10px] text-amber-400 font-semibold">Deviasi / Unassigned</div>
            <div class="text-xl font-extrabold text-amber-400 mt-0.5">{summary.deviated_count}</div>
          </div>
        </div>

        <!-- Compliance Progress Bar -->
        <div class="pt-2">
          <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Tingkat Kepatuhan Penugasan</span>
            <span class="font-bold text-zinc-200">
              {summary.total_present > 0 ? Math.round((summary.compliant_count / summary.total_present) * 100) : 0}%
            </span>
          </div>
          <div class="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              class="h-full bg-emerald-500 transition-all duration-500"
              style="width: {summary.total_present > 0 ? Math.round((summary.compliant_count / summary.total_present) * 100) : 0}%;"
            ></div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
