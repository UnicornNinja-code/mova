<script lang="ts">
  import Badge from '../ui/Badge.svelte';

  interface Props {
    title: string;
    value: string | number;
    subtitle?: string;
    trendBadge?: string;
    trendType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    pulseBadge?: boolean;
    icon?: any;
    iconClass?: string;
    iconColor?: string;
    loading?: boolean;
  }

  let {
    title,
    value,
    subtitle,
    trendBadge,
    trendType = 'success',
    pulseBadge = false,
    icon: IconComponent,
    iconClass,
    iconColor = 'text-[#FF634A] bg-[#FF634A]/10 border border-[#FF634A]/20',
    loading = false
  }: Props = $props();
</script>

<div class="card-dark p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-[#3E3E48]">
  {#if loading}
    <div class="animate-pulse space-y-3">
      <div class="h-3 w-20 bg-[#24242A] rounded"></div>
      <div class="h-8 w-28 bg-[#2C2C34] rounded"></div>
      <div class="h-3 w-16 bg-[#24242A] rounded"></div>
    </div>
  {:else}
    <!-- Top Row: Title & Boxicon -->
    <div class="flex items-center justify-between gap-2">
      <span class="text-[11px] font-outfit-600 uppercase tracking-wider text-[#71717A] truncate">{title}</span>
      {#if iconClass}
        <div class="w-8 h-8 rounded-xl flex items-center justify-center {iconColor} shrink-0">
          <i class="{iconClass} text-lg"></i>
        </div>
      {:else if IconComponent}
        <div class="w-8 h-8 rounded-xl flex items-center justify-center {iconColor} shrink-0">
          <IconComponent class="w-4 h-4" />
        </div>
      {/if}
    </div>

    <!-- Middle: Big Value (Outfit 600) -->
    <div class="my-2.5">
      <div class="text-xl sm:text-2xl lg:text-3xl font-outfit-600 text-white tracking-tight leading-none truncate">
        {value}
      </div>
    </div>

    <!-- Bottom: Subtitle & Trend Badge -->
    <div class="flex items-center justify-between gap-2 pt-2 border-t border-[#1F1F24] text-xs">
      {#if subtitle}
        <span class="text-[#A1A1AA] text-[11px] font-outfit-400 truncate">{subtitle}</span>
      {/if}
      {#if trendBadge}
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-outfit-600
          {trendType === 'success' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : ''}
          {trendType === 'warning' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' : ''}
          {trendType === 'danger' ? 'bg-rose-950/40 text-rose-400 border border-rose-800/40' : ''}
          {trendType === 'info' ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40' : ''}
          {trendType === 'neutral' ? 'bg-[#1F1F24] text-[#A1A1AA] border border-[#2C2C34]' : ''}"
        >
          {#if pulseBadge}
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {/if}
          {trendBadge}
        </span>
      {/if}
    </div>
  {/if}
</div>
