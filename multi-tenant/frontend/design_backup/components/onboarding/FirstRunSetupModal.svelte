<script lang="ts">
  import { 
    Coffee, 
    ArrowRight, 
    ShieldCheck, 
    Building2, 
    Compass, 
    Layers, 
    Sparkles, 
    CheckCircle2,
    Settings,
    Clock
  } from 'lucide-svelte';

  interface Props {
    onStartSetup: () => void;
  }

  let { onStartSetup }: Props = $props();
</script>

<!-- Dimmed Backdrop & Ambient Glow -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#09090B]/85 backdrop-blur-md font-outfit-400 select-none animate-fade-in">
  <!-- Subtle Ambient Orange Glow -->
  <div class="absolute w-[500px] h-[500px] bg-[#FF634A]/15 rounded-full blur-[140px] pointer-events-none"></div>

  <!-- Main System Initialization Gate Modal Card -->
  <div class="relative w-full max-w-lg bg-[#131316] rounded-3xl border border-[#272730] shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden">
    <!-- Top Decorative Line -->
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF634A] to-transparent"></div>

    <!-- Header Section -->
    <div class="text-center space-y-3">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center text-[#09090B] mx-auto shadow-xl shadow-[#FF634A]/25 border border-white/20">
        <Coffee class="w-8 h-8 stroke-[2.2]" />
      </div>

      <div class="space-y-1">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF634A]/10 border border-[#FF634A]/25 text-[10px] font-mono uppercase tracking-widest text-[#FF8573] font-bold">
          <Sparkles class="w-3 h-3 text-[#FF634A]" />
          <span>System Setup Required</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
          Inisialisasi Lingkungan Operasional
        </h2>
        <p class="text-xs text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
          Sistem MantaKopi COZIS dalam kondisi bersih (fresh baseline). Sebelum operasional armada dan rekomendasi rute dibuka, beberapa konfigurasi fondasi dasar wajib diselesaikan oleh Super Admin.
        </p>
      </div>
    </div>

    <!-- Setup Checklist & Progress Track -->
    <div class="p-4 sm:p-5 rounded-2xl bg-[#18181D] border border-[#24242A] space-y-3.5">
      <div class="flex items-center justify-between text-xs pb-2 border-b border-[#24242A]">
        <span class="font-outfit-600 text-zinc-300">Tahapan Inisialisasi</span>
        <span class="font-mono text-[11px] font-bold text-[#FF634A] px-2 py-0.5 rounded-lg bg-[#FF634A]/10 border border-[#FF634A]/20">
          1 dari 4 Selesai
        </span>
      </div>

      <!-- Steps Visual Flow -->
      <div class="space-y-2.5 text-xs">
        <div class="flex items-center justify-between text-emerald-400">
          <div class="flex items-center gap-2.5">
            <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
            <span class="font-medium text-zinc-200">Akun Root Super Admin</span>
          </div>
          <span class="text-[10px] font-mono uppercase font-bold text-emerald-400">Tersedia</span>
        </div>

        <div class="flex items-center justify-between text-zinc-400">
          <div class="flex items-center gap-2.5">
            <div class="w-4 h-4 rounded-full border border-[#FF634A] flex items-center justify-center shrink-0">
              <div class="w-1.5 h-1.5 rounded-full bg-[#FF634A] animate-pulse"></div>
            </div>
            <span class="text-zinc-300">Identitas Sistem & Central Hub</span>
          </div>
          <span class="text-[10px] font-mono text-[#FF8573]">Konfigurasi Awal</span>
        </div>

        <div class="flex items-center justify-between text-zinc-500">
          <div class="flex items-center gap-2.5">
            <div class="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center shrink-0">
              <span class="text-[9px] font-mono text-zinc-600">3</span>
            </div>
            <span>Parameter Operasional & Jam Kerja</span>
          </div>
          <span class="text-[10px] font-mono text-zinc-600">Menunggu</span>
        </div>

        <div class="flex items-center justify-between text-zinc-500">
          <div class="flex items-center gap-2.5">
            <div class="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center shrink-0">
              <span class="text-[9px] font-mono text-zinc-600">4</span>
            </div>
            <span>Kalibrasi Model Keputusan (BWM/TOPSIS)</span>
          </div>
          <span class="text-[10px] font-mono text-zinc-600">Menunggu</span>
        </div>
      </div>
    </div>

    <!-- Action Section -->
    <div class="space-y-2 pt-1">
      <button
        type="button"
        onclick={onStartSetup}
        class="w-full py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-outfit-600 text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#FF634A]/25 cursor-pointer"
      >
        <span>Mulai System Setup Terpandu</span>
        <ArrowRight class="w-4 h-4" />
      </button>

      <div class="flex items-center justify-center gap-1.5 text-[11px] text-[#71717A] pt-1">
        <Clock class="w-3.5 h-3.5" />
        <span>Hanya membutuhkan waktu sekitar 2–3 menit</span>
      </div>
    </div>
  </div>
</div>
