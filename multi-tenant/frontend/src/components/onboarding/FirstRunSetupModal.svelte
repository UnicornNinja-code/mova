<script lang="ts">
  import { 
    ArrowRight, 
    Building2, 
    Clock, 
    Bike, 
    Map, 
    BrainCircuit, 
    Database, 
    CheckCircle2,
    Shield
  } from 'lucide-svelte';

  interface Props {
    onStartSetup: () => void;
  }

  let { onStartSetup }: Props = $props();

  const setupSteps = [
    { num: 1, label: 'Identitas Hub', icon: Building2 },
    { num: 2, label: 'Kebijakan Ops', icon: Clock },
    { num: 3, label: 'Armada Awal', icon: Bike },
    { num: 4, label: 'Basemap GIS', icon: Map },
    { num: 5, label: 'Model DSS BWM', icon: BrainCircuit },
    { num: 6, label: 'Sinkronisasi Data', icon: Database },
    { num: 7, label: 'Aktivasi Sistem', icon: CheckCircle2 },
  ];
</script>

<!-- Backdrop Blur Modal -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md font-sans select-none animate-fade-in">
  <!-- Subtle Ambient Glow -->
  <div class="absolute w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[140px] pointer-events-none"></div>

  <!-- Clean Setup Modal Card -->
  <div class="relative w-full max-w-md bg-[#131316] rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5 overflow-hidden">
    
    <!-- Header Section -->
    <div class="text-center space-y-2">
      <h2 class="text-xl sm:text-2xl font-heading font-semibold text-white tracking-tight">
        Setup Lingkungan Operasional Pertama Kali
      </h2>
      
      <p class="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
        Lengkapi konfigurasi dasar untuk menyiapkan lingkungan kerja, batas wilayah operasional, dan mesin pendukung keputusan.
      </p>
    </div>

    <!-- Concise Step Pills Grid (Compact 2-Column Overview) -->
    <div class="p-3.5 rounded-2xl bg-[#18181D] border border-white/5 space-y-2.5">
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

    <!-- Action Button -->
    <div class="space-y-2 pt-1">
      <button
        type="button"
        onclick={onStartSetup}
        class="w-full py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF634A]/25 cursor-pointer border-0"
      >
        <span>Mulai Setup Lingkungan Operasional</span>
        <ArrowRight class="w-4 h-4" />
      </button>

      <div class="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 pt-1 font-medium">
        <Shield class="w-3 h-3 text-zinc-600" />
        <span>Inisialisasi Sistem MOVA Super Admin</span>
      </div>
    </div>
  </div>
</div>
