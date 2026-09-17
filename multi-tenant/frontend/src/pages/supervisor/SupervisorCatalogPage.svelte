<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, Tag, Coffee, RefreshCw } from 'lucide-svelte';
  import { productService, type ProductItem } from '../../services/productService';
  import ProductCard from '../../components/catalog/ProductCard.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let products = $state<ProductItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedCategory = $state('ALL');

  const loadProducts = async () => {
    loading = true;
    try {
      const res = await productService.getProducts({
        status: 'ALL',
        category: selectedCategory,
        search: searchQuery,
        limit: 100,
      });
      products = res.products;
    } catch (err) {
      console.warn('Gagal memuat katalog:', err);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    loadProducts();
  });
</script>

<div class="space-y-5 pb-8">
  <!-- TOP TOOLBAR & BREADCRUMB -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#D2D2D4]">
    <div>
      <div class="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Operasional Lapangan</div>
      <h2 class="text-xl sm:text-2xl font-extrabold text-[#18181B] tracking-tight leading-tight">
        Referensi Katalog Produk (Read-Only)
      </h2>
    </div>

    <!-- Read-Only Badge -->
    <div class="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 shadow-xs">
      <span>👁️ Mode Referensi Supervisor</span>
    </div>
  </div>

  <!-- TOOLBAR FILTERS & SEARCH -->
  <div class="bg-white rounded-2xl border border-[#D2D2D4] p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
    <!-- Search Input -->
    <div class="relative w-full md:w-80">
      <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
      <input
        type="text"
        bind:value={searchQuery}
        oninput={() => loadProducts()}
        placeholder="Cari nama menu, SKU..."
        class="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-medium"
      />
    </div>

    <!-- Category Pills -->
    <div class="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
      {#each [
        { label: 'Semua', value: 'ALL' },
        { label: 'Kopi', value: 'KOPI' },
        { label: 'Non-Kopi', value: 'NON_KOPI' },
        { label: 'Makanan', value: 'MAKANAN' }
      ] as cat}
        <button
          onclick={() => { selectedCategory = cat.value; loadProducts(); }}
          class="px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border
          {selectedCategory === cat.value 
            ? 'bg-[#FF634A] border-[#FF634A] text-white shadow-xs' 
            : 'bg-[#F4F4F6] border-[#D2D2D4] text-[#52525B] hover:text-[#18181B] hover:bg-white'}"
        >
          {cat.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- PRODUCT GRID VIEWPORT -->
  {#if loading}
    <div class="py-16 text-center text-xs text-[#8E8E93] flex flex-col items-center justify-center gap-2">
      <RefreshCw class="w-6 h-6 text-[#FF634A] animate-spin" />
      <span>Memuat data katalog menu...</span>
    </div>
  {:else if products.length === 0}
    <div class="py-16 text-center text-xs text-[#8E8E93] bg-white rounded-2xl border border-[#D2D2D4] p-8 flex flex-col items-center justify-center gap-2">
      <Coffee class="w-10 h-10 text-zinc-300 stroke-1" />
      <span class="font-bold text-sm text-[#18181B]">Tidak ada menu ditemukan</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each products as product (product.id)}
        <ProductCard
          {product}
          readOnly={true}
        />
      {/each}
    </div>
  {/if}
</div>
