<script lang="ts">
  import { AlertTriangle, RefreshCw } from 'lucide-svelte';
  import type { CaptchaData } from '../../services/authService';

  interface Props {
    captchaData: CaptchaData | null;
    captchaLoading: boolean;
    captchaTimeLeft: number;
    captchaAnswer: string;
    error?: string;
    onRefresh: () => void;
    onInput: (val: string) => void;
  }

  let {
    captchaData,
    captchaLoading,
    captchaTimeLeft,
    captchaAnswer,
    error,
    onRefresh,
    onInput,
  }: Props = $props();
</script>

<div class="space-y-3 pt-2 border-t border-[#272730]/70">
  <!-- Elevated Risk Notice -->
  <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-[11px]">
    <AlertTriangle class="w-3.5 h-3.5 shrink-0 text-amber-400" />
    <span>Verifikasi keamanan CAPTCHA diaktifkan untuk melindungi akun Anda.</span>
  </div>

  <div class="flex items-center justify-between">
    <label for="captcha-input" class="block text-xs font-outfit-600 text-[#D4D4D8]">
      Verifikasi CAPTCHA <span class="text-[#FF634A] font-bold">*</span>
    </label>

    <div class="flex items-center gap-2">
      <!-- Circular Countdown Timer Badge -->
      <div
        class="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#18181D] border transition-colors {captchaTimeLeft <= 10
          ? 'text-rose-400 border-rose-500/50 bg-rose-950/20 animate-pulse'
          : captchaTimeLeft <= 25
            ? 'text-amber-400 border-amber-500/40'
            : 'text-zinc-400 border-[#272730]'}"
        title="Sisa waktu berlaku kode CAPTCHA (otomatis berganti)"
      >
        <svg class="w-3.5 h-3.5 -rotate-90 transform shrink-0" viewBox="0 0 18 18">
          <circle
            cx="9"
            cy="9"
            r="7"
            stroke="currentColor"
            stroke-width="2"
            fill="transparent"
            class="text-zinc-800"
          />
          <circle
            cx="9"
            cy="9"
            r="7"
            stroke="currentColor"
            stroke-width="2"
            fill="transparent"
            stroke-dasharray="44"
            stroke-dashoffset={(44 * (60 - captchaTimeLeft)) / 60}
            stroke-linecap="round"
            class="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span>{captchaTimeLeft}s</span>
      </div>

      <!-- Manual Refresh Button -->
      <button
        type="button"
        onclick={onRefresh}
        disabled={captchaLoading}
        class="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-[#272730] transition-colors disabled:opacity-50 cursor-pointer"
        title="Muat ulang kode CAPTCHA"
      >
        <RefreshCw class="w-3.5 h-3.5 {captchaLoading ? 'animate-spin' : ''}" />
      </button>
    </div>
  </div>

  <!-- Captcha Canvas Display & Controls -->
  <div class="flex items-center gap-2.5">
    <!-- Distorted SVG Container with Bento dark styling -->
    <div class="relative w-36 sm:w-40 h-10 bg-[#18181D] border border-[#2C2C36] rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner select-none">
      {#if captchaLoading}
        <div class="text-[10px] text-zinc-500 animate-pulse flex items-center gap-1.5">
          <RefreshCw class="w-3 h-3 animate-spin text-[#FF634A]" />
          <span>Memuat...</span>
        </div>
      {:else if captchaData?.svg}
        <img
          src={captchaData.svg}
          alt="Kode CAPTCHA"
          class="w-full h-full object-cover pointer-events-none filter contrast-125"
        />
      {:else}
        <span class="text-[10px] text-zinc-500 italic">Gagal memuat</span>
      {/if}
    </div>

    <!-- Answer Input Field -->
    <div class="flex-1">
      <input
        id="captcha-input"
        type="text"
        maxlength="6"
        placeholder="5 Karakter"
        autocomplete="off"
        spellcheck="false"
        value={captchaAnswer}
        oninput={(e) => onInput((e.target as HTMLInputElement).value)}
        class="w-full px-3 py-2 text-xs uppercase tracking-widest font-mono font-bold bg-[#1A1A1F] border {error
          ? 'border-rose-500'
          : 'border-[#2C2C36]'} rounded-xl focus:outline-none focus:border-[#FF634A] text-white placeholder:text-zinc-600 placeholder:tracking-normal placeholder:font-sans placeholder:font-normal transition-all text-center sm:text-left"
      />
    </div>
  </div>

  {#if error}
    <p class="text-xs text-rose-400 pl-1">{error}</p>
  {/if}
</div>
