<script lang="ts">
  import { Coffee, Edit2, Trash2, CheckCircle2, XCircle, Tag, TrendingUp } from 'lucide-svelte';
  import type { ProductItem } from '../../services/productService';
  import Badge from '../ui/Badge.svelte';

  interface Props {
    product: ProductItem;
    readOnly?: boolean;
    onEdit?: (product: ProductItem) => void;
    onToggleStatus?: (product: ProductItem) => void;
    onDelete?: (product: ProductItem) => void;
  }

  let { product, readOnly = false, onEdit, onToggleStatus, onDelete }: Props = $props();

  const margin = $derived(
    product.price > 0 && product.base_price > 0
      ? (((product.price - product.base_price) / product.price) * 100).toFixed(1)
      : '0.0'
  );

  const isAvailable = $derived(product.status === 'AVAILABLE');
</script>

<div class="bg-[#131316] rounded-2xl sm:rounded-3xl border border-[#24242A] hover:border-[#383842] p-3.5 sm:p-4 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group overflow-hidden relative">
  <div>
    <!-- Top Image Container -->
    <div class="relative w-full h-40 sm:h-44 rounded-xl sm:rounded-2xl overflow-hidden bg-[#18181D] border border-[#272730] flex items-center justify-center mb-3">
      {#if product.image_url}
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      {:else}
        <div class="flex flex-col items-center justify-center text-zinc-500 gap-1.5">
          <div class="w-12 h-12 rounded-2xl bg-[#24242A] flex items-center justify-center text-zinc-400">
            <Coffee class="w-6 h-6 stroke-[1.5]" />
          </div>
          <span class="text-[10px] font-outfit-600 text-zinc-400">Tanpa Foto Menu</span>
        </div>
      {/if}

      <!-- Floating Status Badge (Top Right) -->
      <div class="absolute top-2.5 right-2.5">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 tracking-wider uppercase border
          {isAvailable 
            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/50 shadow-sm' 
            : 'bg-rose-950/80 text-rose-400 border-rose-700/50 shadow-sm'}"
        >
          {isAvailable ? 'Tersedia' : 'Nonaktif'}
        </span>
      </div>

      <!-- Category Tag (Bottom Left) -->
      <div class="absolute bottom-2.5 left-2.5 bg-[#131316]/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-[#272730] text-[10px] font-outfit-600 text-zinc-200 flex items-center gap-1.5 shadow-md">
        <Tag class="w-3 h-3 text-[#FF634A]" />
        <span>{product.category || 'KOPI'}</span>
      </div>
    </div>

    <!-- Product Title & SKU -->
    <div class="space-y-1">
      <div class="text-[10px] font-mono font-bold text-[#71717A] uppercase tracking-wider">
        {product.sku || 'COZ-PROD-000'}
      </div>
      <h4 class="text-sm sm:text-base font-outfit-600 text-white tracking-tight leading-snug line-clamp-1 group-hover:text-[#FF8573] transition-colors" title={product.name}>
        {product.name}
      </h4>
      {#if product.description}
        <p class="text-xs text-[#A1A1AA] line-clamp-1 leading-relaxed">{product.description}</p>
      {/if}
    </div>

    <!-- Pricing Breakdown & Gross Margin -->
    <div class="mt-3.5 pt-3 border-t border-[#24242A] space-y-1.5 text-xs">
      <div class="flex items-center justify-between text-xs">
        <span class="text-[#71717A]">HPP (Modal):</span>
        <span class="font-mono text-zinc-400">Rp {product.base_price ? product.base_price.toLocaleString('id-ID') : '-'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs text-[#A1A1AA]">Harga Jual:</span>
        <span class="font-outfit-600 text-[#FF634A] text-sm sm:text-base font-bold">Rp {product.price.toLocaleString('id-ID')}</span>
      </div>
      <div class="flex items-center justify-between pt-1.5 border-t border-dashed border-[#24242A]">
        <span class="text-[10px] text-[#A1A1AA] flex items-center gap-1">
          <TrendingUp class="w-3 h-3 text-emerald-400" />
          Gross Margin:
        </span>
        <span class="text-xs font-mono font-bold text-emerald-400">+{margin}%</span>
      </div>
    </div>
  </div>

  <!-- Footer Actions (Superadmin Only) -->
  {#if !readOnly}
    <div class="mt-4 pt-3 border-t border-[#24242A] flex items-center justify-between gap-2">
      <!-- Toggle Availability Switch -->
      <button
        onclick={() => onToggleStatus && onToggleStatus(product)}
        class="text-[11px] font-outfit-600 flex items-center gap-1 transition-all cursor-pointer px-2.5 py-1.5 rounded-xl border
        {isAvailable 
          ? 'bg-[#1A1A1F] border-[#272730] text-[#A1A1AA] hover:text-white hover:border-[#383842]' 
          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50'}"
        title="Ubah Ketersediaan Menu"
      >
        <span>{isAvailable ? 'Nonaktifkan' : 'Aktifkan'}</span>
      </button>

      <!-- Edit & Delete Buttons -->
      <div class="flex items-center gap-1.5">
        <button
          onclick={() => onEdit && onEdit(product)}
          class="p-2 rounded-xl bg-[#1A1A1F] border border-[#272730] text-zinc-300 hover:text-[#FF634A] hover:border-[#FF634A]/40 transition-all cursor-pointer"
          title="Edit Menu"
        >
          <Edit2 class="w-3.5 h-3.5" />
        </button>

        <button
          onclick={() => onDelete && onDelete(product)}
          class="p-2 rounded-xl bg-[#1A1A1F] border border-[#272730] text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-all cursor-pointer"
          title="Hapus Menu"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  {/if}
</div>
