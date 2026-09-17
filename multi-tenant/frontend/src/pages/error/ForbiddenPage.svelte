<script lang="ts">
  import { ShieldAlert, Lock, ArrowLeft, LayoutDashboard, UserCheck, AlertTriangle } from 'lucide-svelte';
  import { authStore } from '../../lib/stores/auth.svelte';

  interface Props {
    onNavigate: (route: string) => void;
    attemptedRoute?: string;
    requiredRole?: string;
  }

  let { onNavigate, attemptedRoute = '', requiredRole = 'SUPERADMIN / MANAGEMENT' }: Props = $props();

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
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-[130px] pointer-events-none"></div>
  <div class="absolute -top-10 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-[110px] pointer-events-none"></div>

  <div class="relative z-10 max-w-lg w-full bg-[#131316]/90 backdrop-blur-xl border border-[#24242A] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
    <!-- Icon Container with Radiant Ring -->
    <div class="relative mx-auto w-24 h-24 flex items-center justify-center">
      <div class="absolute inset-0 bg-rose-500/20 rounded-full animate-ping opacity-30"></div>
      <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#1A1A20] to-[#2E181D] border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10 text-rose-400">
        <ShieldAlert class="w-10 h-10 animate-bounce" style="animation-duration: 2.5s;" />
      </div>
      <span class="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-rose-500 text-white font-outfit-600 font-extrabold text-[11px] shadow-md">
        403
      </span>
    </div>

    <!-- Title & Explanation -->
    <div class="space-y-2">
      <h1 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">
        Akses Dibatasi Kebijakan Otoritas (RBAC)
      </h1>
      <p class="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
        Peran akun Anda saat ini tidak memiliki hak akses yang cukup untuk membuka modul ini.
      </p>

      <!-- Role Comparison Card -->
      <div class="mt-4 p-3 rounded-2xl bg-[#18181D] border border-[#272730] text-left space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <span class="text-[#71717A] text-[11px]">Peran Anda Saat Ini:</span>
          <span class="px-2.5 py-0.5 rounded-full font-outfit-600 text-[10px] bg-rose-950/60 text-rose-400 border border-rose-800/50">
            {authStore.user?.role || 'GUEST'}
          </span>
        </div>
        <div class="flex items-center justify-between pt-1.5 border-t border-[#24242A]">
          <span class="text-[#71717A] text-[11px]">Hak Akses Dibutuhkan:</span>
          <span class="px-2.5 py-0.5 rounded-full font-mono text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/50">
            {requiredRole}
          </span>
        </div>
      </div>
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
        class="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#FF634A] hover:bg-[#FF4D30] text-white text-xs font-outfit-600 font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#FF634A]/20"
      >
        <LayoutDashboard class="w-4 h-4" />
        <span>Ke Beranda Saya</span>
      </button>
    </div>

    <p class="text-[11px] text-[#71717A]">
      Jika Anda memerlukan izin akses, silakan hubungi <strong class="text-zinc-300">Super Admin / Management</strong> perusahaan.
    </p>
  </div>
</div>
