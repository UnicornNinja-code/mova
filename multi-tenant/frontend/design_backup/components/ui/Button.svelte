<script lang="ts">
  import { Loader2 } from 'lucide-svelte';

  interface Props {
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'white';
    size?: 'sm' | 'md' | 'lg';
    isPending?: boolean;
    loading?: boolean;
    disabled?: boolean;
    leftIcon?: any;
    rightIcon?: any;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: any;
  }

  let {
    type = 'button',
    variant = 'primary',
    size = 'md',
    isPending = false,
    loading = false,
    disabled = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    class: className = '',
    onclick,
    children,
  }: Props = $props();

  const isSpinning = $derived(isPending || loading);

  const variantStyles = {
    primary: 'bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:brightness-110 active:brightness-95 text-[#09090B] font-outfit-600 shadow-lg shadow-[#FF634A]/25 border border-white/20',
    secondary: 'bg-[#1F1F24] hover:bg-[#272730] active:bg-[#1A1A1F] text-white border border-[#2E2E38] font-outfit-600',
    outline: 'bg-transparent hover:bg-[#1F1F24] active:bg-[#16161A] text-[#D4D4D8] hover:text-white border border-[#2E2E38] hover:border-[#3E3E4A]',
    danger: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-900/30 border border-rose-500/30',
    ghost: 'bg-transparent hover:bg-[#1F1F24] text-[#A1A1AA] hover:text-white',
    white: 'bg-white hover:bg-zinc-100 active:bg-zinc-200 text-[#09090B] font-outfit-600 shadow-lg shadow-black/20 border border-white/80',
  };

  const sizeStyles = {
    sm: 'px-3.5 py-2 text-xs rounded-xl gap-1.5',
    md: 'px-4.5 py-3 text-sm rounded-2xl gap-2',
    lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5',
  };
</script>

<button
  {type}
  disabled={disabled || isSpinning}
  {onclick}
  class="inline-flex items-center justify-center font-outfit-600 tracking-tight transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] {variantStyles[variant]} {sizeStyles[size]} {className}"
>
  {#if isSpinning}
    <Loader2 class="w-4 h-4 animate-spin shrink-0" />
  {:else if LeftIcon}
    <LeftIcon class="w-4 h-4 shrink-0" />
  {/if}

  <span>
    {@render children?.()}
  </span>

  {#if !isSpinning && RightIcon}
    <RightIcon class="w-4 h-4 shrink-0" />
  {/if}
</button>
