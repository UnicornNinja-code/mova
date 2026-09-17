<script lang="ts">
  /*
   * Toast.svelte
   * Premium Toast Container with Glassmorphism, Micro-Animations & Theme Awareness
   */
  import { toast, type ToastItem } from "../../lib/stores/toast.svelte";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
</script>

<div
  class="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
  aria-live="polite"
>
  {#each toast.toasts as item (item.id)}
    <div
      animate:flip={{ duration: 250 }}
      in:fly={{ y: -20, duration: 280 }}
      out:fade={{ duration: 200 }}
      class="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 relative overflow-hidden group
        {item.type === 'success'
          ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-100 shadow-emerald-950/40'
          : item.type === 'error'
          ? 'bg-rose-950/80 border-rose-500/30 text-rose-100 shadow-rose-950/40'
          : item.type === 'warning'
          ? 'bg-amber-950/80 border-amber-500/30 text-amber-100 shadow-amber-950/40'
          : 'bg-blue-950/80 border-blue-500/30 text-blue-100 shadow-blue-950/40'}"
      role="alert"
    >
      <!-- Accent Glow Background -->
      <div
        class="absolute -top-12 -right-12 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40
          {item.type === 'success'
            ? 'bg-emerald-500'
            : item.type === 'error'
            ? 'bg-rose-500'
            : item.type === 'warning'
            ? 'bg-amber-500'
            : 'bg-blue-500'}"
      ></div>

      <!-- Icon -->
      <div
        class="shrink-0 mt-0.5 p-1.5 rounded-xl border flex items-center justify-center
          {item.type === 'success'
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            : item.type === 'error'
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
            : item.type === 'warning'
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            : 'bg-blue-500/20 border-blue-500/40 text-blue-400'}"
      >
        {#if item.type === "success"}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        {:else if item.type === "error"}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else if item.type === "warning"}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        {:else}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        {/if}
      </div>

      <!-- Content -->
      <div class="flex-1 text-sm">
        {#if item.title}
          <div class="font-semibold tracking-wide text-xs uppercase opacity-80 mb-0.5">{item.title}</div>
        {/if}
        <div class="leading-relaxed font-medium">{item.message}</div>
      </div>

      <!-- Close Button -->
      <button
        onclick={() => toast.dismiss(item.id)}
        class="shrink-0 p-1 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Tutup notifikasi"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/each}
</div>
