<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    isOpen?: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    isOpen = false,
    title,
    description,
    onClose,
    children,
    footer
  }: Props = $props();

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
    onclick={handleBackdropClick}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBackdropClick(e as any); }}
    role="button"
    tabindex="0"
  >
    <!-- Slide-over Container -->
    <div
      class="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#D2D2D4] flex flex-col justify-between animate-in slide-in-from-right duration-200 cursor-default"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Top Header -->
      <div class="px-6 py-5 border-b border-[#D2D2D4] flex items-center justify-between">
        <div>
          <h3 class="text-base font-extrabold text-[#18181B] leading-tight">{title}</h3>
          {#if description}
            <p class="text-xs text-[#52525B] mt-0.5">{description}</p>
          {/if}
        </div>
        <button
          onclick={onClose}
          class="w-8 h-8 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#18181B] hover:bg-[#F4F4F6] transition-colors cursor-pointer"
          title="Tutup"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content Body -->
      <div class="flex-1 p-6 overflow-y-auto text-xs sm:text-sm text-[#18181B] space-y-4">
        {#if children}
          {@render children()}
        {/if}
      </div>

      <!-- Footer Action -->
      {#if footer}
        <div class="px-6 py-4 bg-[#F4F4F6] border-t border-[#D2D2D4] flex items-center justify-end gap-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
