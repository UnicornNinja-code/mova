<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Heart, Sparkles, MapPin } from 'lucide-svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    badgeText?: string;
    badgeVariant?: 'primary' | 'success' | 'warning';
    actionIcon?: any;
    actionActive?: boolean;
    onAction?: () => void;
    class?: string;
    gradientType?: 'aurora' | 'sunset' | 'emerald' | 'dss';
    children?: Snippet;
  }

  let {
    title = 'Zona Aktif Sidoarjo',
    subtitle = 'Shift Siang • 11:00 - 15:00 WIB',
    badgeText = '',
    badgeVariant = 'primary',
    actionIcon: ActionIcon = Heart,
    actionActive = false,
    onAction = () => {},
    class: customClass = '',
    gradientType = 'aurora',
    children,
  }: Props = $props();

  const gradients = {
    aurora: 'from-[#4FACFE] via-[#00F2FE]/80 to-[#6B73FF]/90',
    sunset: 'from-[#FF634A] via-[#FF8573] to-[#7928CA]',
    emerald: 'from-[#10B981] via-[#059669] to-[#047857]',
    dss: 'from-[#6366F1] via-[#8B5CF6] to-[#EC4899]',
  };
</script>

<!-- Featured Hero Card with Rounded-3xl & Iridescent Backdrop -->
<div
  class="relative w-full rounded-[28px] overflow-hidden border border-white/15 shadow-xl shadow-black/40 transition-all duration-300 group {customClass}"
>
  <!-- Mesmerizing Abstract Mesh Gradient Texture (matching user image) -->
  <div class="relative w-full h-48 sm:h-52 overflow-hidden">
    <!-- Liquid Gradient Background -->
    <div
      class="absolute inset-0 bg-gradient-to-tr {gradients[gradientType]} transition-transform duration-700 group-hover:scale-105"
    ></div>

    <!-- Organic Grain / Noise Texture & Swirl Overlay -->
    <div
      class="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
      style="background-image: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.8), transparent 45%), radial-gradient(circle at 75% 70%, rgba(0,0,0,0.4), transparent 50%); filter: contrast(120%);"
    ></div>

    <!-- Top Action Floating Button (e.g. Heart / Favorite from design) -->
    <button
      type="button"
      onclick={(e) => { e.stopPropagation(); onAction(); }}
      class="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white transition-all duration-200 hover:bg-white/30 active:scale-90 shadow-md cursor-pointer"
      title="Aksi Cepat"
    >
      <ActionIcon class="w-4 h-4 {actionActive ? 'fill-rose-500 text-rose-500' : 'text-white'}" />
    </button>

    <!-- Top Left Badge Tag if present -->
    {#if badgeText}
      <div class="absolute top-3.5 left-3.5 z-20">
        <span
          class="px-2.5 py-1 rounded-full text-[10px] font-outfit-600 tracking-wide uppercase shadow-md backdrop-blur-md border
          {badgeVariant === 'success' 
            ? 'bg-emerald-500/80 text-white border-emerald-400/40' 
            : badgeVariant === 'warning' 
              ? 'bg-amber-500/80 text-white border-amber-400/40' 
              : 'bg-black/40 text-white border-white/20'}"
        >
          {badgeText}
        </span>
      </div>
    {/if}

    <!-- Bottom Vignette & Information Scrim -->
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col justify-end">
      <div class="space-y-0.5">
        <h2 class="text-lg font-outfit-600 font-bold text-white tracking-tight drop-shadow-md flex items-center gap-1.5">
          {title}
        </h2>
        <p class="text-xs text-zinc-200 drop-shadow flex items-center gap-1 font-medium">
          <MapPin class="w-3.5 h-3.5 text-[#FF634A] shrink-0" />
          <span>{subtitle}</span>
        </p>
      </div>
    </div>
  </div>

  <!-- Custom Extra Slots / Expansion Area (e.g. Metric Pills or Action Row) -->
  {#if children}
    <div class="bg-[#141419] border-t border-white/10 p-3.5">
      {@render children()}
    </div>
  {/if}
</div>
