<script lang="ts">
  import type { ProductPerformanceItem } from '../../services/dashboardService';

  interface Props {
    products: ProductPerformanceItem[];
    loading?: boolean;
    onViewAll?: () => void;
  }

  let { products = [], loading = false, onViewAll }: Props = $props();

  const rankBadges = [
    { rank: 1, icon: '🥇', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50 shadow-xs' },
    { rank: 2, icon: '🥈', color: 'text-zinc-300 bg-zinc-800/40 border-zinc-700/50 shadow-xs' },
    { rank: 3, icon: '🥉', color: 'text-amber-600 bg-amber-950/30 border-amber-900/40 shadow-xs' },
    { rank: 4, icon: '#4', color: 'text-[#A1A1AA] bg-[#1A1A1F] border-[#2E2E38]' },
    { rank: 5, icon: '#5', color: 'text-[#A1A1AA] bg-[#1A1A1F] border-[#2E2E38]' },
    { rank: 6, icon: '#6', color: 'text-[#A1A1AA] bg-[#1A1A1F] border-[#2E2E38]' },
  ];

  let topProducts = $derived(products.slice(0, 6));
  let totalCupsAll = $derived(topProducts.reduce((sum, p) => sum + (p.total_units_sold || 0), 0));
</script>

<div class="card-dark p-4 sm:p-5 flex flex-col justify-between min-h-[390px] lg:min-h-[430px] font-outfit-400">
  <!-- Header -->
  <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center justify-center">
        <i class="bx bxs-trophy text-lg"></i>
      </div>
      <div>
        <h3 class="text-title-18 font-outfit-600 text-white leading-tight">Produk Terlaris</h3>
        <p class="text-[11px] text-[#A1A1AA] font-outfit-400">Leaderboard menu terfavorit</p>
      </div>
    </div>

    {#if onViewAll}
      <button
        onclick={onViewAll}
        class="text-xs font-outfit-600 text-[#FF634A] hover:underline cursor-pointer flex items-center gap-1"
      >
        <span>Katalog</span>
        <i class="bx bx-chevron-right text-base"></i>
      </button>
    {/if}
  </div>

  <!-- Product List Leaderboard (Expanded scrollable area) -->
  <div class="mt-3 space-y-2.5 flex-1 max-h-72 lg:max-h-80 overflow-y-auto pr-1">
    {#if loading}
      <div class="py-12 text-center text-xs text-[#71717A]">
        Memuat peringkat menu terlaris...
      </div>
    {:else if topProducts.length === 0}
      <div class="py-12 text-center text-xs text-[#71717A] flex flex-col items-center gap-1.5">
        <i class="bx bx-coffee text-3xl text-[#2C2C34]"></i>
        <span class="font-outfit-600 text-zinc-400">Belum ada transaksi</span>
        <p class="text-[10px] text-[#71717A]">Pilih periode lain untuk melihat menu terlaris.</p>
      </div>
    {:else}
      {#each topProducts as product, idx (product.product_id)}
        {@const badge = rankBadges[idx] || { rank: idx + 1, icon: `#${idx + 1}`, color: 'text-zinc-500 bg-[#1A1A1F] border-zinc-800' }}
        <div class="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-[#1A1A1F] border border-[#26262E] hover:bg-[#202027] hover:border-[#FF634A]/50 transition-all">
          <!-- Rank & Image -->
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-6 h-6 rounded-lg text-xs font-outfit-600 flex items-center justify-center border shrink-0 {badge.color}">
              {badge.icon}
            </span>

            <div class="w-9 h-9 rounded-xl overflow-hidden bg-[#131316] border border-[#2E2E38] shrink-0 flex items-center justify-center">
              {#if product.image_url}
                <img src={product.image_url} alt={product.product_name} class="w-full h-full object-cover" />
              {:else}
                <i class="bx bx-coffee text-zinc-500 text-base"></i>
              {/if}
            </div>

            <div class="min-w-0">
              <h5 class="text-xs font-outfit-600 text-white truncate">{product.product_name}</h5>
              <div class="text-[10px] text-[#A1A1AA] font-mono flex items-center gap-1.5">
                <span>{product.sku || 'COZ-PROD'}</span>
                <span class="text-zinc-600">•</span>
                <span class="text-emerald-400 font-bold">{product.total_units_sold} Cup</span>
              </div>
            </div>
          </div>

          <!-- Total Revenue -->
          <div class="text-right shrink-0">
            <div class="text-xs font-outfit-600 text-[#FF634A]">
              Rp {product.total_revenue.toLocaleString('id-ID')}
            </div>
            <div class="text-[10px] text-[#71717A]">
              {product.total_transactions} Trx
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Footer -->
  <div class="mt-3 pt-2.5 border-t border-[#24242A] flex items-center justify-between text-[10px] text-[#71717A] font-outfit-400">
    <span>Top {topProducts.length} Menu Unggulan</span>
    <span class="font-outfit-600 text-white">{totalCupsAll.toLocaleString('id-ID')} Cup Terjual</span>
  </div>
</div>
