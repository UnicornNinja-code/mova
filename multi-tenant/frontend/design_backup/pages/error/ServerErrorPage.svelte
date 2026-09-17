<script lang="ts">
  import { ServerCrash, RefreshCw, LayoutDashboard, Terminal, ChevronDown, ChevronUp, Activity } from 'lucide-svelte';

  interface Props {
    onNavigate: (route: string) => void;
    errorMsg?: string;
    errorStack?: string;
    onRetry?: () => void;
  }

  let { 
    onNavigate, 
    errorMsg = 'Terjadi kesalahan pemrosesan pada backend Express / Bun atau basis data PostGIS.',
    errorStack = '',
    onRetry
  }: Props = $props();

  let retrying = $state(false);
  let showDetails = $state(false);

  const handleRetry = async () => {
    retrying = true;
    if (onRetry) {
      try {
        await onRetry();
      } catch (e) {
        console.error(e);
      } finally {
        retrying = false;
      }
    } else {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 500);
    }
  };
</script>

<div class="min-h-[75vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center font-outfit-400 relative overflow-hidden">
  <!-- Glowing Ambient Background Blurs -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none"></div>
  <div class="absolute -bottom-10 left-1/4 w-80 h-80 bg-rose-600/10 rounded-full blur-[120px] pointer-events-none"></div>

  <div class="relative z-10 max-w-lg w-full bg-[#131316]/90 backdrop-blur-xl border border-[#24242A] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
    <!-- Icon Container with Radiant Ring -->
    <div class="relative mx-auto w-24 h-24 flex items-center justify-center">
      <div class="absolute inset-0 bg-purple-500/20 rounded-full animate-ping opacity-30"></div>
      <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#1A1A20] to-[#2B1B34] border border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-500/10 text-purple-400">
        <ServerCrash class="w-10 h-10 animate-pulse" />
      </div>
      <span class="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-purple-500 text-white font-outfit-600 font-extrabold text-[11px] shadow-md">
        500
      </span>
    </div>

    <!-- Title & Explanation -->
    <div class="space-y-2">
      <h1 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
        Gangguan Layanan Internal Sistem
      </h1>
      <p class="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
        {errorMsg}
      </p>
    </div>

    <!-- Quick Navigation Actions -->
    <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
      <button
        onclick={handleRetry}
        disabled={retrying}
        class="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:opacity-95 text-[#09090B] text-xs font-outfit-600 font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#FF634A]/20 disabled:opacity-50"
      >
        <RefreshCw class="w-4 h-4 {retrying ? 'animate-spin' : ''}" />
        <span>{retrying ? 'Mencoba Menghubungkan...' : 'Muat Ulang (Retry)'}</span>
      </button>

      <button
        onclick={() => onNavigate('/dashboard')}
        class="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-[#1A1A20] hover:bg-[#23232A] text-zinc-300 hover:text-white border border-[#2C2C36] text-xs font-outfit-600 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <LayoutDashboard class="w-4 h-4" />
        <span>Ke Dashboard Utama</span>
      </button>
    </div>

    <!-- Collapsible Technical Debugging Info -->
    {#if errorStack}
      <div class="pt-3 border-t border-[#24242A] text-left">
        <button
          onclick={() => showDetails = !showDetails}
          class="w-full flex items-center justify-between text-[11px] text-[#71717A] hover:text-zinc-300 cursor-pointer"
        >
          <span class="flex items-center gap-1.5 font-mono">
            <Terminal class="w-3.5 h-3.5 text-purple-400" />
            <span>Detail Diagnostik Error</span>
          </span>
          {#if showDetails}
            <ChevronUp class="w-3.5 h-3.5" />
          {:else}
            <ChevronDown class="w-3.5 h-3.5" />
          {/if}
        </button>

        {#if showDetails}
          <pre class="mt-2 p-3 rounded-xl bg-[#0C0C0E] border border-[#202026] text-[10px] text-rose-300 font-mono overflow-x-auto max-h-40 whitespace-pre-wrap leading-tight">
            {errorStack}
          </pre>
        {/if}
      </div>
    {/if}
  </div>
</div>
