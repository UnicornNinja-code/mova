<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
    size?: 'sm' | 'md' | 'lg';
    pulse?: boolean;
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'neutral',
    size = 'md',
    pulse = false,
    children,
    class: customClass = ''
  }: Props = $props();

  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    primary: 'bg-[#FFF2EF] text-[#FF634A] border-[#FF634A]/30',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };
</script>

<span
  class="inline-flex items-center gap-1.5 font-bold rounded-full border transition-all {variantStyles[variant]} {sizeStyles[size]} {customClass}"
>
  {#if pulse}
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 {variant === 'success' ? 'bg-emerald-400' : variant === 'danger' ? 'bg-rose-400' : 'bg-[#FF634A]'}"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 {variant === 'success' ? 'bg-emerald-500' : variant === 'danger' ? 'bg-rose-500' : 'bg-[#FF634A]'}"></span>
    </span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</span>
