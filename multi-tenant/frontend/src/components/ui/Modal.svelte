<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    isOpen?: boolean;
    title: string;
    description?: string;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    onClose: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    isOpen = false,
    title,
    description,
    maxWidth = 'md',
    onClose,
    children,
    footer
  }: Props = $props();

  const maxWidthMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

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
  <!-- Backdrop Container with Accessibility -->
  <div
    class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
    onclick={handleBackdropClick}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBackdropClick(e as any); }}
    role="button"
    tabindex="0"
  >
    <!-- Modal Card -->
    <div
      class="bg-white rounded-2xl border border-[#D2D2D4] shadow-2xl w-full {maxWidthMap[maxWidth]} overflow-hidden animate-in zoom-in-95 duration-150 relative my-auto cursor-default"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
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

      <!-- Body Content -->
      <div class="p-6 text-xs sm:text-sm text-[#18181B]">
        {#if children}
          {@render children()}
        {/if}
      </div>

      <!-- Optional Footer -->
      {#if footer}
        <div class="px-6 py-4 bg-[#F4F4F6] border-t border-[#D2D2D4] flex items-center justify-end gap-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
