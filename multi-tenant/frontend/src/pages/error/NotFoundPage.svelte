<script lang="ts">
  import { Compass, ArrowLeft, LayoutDashboard, MapPin, Search } from 'lucide-svelte';

  interface Props {
    onNavigate: (route: string) => void;
    attemptedRoute?: string;
  }

  let { onNavigate, attemptedRoute = '' }: Props = $props();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      onNavigate('/dashboard');
    }
  };
</script>

<div class="min-h-[75vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center font-outfit-400 relative overflow-hidden">
  <!-- Glowing Ambient Background Blurs -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF634A]/10 rounded-full blur-[120px] pointer-events-none"></div>
  <div class="absolute -bottom-10 right-1/4 w-72 h-72 bg-purple-950/20 rounded-full blur-[100px] pointer-events-none"></div>

  <div class="relative z-10 max-w-lg w-full bg-[#131316]/90 backdrop-blur-xl border border-[#24242A] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
    <!-- Icon Container with Radiant Ring -->
    <div class="relative mx-auto w-24 h-24 flex items-center justify-center">
      <div class="absolute inset-0 bg-[#FF634A]/20 rounded-full animate-ping opacity-30"></div>
      <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#1A1A20] to-[#24242E] border border-[#FF634A]/40 flex items-center justify-center shadow-lg shadow-[#FF634A]/10 text-[#FF634A]">
        <Compass class="w-10 h-10 animate-spin" style="animation-duration: 20s;" />
      </div>
      <span class="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-[#FF634A] text-[#09090B] font-outfit-600 font-extrabold text-[11px] shadow-md">
        404
      </span>
    </div>

    <!-- Title & Explanation -->
    <div class="space-y-2">
      <h1 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
        Koordinat Halaman Tidak Ditemukan
      </h1>
      <p class="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
        Alamat URL atau modul spasial yang Anda tuju tidak terdaftar di dalam sistem COZIS.
      </p>
      {#if attemptedRoute}
        <div class="pt-1">
          <code class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1A1A1F] border border-[#2A2A34] text-[#FF634A] text-xs font-mono">
            <Search class="w-3 h-3 text-[#71717A]" />
            <span>{attemptedRoute}</span>
          </code>
        </div>
      {/if}
    </div>

    <!-- Quick Navigation Actions -->
    <div class="pt-3 border-t border-[#24242A] flex flex-col sm:flex-row items-center justify-center gap-3">
      <button
        onclick={handleBack}
        class="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-[#1A1A20] hover:bg-[#23232A] text-zinc-300 hover:text-white border border-[#2C2C36] text-xs font-outfit-600 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali Sebelumnya</span>
      </button>

      <button
        onclick={() => onNavigate('/dashboard')}
        class="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:opacity-95 text-[#09090B] text-xs font-outfit-600 font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#FF634A]/20"
      >
        <LayoutDashboard class="w-4 h-4" />
        <span>Ke Dashboard Utama</span>
      </button>
    </div>

    <!-- Secondary Link -->
    <div class="pt-1">
      <button
        onclick={() => onNavigate('/map')}
        class="text-xs text-[#A1A1AA] hover:text-[#FF634A] transition-colors cursor-pointer inline-flex items-center gap-1"
      >
        <MapPin class="w-3.5 h-3.5" />
        <span>Buka Pusat Komando Map Ops</span>
      </button>
    </div>
  </div>
</div>
