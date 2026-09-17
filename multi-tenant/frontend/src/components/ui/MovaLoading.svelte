<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fly } from "svelte/transition";

  interface Props {
    /** Total duration before firing onComplete in ms (default: 3600ms for full sequence) */
    duration?: number;
    finalDuration?: number;
    /** Callback triggered after duration completes */
    onComplete?: () => void;
    /** Additional CSS classes for container */
    className?: string;
    word?: string;
    /** Optional custom single subtitle override */
    subtitle?: string;
  }

  let {
    duration = 1800,
    finalDuration,
    onComplete,
    className = "",
    word,
    subtitle,
  }: Props = $props();

  const actualDuration = $derived(finalDuration || duration);

  const steps = [
    "Sedang Memasak..",
    "Menyiapkan Menu Utama..",
    "Mova Akan Siap Disajikan..",
  ];

  let currentStepIndex = $state(0);
  let stepIntervalId: any = null;
  let completeTimerId: any = null;

  onMount(() => {
    if (!subtitle) {
      const stepDuration = Math.max(
        900,
        Math.floor(actualDuration / steps.length),
      );
      stepIntervalId = setInterval(() => {
        if (currentStepIndex < steps.length - 1) {
          currentStepIndex += 1;
        }
      }, stepDuration);
    }

    completeTimerId = setTimeout(() => {
      if (onComplete) onComplete();
    }, actualDuration);
  });

  onDestroy(() => {
    if (stepIntervalId) clearInterval(stepIntervalId);
    if (completeTimerId) clearTimeout(completeTimerId);
  });
</script>

<div
  class="fixed inset-0 z-50 bg-[#09090B] flex flex-col items-center justify-center font-sans select-none overflow-hidden {className}"
  role="status"
  aria-live="polite"
>
  <!-- Ambient backdrop glow -->
  <div
    class="absolute w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[160px] pointer-events-none"
  ></div>
  <div
    class="absolute w-[300px] h-[300px] bg-white/5 rounded-full blur-[100px] pointer-events-none"
  ></div>

  <!-- Central Brand & Cooking Status -->
  <div
    class="relative z-10 flex flex-col items-center space-y-6 text-center px-4"
  >
    <!-- Bold White Logo matching Login Page -->
    <div
      class="relative inline-flex items-baseline select-none font-heading font-black tracking-[-0.035em]"
    >
      <span
        class="text-white leading-none font-black text-6xl sm:text-7xl md:text-8xl drop-shadow-2xl"
      >
        Mova<span class="text-[#FF634A] inline-block ml-1 animate-pulse">.</span
        >
      </span>
    </div>

    <!-- Subtitle / Cooking Message Sequence with Smooth Upward Slide -->
    <div
      class="relative h-10 flex items-center justify-center overflow-hidden w-full max-w-sm"
    >
      {#if subtitle}
        <p
          in:fly={{ y: 14, duration: 400 }}
          class="text-sm sm:text-base text-zinc-300 font-medium tracking-wide"
        >
          {subtitle}
        </p>
      {:else}
        {#key currentStepIndex}
          <p
            in:fly={{ y: 20, duration: 450, delay: 120 }}
            out:fly={{ y: -20, duration: 350 }}
            class="absolute text-sm sm:text-base text-white/95 font-medium tracking-wide"
          >
            {steps[currentStepIndex]}
          </p>
        {/key}
      {/if}
    </div>

    <!-- Minimalist Step Dots -->
    {#if !subtitle}
      <div class="flex items-center gap-2 pt-1">
        {#each steps as _, idx}
          <div
            class="h-1.5 rounded-full transition-all duration-500 {idx ===
            currentStepIndex
              ? 'w-6 bg-[#FF634A]'
              : idx < currentStepIndex
                ? 'w-1.5 bg-white/60'
                : 'w-1.5 bg-zinc-800'}"
          ></div>
        {/each}
      </div>
    {/if}
  </div>
</div>
