<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut, cubicIn } from 'svelte/easing';

  interface Props {
    /** Duration in ms for each regular letter (default: 500ms) */
    duration?: number;
    /** Duration in ms for the final letter (default: 700ms) */
    finalDuration?: number;
    /** Callback triggered exactly once after the complete animation finishes */
    onComplete?: () => void;
    /** Additional CSS classes for the container */
    className?: string;
    /** The word to animate sequentially (default: 'MOVA') */
    word?: string;
    /** Subtitle text shown during the transition */
    subtitle?: string;
  }

  let {
    duration = 500,
    finalDuration = 700,
    onComplete,
    className = '',
    word = 'MOVA',
    subtitle = 'Menyiapkan sesi onboarding...',
  }: Props = $props();

  const letters = $derived(word.toUpperCase().split(''));
  let currentIndex = $state(0);
  let isFinished = $state(false);
  let hasTriggeredComplete = false;
  let timerId: any = null;

  const runSequence = (idx: number) => {
    if (idx < letters.length) {
      currentIndex = idx;
      const isLast = idx === letters.length - 1;
      const stepTime = isLast ? finalDuration : duration;

      timerId = setTimeout(() => {
        runSequence(idx + 1);
      }, stepTime);
    } else {
      isFinished = true;
      // Brief settling buffer (200ms) before firing onComplete
      timerId = setTimeout(() => {
        if (!hasTriggeredComplete && onComplete) {
          hasTriggeredComplete = true;
          onComplete();
        }
      }, 200);
    }
  };

  // Start sequence on mount
  $effect(() => {
    runSequence(0);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  });

  onDestroy(() => {
    if (timerId) clearTimeout(timerId);
  });
</script>

<div
  class="fixed inset-0 z-50 bg-[#09090B] bg-background text-foreground flex flex-col items-center justify-center font-outfit-400 select-none overflow-hidden {className}"
  role="status"
  aria-live="polite"
  aria-label="Loading transition {word}"
>
  <!-- Ambient background glow matching MOVA brand identity -->
  <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[140px] pointer-events-none"></div>
  <div class="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

  <div class="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full">
    <!-- Clean status badge -->
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-8">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span class="text-xs font-outfit-600 text-emerald-300">Password Berhasil Diperbarui</span>
    </div>

    <!-- Centered Fixed-Position Letter Animation -->
    <!-- Each letter occupies the exact same visual position without jumping around -->
    <div class="relative w-36 h-32 flex items-center justify-center my-2">
      {#key currentIndex}
        <span
          in:fly={{ y: 12, duration: 240, easing: cubicOut }}
          out:fly={{ y: -12, duration: 200, easing: cubicIn }}
          class="absolute text-6xl sm:text-7xl font-outfit-700 font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-[#FF634A] to-[#FF8573] drop-shadow-[0_0_35px_rgba(255,99,74,0.55)] select-none"
        >
          {letters[currentIndex]}
        </span>
      {/key}
    </div>

    <!-- Minimal Progress Bar Line -->
    <div class="w-48 h-1 bg-[#24242A] border border-white/5 rounded-full overflow-hidden mt-6 relative">
      <div
        class="h-full bg-gradient-to-r from-[#FF634A] via-[#FF8573] to-[#FF634A] rounded-full transition-all duration-300 ease-out"
        style="width: {letters.length > 0 ? `${Math.min(100, Math.round(((currentIndex + 1) / letters.length) * 100))}%` : '0%'};"
      ></div>
    </div>

    <!-- Status text -->
    <p class="text-xs text-[#A1A1AA] text-muted-foreground mt-4 font-outfit-500 tracking-wide">
      {subtitle}
    </p>
  </div>
</div>
