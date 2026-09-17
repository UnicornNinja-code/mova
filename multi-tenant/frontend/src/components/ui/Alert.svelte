<script lang="ts">
  import { 
    AlertCircle, 
    CheckCircle2, 
    AlertTriangle, 
    Info 
  } from 'lucide-svelte';

  interface Props {
    variant?: 'danger' | 'success' | 'warning' | 'info';
    title?: string;
    children?: any;
    class?: string;
  }

  let { 
    variant = 'info', 
    title = '', 
    children, 
    class: className = '' 
  }: Props = $props();

  const variantStyles = {
    danger: 'bg-rose-950/40 border-rose-800/40 text-rose-300 shadow-sm shadow-rose-950/30',
    success: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300 shadow-sm shadow-emerald-950/30',
    warning: 'bg-amber-950/40 border-amber-800/40 text-amber-300 shadow-sm shadow-amber-950/30',
    info: 'bg-blue-950/40 border-blue-800/40 text-blue-300 shadow-sm shadow-blue-950/30',
  };

  const iconStyles = {
    danger: 'text-rose-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
  };
</script>

<div class="p-3.5 rounded-2xl border text-xs flex items-start gap-3 backdrop-blur-md font-outfit-400 {variantStyles[variant]} {className}" role="alert">
  <div class="shrink-0 mt-0.5 {iconStyles[variant]}">
    {#if variant === 'danger'}
      <AlertCircle class="w-4 h-4" />
    {:else if variant === 'success'}
      <CheckCircle2 class="w-4 h-4" />
    {:else if variant === 'warning'}
      <AlertTriangle class="w-4 h-4" />
    {:else}
      <Info class="w-4 h-4" />
    {/if}
  </div>
  <div class="flex-1 space-y-0.5 leading-relaxed">
    {#if title}
      <h4 class="font-outfit-600 text-xs tracking-tight">{title}</h4>
    {/if}
    <div class="text-[11px] opacity-90 leading-normal">
      {@render children?.()}
    </div>
  </div>
</div>
