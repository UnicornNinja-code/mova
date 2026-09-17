<script lang="ts">
  import { onMount } from 'svelte';
  import { Coffee, CheckCircle2, Sparkles } from 'lucide-svelte';

  interface Props {
    onCompleted: () => void;
  }

  let { onCompleted }: Props = $props();

  let progress = $state(15);
  let stepIndex = $state(0);
  let isReady = $state(false);

  const checklist = [
    { label: 'Konfigurasi Identitas & Central Hub', key: 'identity' },
    { label: 'Parameter Wilayah Operasional & Jam Kerja', key: 'ops' },
    { label: 'Lapisan Restriksi Spasial & Peta GIS', key: 'map' },
    { label: 'Model Keputusan DSS BWM-TOPSIS', key: 'dss' },
    { label: 'Menyiapkan Dasbor Operasional Lapangan', key: 'dashboard' },
  ];

  onMount(() => {
    const timer = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 12;

      if (progress >= 30 && stepIndex === 0) stepIndex = 1;
      if (progress >= 55 && stepIndex === 1) stepIndex = 2;
      if (progress >= 75 && stepIndex === 2) stepIndex = 3;
      if (progress >= 90 && stepIndex === 3) stepIndex = 4;

      if (progress >= 100) {
        progress = 100;
        stepIndex = 5;
        isReady = true;
        clearInterval(timer);

        setTimeout(() => {
          onCompleted();
        }, 1500);
      }
    }, 400);

    return () => clearInterval(timer);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#09090B] font-outfit-400 select-none">
  <!-- Ambient Glow -->
  <div class="absolute w-[600px] h-[600px] bg-[#FF634A]/10 rounded-full blur-[160px] pointer-events-none"></div>

  <div class="relative w-full max-w-md text-center space-y-6">
    <!-- Brand Animated Icon -->
    <div class="relative mx-auto w-20 h-20 flex items-center justify-center">
      {#if !isReady}
        <div class="w-18 h-18 rounded-3xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center text-[#09090B] shadow-2xl shadow-[#FF634A]/30 border border-white/20 animate-pulse">
          <Coffee class="w-9 h-9 stroke-[2.2]" />
        </div>
      {:else}
        <div class="w-18 h-18 rounded-3xl bg-emerald-500 flex items-center justify-center text-[#09090B] shadow-2xl shadow-emerald-500/30 border border-white/30 scale-105 transition-transform duration-500">
          <CheckCircle2 class="w-10 h-10 text-[#09090B] stroke-[2.5]" />
        </div>
      {/if}
    </div>

    <!-- Title & Subtitle -->
    <div class="space-y-2">
      {#if !isReady}
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF634A]/10 border border-[#FF634A]/25 text-[10px] font-mono uppercase tracking-widest text-[#FF8573] font-bold">
          <Sparkles class="w-3 h-3 text-[#FF634A]" />
          <span>Applying System Configuration</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
          Menyiapkan Lingkungan Operasional
        </h2>
        <p class="text-xs text-[#A1A1AA] max-w-sm mx-auto leading-relaxed">
          Mohon tunggu sejenak selagi COZIS mengonfigurasi basis data spasial dan kalibrasi sistem Anda.
        </p>
      {:else}
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
          <CheckCircle2 class="w-3 h-3 text-emerald-400" />
          <span>System Initialized & Ready</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
          Sistem Siap Beroperasi!
        </h2>
        <p class="text-xs text-[#A1A1AA] max-w-sm mx-auto leading-relaxed">
          Konfigurasi berhasil diterapkan. Mengalihkan Anda ke dasbor operasional...
        </p>
      {/if}
    </div>

    <!-- Progress Bar & Percentage -->
    <div class="space-y-2 p-4 rounded-2xl bg-[#131316] border border-[#24242A]">
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="text-[#71717A] uppercase text-[10px]">Status Progres</span>
        <span class="text-[#FF8573] font-bold">{progress}%</span>
      </div>
      <div class="w-full h-2 rounded-full bg-[#18181D] overflow-hidden border border-[#272730]">
        <div 
          class="h-full bg-gradient-to-r from-[#FF634A] to-emerald-400 rounded-full transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    </div>

    <!-- Checklist Progression Items -->
    <div class="p-4 rounded-2xl bg-[#131316]/70 border border-[#24242A] text-left space-y-2.5 text-xs font-outfit-400">
      {#each checklist as item, idx}
        <div class="flex items-center justify-between transition-colors duration-300
          {idx < stepIndex ? 'text-emerald-400' : idx === stepIndex ? 'text-white' : 'text-zinc-600'}"
        >
          <div class="flex items-center gap-2.5">
            {#if idx < stepIndex}
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {:else if idx === stepIndex}
              <div class="w-3.5 h-3.5 rounded-full border border-[#FF634A] flex items-center justify-center shrink-0">
                <div class="w-1.5 h-1.5 rounded-full bg-[#FF634A] animate-ping"></div>
              </div>
            {:else}
              <div class="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0"></div>
            {/if}
            <span class="text-[11px] {idx === stepIndex ? 'font-semibold text-zinc-100' : ''}">{item.label}</span>
          </div>

          {#if idx < stepIndex}
            <span class="text-[10px] font-mono text-emerald-400 font-semibold">SELESAI</span>
          {:else if idx === stepIndex}
            <span class="text-[10px] font-mono text-[#FF8573] animate-pulse">PROSES</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
