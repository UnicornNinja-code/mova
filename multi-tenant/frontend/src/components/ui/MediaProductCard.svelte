<script lang="ts">
  import { Star, Plus, Coffee, Check } from 'lucide-svelte';

  interface Props {
    id?: string;
    title: string;
    category?: string;
    price?: number;
    rating?: number;
    salesCount?: number;
    imageUrl?: string;
    gradientPreset?: string;
    isOrdered?: boolean;
    onOrder?: () => void;
    class?: string;
  }

  let {
    id = '',
    title,
    category = 'Kopi',
    price = 15000,
    rating = 4.9,
    salesCount = 120,
    imageUrl = '',
    gradientPreset = 'from-amber-400/80 via-rose-400/80 to-purple-500/80',
    isOrdered = false,
    onOrder = () => {},
    class: customClass = '',
  }: Props = $props();

  const formattedPrice = $derived(
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
  );
</script>

<!-- 2-Column Responsive Card Container -->
<div
  class="relative bg-[#18181D] border border-[#272730] rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-300 hover:border-[#FF634A]/40 hover:shadow-lg hover:shadow-[#FF634A]/10 group select-none {customClass}"
>
  <!-- Top Thumbnail Area (Matching the gradient visual artwork in the design) -->
  <div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/5">
    {#if imageUrl}
      <img
        src={imageUrl}
        alt={title}
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    {:else}
      <!-- Expressive Abstract Ambient Art Texture (like design attachment) -->
      <div class="w-full h-full bg-gradient-to-tr {gradientPreset} opacity-90 transition-transform duration-500 group-hover:scale-105 flex items-center justify-center">
        <div class="w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/80">
          <Coffee class="w-5 h-5 stroke-[2]" />
        </div>
      </div>
    {/if}

    <!-- Top Left Category Pill Tag -->
    <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[9px] font-outfit-600 font-medium">
      {category}
    </span>
  </div>

  <!-- Bottom Content & Information Row -->
  <div class="pt-2 flex flex-col gap-1">
    <!-- Item Title -->
    <h3 class="text-xs font-outfit-600 font-bold text-white tracking-tight line-clamp-1 group-hover:text-[#FF634A] transition-colors">
      {title}
    </h3>

    <!-- Price Tag -->
    <span class="text-[11px] font-bold text-[#FF634A] font-mono">
      {formattedPrice}
    </span>

    <!-- Metric Row (Star Rating & Quick Order Action Button) -->
    <div class="flex items-center justify-between pt-1 border-t border-[#22222A] mt-0.5">
      <!-- Star Rating & Volume -->
      <div class="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
        <Star class="w-3 h-3 fill-amber-400 text-amber-400" />
        <span class="font-bold text-zinc-200">{rating.toFixed(1)}</span>
        <span class="text-zinc-500 font-normal">({salesCount})</span>
      </div>

      <!-- Quick Add / Sell Button -->
      <button
        type="button"
        onclick={(e) => { e.stopPropagation(); onOrder(); }}
        class="w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer
        {isOrdered 
          ? 'bg-emerald-500 text-white' 
          : 'bg-[#FF634A]/15 text-[#FF634A] hover:bg-[#FF634A] hover:text-white active:scale-90 border border-[#FF634A]/30'}"
        title="Jual Produk"
        aria-label="Catat Penjualan"
      >
        {#if isOrdered}
          <Check class="w-3.5 h-3.5 stroke-[3]" />
        {:else}
          <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
        {/if}
      </button>
    </div>
  </div>
</div>
