<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Plus, 
    Search, 
    LayoutGrid, 
    List, 
    Tag, 
    Coffee, 
    TrendingUp, 
    RefreshCw,
    Edit2,
    Trash2,
    CheckCircle2
  } from 'lucide-svelte';
  import { productService, type ProductItem } from '../../services/productService';
  import ProductCard from '../../components/catalog/ProductCard.svelte';
  import ProductModal from '../../components/catalog/ProductModal.svelte';
  import DeleteGuardModal from '../../components/catalog/DeleteGuardModal.svelte';
  import Badge from '../../components/ui/Badge.svelte';
  import { confirmModal } from '../../lib/stores/confirmModal.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let products = $state<ProductItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedCategory = $state('ALL');
  let selectedStatus = $state('ALL');
  let viewMode = $state<'GRID' | 'LIST'>('GRID');

  // Modals state
  let formModalOpen = $state(false);
  let selectedProductForEdit = $state<ProductItem | null>(null);
  let deleteModalOpen = $state(false);
  let selectedProductForDelete = $state<ProductItem | null>(null);

  const loadProducts = async () => {
    loading = true;
    try {
      const res = await productService.getProducts({
        status: selectedStatus,
        category: selectedCategory,
        search: searchQuery,
        limit: 100,
      });
      products = res.products;
    } catch (err) {
      console.warn('Gagal memuat produk:', err);
    } finally {
      loading = false;
    }
  };

  const handleOpenAdd = () => {
    selectedProductForEdit = null;
    formModalOpen = true;
  };

  const handleOpenEdit = (p: ProductItem) => {
    selectedProductForEdit = p;
    formModalOpen = true;
  };

  const handleOpenDelete = (p: ProductItem) => {
    selectedProductForDelete = p;
    deleteModalOpen = true;
  };

  const handleToggleStatus = async (p: ProductItem) => {
    const nextStatus = p.status === 'AVAILABLE' ? 'DISCONTINUED' : 'AVAILABLE';
    await confirmModal.verify({
      context: 'DELETE_PRODUCT',
      title: nextStatus === 'DISCONTINUED' ? 'Arsipkan Menu Produk' : 'Aktifkan Kembali Menu Produk',
      subtitle: nextStatus === 'DISCONTINUED'
        ? `Mengarsipkan menu "${p.name}". Produk ini tidak akan tampil di katalog penjualan rider.`
        : `Mengaktifkan kembali menu "${p.name}" agar dapat dijual oleh seluruh rider aktif.`,
      targetName: `${p.name} (Rp ${(p.price || 0).toLocaleString('id-ID')})`,
      severity: nextStatus === 'DISCONTINUED' ? 'warning' : 'info',
      confirmLabel: nextStatus === 'DISCONTINUED' ? 'Arsipkan Menu' : 'Aktifkan Menu',
      verificationLabel: nextStatus === 'DISCONTINUED'
        ? `Saya mengonfirmasi pengarsipan menu ${p.name}. Histori transaksi masa lalu tetap aman.`
        : `Saya mengonfirmasi pengaktifan kembali menu ${p.name}.`,
      onConfirm: async () => {
        await productService.updateStatus(p.id, nextStatus);
        await loadProducts();
      },
    });
  };

  // Aggregated Stats
  let totalKopi = $derived(products.filter((p) => (p.category || 'KOPI') === 'KOPI').length);
  let totalNonKopi = $derived(products.filter((p) => (p.category || '') === 'NON_KOPI').length);
  let avgMargin = $derived(
    products.length > 0
      ? (
          products.reduce((sum, p) => {
            if (p.price > 0 && p.base_price > 0) {
              return sum + ((p.price - p.base_price) / p.price) * 100;
            }
            return sum;
          }, 0) / products.length
        ).toFixed(1)
      : '0.0'
  );

  onMount(() => {
    loadProducts();
  });
</script>

<div class="space-y-5 pb-8 font-outfit-400 select-none">
  <!-- TOP TOOLBAR & BREADCRUMB -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24242A]">
    <div>
      <div class="text-[10px] font-outfit-600 text-[#71717A] uppercase tracking-wider">Master Data & Produk</div>
      <h2 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight leading-tight">
        Katalog Produk & Pricing
      </h2>
    </div>

    <!-- Top Action & Metric Summary -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-[#131316] border border-[#24242A] text-xs font-outfit-600 text-[#A1A1AA] shadow-sm">
        <span>Kopi: <strong class="text-white">{totalKopi}</strong></span>
        <span class="text-[#2D2D35]">•</span>
        <span>Non-Kopi: <strong class="text-white">{totalNonKopi}</strong></span>
        <span class="text-[#2D2D35]">•</span>
        <span class="text-emerald-400 flex items-center gap-1">
          <TrendingUp class="w-3.5 h-3.5 text-emerald-400" />
          Margin: +{avgMargin}%
        </span>
      </div>

      <button
        onclick={handleOpenAdd}
        class="px-4 py-2 rounded-2xl text-xs font-outfit-600 text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] transition-all flex items-center gap-1.5 shadow-lg shadow-[#FF634A]/20 cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        <span>+ Tambah Menu</span>
      </button>
    </div>
  </div>

  <!-- TOOLBAR FILTERS & SEARCH -->
  <div class="bg-[#131316] rounded-3xl border border-[#24242A] p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
    <!-- Search Input -->
    <div class="relative w-full md:w-80">
      <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
      <input
        type="text"
        bind:value={searchQuery}
        oninput={() => loadProducts()}
        placeholder="Cari nama menu, SKU..."
        class="w-full pl-9 pr-3 py-2 text-xs bg-[#18181D] border border-[#272730] rounded-xl focus:outline-none focus:border-[#FF634A] text-white placeholder-[#71717A] font-medium"
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
          class="px-3.5 py-1.5 text-xs font-outfit-600 rounded-xl transition-all cursor-pointer border
          {selectedCategory === cat.value 
            ? 'bg-[#FF634A] border-[#FF634A] text-white shadow-md shadow-[#FF634A]/20' 
            : 'bg-[#18181D] border-[#272730] text-[#A1A1AA] hover:text-white hover:border-[#383842]'}"
        >
          {cat.label}
        </button>
      {/each}
    </div>

    <!-- Status Filter & View Toggle -->
    <div class="flex items-center gap-2 w-full md:w-auto justify-end">
      <select
        bind:value={selectedStatus}
        onchange={() => loadProducts()}
        class="px-3 py-2 text-xs bg-[#18181D] border border-[#272730] rounded-xl font-outfit-600 text-zinc-200 focus:outline-none focus:border-[#FF634A] cursor-pointer"
      >
        <option value="ALL">Semua Status</option>
        <option value="AVAILABLE">Tersedia</option>
        <option value="DISCONTINUED">Nonaktif</option>
      </select>

      <!-- View Switcher -->
      <div class="inline-flex rounded-xl bg-[#18181D] p-1 border border-[#272730]">
        <button
          onclick={() => viewMode = 'GRID'}
          class="p-1.5 rounded-lg transition-all cursor-pointer {viewMode === 'GRID' ? 'bg-[#272730] text-[#FF634A] shadow-sm' : 'text-[#71717A] hover:text-white'}"
          title="Tampilan Grid"
        >
          <LayoutGrid class="w-4 h-4" />
        </button>
        <button
          onclick={() => viewMode = 'LIST'}
          class="p-1.5 rounded-lg transition-all cursor-pointer {viewMode === 'LIST' ? 'bg-[#272730] text-[#FF634A] shadow-sm' : 'text-[#71717A] hover:text-white'}"
          title="Tampilan Tabel"
        >
          <List class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  <!-- PRODUCT LIST VIEWPORT -->
  {#if loading}
    <div class="py-20 text-center text-xs text-[#A1A1AA] flex flex-col items-center justify-center gap-2.5">
      <RefreshCw class="w-7 h-7 text-[#FF634A] animate-spin" />
      <span>Memuat data katalog produk...</span>
    </div>
  {:else if products.length === 0}
    <div class="py-20 text-center text-xs text-[#A1A1AA] bg-[#131316] rounded-3xl border border-[#24242A] p-8 flex flex-col items-center justify-center gap-3">
      <div class="w-14 h-14 rounded-2xl bg-[#18181D] border border-[#272730] flex items-center justify-center text-zinc-500">
        <Coffee class="w-7 h-7 stroke-[1.5]" />
      </div>
      <span class="font-outfit-600 text-sm text-white">Tidak ada menu ditemukan</span>
      <p class="text-[#71717A] max-w-sm">Coba ubah kata kunci pencarian atau filter kategori untuk menemukan produk.</p>
    </div>
  {:else if viewMode === 'GRID'}
    <!-- Grid Layout (4 columns on Desktop) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each products as product (product.id)}
        <ProductCard
          {product}
          onEdit={handleOpenEdit}
          onToggleStatus={handleToggleStatus}
          onDelete={handleOpenDelete}
        />
      {/each}
    </div>
  {:else}
    <!-- Table List Layout -->
    <div class="bg-[#131316] rounded-3xl border border-[#24242A] shadow-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-[#A1A1AA]">
          <thead class="bg-[#18181D] text-[10px] font-outfit-600 text-[#71717A] uppercase tracking-wider border-b border-[#24242A]">
            <tr>
              <th class="py-3.5 px-4">Menu & Foto</th>
              <th class="py-3.5 px-4">SKU</th>
              <th class="py-3.5 px-4">Kategori</th>
              <th class="py-3.5 px-4 text-right">HPP (Modal)</th>
              <th class="py-3.5 px-4 text-right">Harga Jual</th>
              <th class="py-3.5 px-4 text-right">Margin Laba</th>
              <th class="py-3.5 px-4 text-center">Status</th>
              <th class="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#24242A] font-medium">
            {#each products as p (p.id)}
              {@const isAvail = p.status === 'AVAILABLE'}
              {@const margin = p.price > 0 && p.base_price > 0 ? (((p.price - p.base_price) / p.price) * 100).toFixed(1) : '0.0'}
              <tr class="hover:bg-[#18181D] transition-colors">
                <td class="py-3 px-4 flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-[#18181D] overflow-hidden border border-[#272730] shrink-0 flex items-center justify-center">
                    {#if p.image_url}
                      <img src={p.image_url} alt={p.name} class="w-full h-full object-cover" />
                    {:else}
                      <Coffee class="w-4 h-4 text-zinc-500" />
                    {/if}
                  </div>
                  <div>
                    <div class="font-outfit-600 text-white text-xs">{p.name}</div>
                    {#if p.description}
                      <div class="text-[10px] text-[#71717A] line-clamp-1 max-w-xs">{p.description}</div>
                    {/if}
                  </div>
                </td>
                <td class="py-3 px-4 font-mono font-bold text-[#71717A]">{p.sku || '-'}</td>
                <td class="py-3 px-4 font-outfit-600 text-zinc-300">{p.category || 'KOPI'}</td>
                <td class="py-3 px-4 text-right font-mono text-zinc-400">Rp {p.base_price ? p.base_price.toLocaleString('id-ID') : '-'}</td>
                <td class="py-3 px-4 text-right font-outfit-600 text-[#FF634A]">Rp {p.price.toLocaleString('id-ID')}</td>
                <td class="py-3 px-4 text-right font-mono font-bold text-emerald-400">+{margin}%</td>
                <td class="py-3 px-4 text-center">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 uppercase border
                    {isAvail ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border-rose-800/40'}"
                  >
                    {isAvail ? 'Tersedia' : 'Nonaktif'}
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      onclick={() => handleOpenEdit(p)}
                      class="p-2 rounded-xl bg-[#18181D] border border-[#272730] text-zinc-300 hover:text-[#FF634A] hover:border-[#FF634A]/40 transition-all cursor-pointer"
                      title="Edit Menu"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      onclick={() => handleOpenDelete(p)}
                      class="p-2 rounded-xl bg-[#18181D] border border-[#272730] text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-all cursor-pointer"
                      title="Hapus / Nonaktifkan"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Form Modal Add / Edit -->
<ProductModal
  isOpen={formModalOpen}
  productToEdit={selectedProductForEdit}
  onClose={() => formModalOpen = false}
  onSuccess={loadProducts}
/>

<!-- Delete Guard Modal -->
<DeleteGuardModal
  isOpen={deleteModalOpen}
  product={selectedProductForDelete}
  onClose={() => deleteModalOpen = false}
  onSuccess={loadProducts}
/>
