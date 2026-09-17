<script lang="ts">
  import type { Snippet } from 'svelte';
  import { AlertOctagon, RotateCcw } from 'lucide-svelte';

  interface Props {
    componentName?: string;
    children?: Snippet;
    fallback?: Snippet<[{ error: Error; reset: () => void }]>;
  }

  let { componentName = 'Komponen', children, fallback }: Props = $props();

  let hasError = $state(false);
  let errorObj = $state<Error | null>(null);

  export const reset = () => {
    hasError = false;
    errorObj = null;
  };
</script>

{#if hasError}
  {#if fallback && errorObj}
    {@render fallback({ error: errorObj, reset })}
  {:else}
    <div class="p-6 rounded-xl border border-rose-500/30 bg-rose-500/5 text-center flex flex-col items-center justify-center space-y-3">
      <AlertOctagon class="w-8 h-8 text-rose-400" />
      <div>
        <h4 class="text-sm font-bold text-zinc-100">Gagal Memuat {componentName}</h4>
        <p class="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
          {errorObj?.message || 'Terjadi kesalahan internal pada modul visualisasi ini. Bagian sistem lainnya tetap beroperasi.'}
        </p>
      </div>
      <button
        type="button"
        onclick={reset}
        class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        Muat Ulang Komponen
      </button>
    </div>
  {/if}
{:else}
  {@render children?.()}
{/if}
