<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Building2, 
    Clock, 
    Bike, 
    Map, 
    BrainCircuit, 
    Database, 
    CheckCircle2, 
    ArrowRight,
    Shield
  } from 'lucide-svelte';
  import { DotPattern } from '$components/ui/dot-pattern';
  import { setupStore } from '../../lib/stores/setupStore.svelte';
  import { authStore } from '../../lib/stores/auth.svelte';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  const setupSteps = [
    { num: 1, label: 'Identitas Hub', icon: Building2 },
    { num: 2, label: 'Kebijakan Ops', icon: Clock },
    { num: 3, label: 'Armada Awal', icon: Bike },
    { num: 4, label: 'Basemap GIS', icon: Map },
    { num: 5, label: 'Model DSS BWM', icon: BrainCircuit },
    { num: 6, label: 'Sinkronisasi Data', icon: Database },
    { num: 7, label: 'Aktivasi Sistem', icon: CheckCircle2 },
  ];

  onMount(async () => {
    // Check if setup is already completed
    const status = await setupStore.checkStatus();
    if (status && status.status === 'COMPLETED') {
      onNavigate('/dashboard');
    }
  });

  const handleStartSetup = () => {
    onNavigate('/setup');
  };
</script>

<div class="relative min-h-screen w-full flex items-center justify-center bg-[#09090b] px-4 py-12 overflow-hidden font-sans selection:bg-[#FF634A]/30">
  <!-- Ambient Dot Pattern with Masking -->
  <DotPattern
    class="[mask-image:radial-gradient(800px_circle_at_center,white,transparent)] opacity-40 fill-zinc-500 pointer-events-none"
    width={20}
    height={20}
    cr={1.2}
  />

  <!-- Ambient Radiant Glow Orbs -->
  <div class="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-[#FF634A]/10 blur-[128px] pointer-events-none"></div>
  <div class="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[128px] pointer-events-none"></div>

  <!-- Background Mova Typography Watermark matching Logo -->
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
    <span class="font-heading text-[12rem] sm:text-[18rem] md:text-[24rem] font-black tracking-[-0.035em] text-white/[0.045] leading-none select-none">
      Mova<span class="text-[#FF634A]/30">.</span>
    </span>
  </div>

  <!-- Centered Setup Entry Card -->
  <div class="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#131316]/90 p-8 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-10 space-y-6">
    
    <!-- Header Section -->
    <div class="text-center space-y-2">
      <h1 class="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Setup Lingkungan Operasional Pertama Kali
      </h1>
      <p class="text-xs text-zinc-400 font-sans leading-relaxed">
        Lengkapi konfigurasi dasar untuk menyiapkan lingkungan kerja, batas wilayah operasional, dan mesin pendukung keputusan.
      </p>
    </div>

    <!-- Concise Step Pills Grid (Compact 2-Column Overview) -->
    <div class="p-3.5 rounded-2xl bg-[#18181D]/80 border border-white/5 space-y-2.5">
      <div class="flex items-center justify-between text-xs pb-1.5 border-b border-white/10 text-zinc-300 font-medium">
        <span>Tahapan Konfigurasi</span>
        <span class="text-[10px] font-mono text-[#FF8573] bg-[#FF634A]/10 px-2 py-0.5 rounded border border-[#FF634A]/20">
          7 Langkah
        </span>
      </div>

      <div class="grid grid-cols-2 gap-1.5 pt-0.5">
        {#each setupSteps as step}
          <div class="flex items-center gap-2 p-1.5 px-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-300">
            <div class="w-4 h-4 rounded-md bg-[#FF634A]/10 border border-[#FF634A]/20 flex items-center justify-center text-[#FF8573] text-[10px] font-mono font-semibold shrink-0">
              {step.num}
            </div>
            <span class="truncate">{step.label}</span>
          </div>
        {/each}
        <div class="flex items-center justify-center p-1.5 rounded-xl bg-[#FF634A]/5 border border-[#FF634A]/10 text-[10px] text-[#FF8573] font-medium">
          Estimasi: ~2 Menit
        </div>
      </div>
    </div>

    <!-- Primary Action Button -->
    <div class="space-y-2 pt-1">
      <button
        type="button"
        onclick={handleStartSetup}
        class="w-full py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF634A]/25 cursor-pointer border-0"
      >
        <span>Mulai Setup Lingkungan Operasional</span>
        <ArrowRight class="w-4 h-4" />
      </button>
    </div>

    <!-- Enterprise Notice Footer -->
    <div class="pt-1 text-center space-y-1">
      <div class="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-medium">
        <Shield class="w-3 h-3 text-zinc-600" />
        <span>Inisialisasi Sistem MOVA Super Admin</span>
      </div>
    </div>

  </div>
</div>
