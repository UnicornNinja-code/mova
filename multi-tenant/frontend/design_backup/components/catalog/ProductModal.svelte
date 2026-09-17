<script lang="ts">
  import { X, Save, TrendingUp, AlertCircle, Loader2 } from 'lucide-svelte';
  import { productService, type ProductItem } from '../../services/productService';
  import ImageUploader from './ImageUploader.svelte';
  import Modal from '../ui/Modal.svelte';

  interface Props {
    isOpen: boolean;
    productToEdit?: ProductItem | null;
    onClose: () => void;
    onSuccess: () => void;
  }

  let { isOpen, productToEdit = null, onClose, onSuccess }: Props = $props();

  let name = $state('');
  let sku = $state('');
  let category = $state('KOPI');
  let description = $state('');
  let basePrice = $state<number>(0);
  let price = $state<number>(0);
  let imageUrl = $state('');
  let status = $state('AVAILABLE');

  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  $effect(() => {
    if (isOpen) {
      if (productToEdit) {
        name = productToEdit.name || '';
        sku = productToEdit.sku || '';
        category = productToEdit.category || 'KOPI';
        description = productToEdit.description || '';
        basePrice = productToEdit.base_price || 0;
        price = productToEdit.price || 0;
        imageUrl = productToEdit.image_url || '';
        status = productToEdit.status || 'AVAILABLE';
      } else {
        name = '';
        sku = `COZ-COF-${Math.floor(100 + Math.random() * 900)}`;
        category = 'KOPI';
        description = '';
        basePrice = 10000;
        price = 18000;
        imageUrl = '';
        status = 'AVAILABLE';
      }
      errorMsg = null;
    }
  });

  const grossMargin = $derived(
    price > 0 && basePrice > 0
      ? {
          amount: price - basePrice,
          percentage: (((price - basePrice) / price) * 100).toFixed(1),
        }
      : { amount: 0, percentage: '0.0' }
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) {
      errorMsg = 'Nama produk wajib diisi.';
      return;
    }
    if (price <= 0) {
      errorMsg = 'Harga jual harus lebih besar dari Rp 0.';
      return;
    }

    loading = true;
    errorMsg = null;

    try {
      if (productToEdit) {
        await productService.updateProduct(productToEdit.id, {
          name: name.trim(),
          sku: sku.trim(),
          category,
          description: description.trim(),
          base_price: Number(basePrice),
          price: Number(price),
          image_url: imageUrl || undefined,
          status,
        });
      } else {
        await productService.createProduct({
          name: name.trim(),
          sku: sku.trim(),
          category,
          description: description.trim(),
          base_price: Number(basePrice),
          price: Number(price),
          image_url: imageUrl || undefined,
          status,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal menyimpan data produk.';
    } finally {
      loading = false;
    }
  };
</script>

<Modal {isOpen} {onClose} title={productToEdit ? 'Edit Menu Produk' : 'Tambah Menu Baru'}>
  <form onsubmit={handleSubmit} class="space-y-4">
    <!-- Image Uploader -->
    <ImageUploader
      {imageUrl}
      onImageUploaded={(url) => imageUrl = url}
      onImageRemoved={() => imageUrl = ''}
    />

    <!-- Nama Menu & SKU -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="sm:col-span-2 space-y-1">
        <label for="product-name" class="block text-xs font-bold text-[#18181B]">Nama Menu <span class="text-rose-500">*</span></label>
        <input
          id="product-name"
          type="text"
          bind:value={name}
          placeholder="cth: Kopi Susu Gula Aren COZIS"
          required
          class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-medium"
        />
      </div>

      <div class="space-y-1">
        <label for="product-sku" class="block text-xs font-bold text-[#18181B]">SKU Produk</label>
        <input
          id="product-sku"
          type="text"
          bind:value={sku}
          placeholder="COZ-COF-001"
          class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-mono font-bold uppercase"
        />
      </div>
    </div>

    <!-- Kategori & Status -->
    <div class="grid grid-cols-2 gap-3">
      <div class="space-y-1">
        <label for="product-category" class="block text-xs font-bold text-[#18181B]">Kategori Menu</label>
        <select
          id="product-category"
          bind:value={category}
          class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-medium cursor-pointer"
        >
          <option value="KOPI">Minuman Kopi</option>
          <option value="NON_KOPI">Non-Kopi (Matcha/Choco/Tea)</option>
          <option value="MAKANAN">Makanan / Snack</option>
        </select>
      </div>

      <div class="space-y-1">
        <label for="product-status" class="block text-xs font-bold text-[#18181B]">Status Menu</label>
        <select
          id="product-status"
          bind:value={status}
          class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-medium cursor-pointer"
        >
          <option value="AVAILABLE">TERSEDIA (Dapat Dijual)</option>
          <option value="DISCONTINUED">NONAKTIF / HABIS</option>
        </select>
      </div>
    </div>

    <!-- HPP (Base Price) & Harga Jual (Selling Price) -->
    <div class="grid grid-cols-2 gap-3">
      <div class="space-y-1">
        <label for="product-base-price" class="block text-xs font-bold text-[#18181B]">HPP / Modal (Rp)</label>
        <input
          id="product-base-price"
          type="number"
          bind:value={basePrice}
          min="0"
          step="500"
          placeholder="10000"
          class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-bold"
        />
      </div>

      <div class="space-y-1">
        <label for="product-price" class="block text-xs font-bold text-[#18181B]">Harga Jual (Rp) <span class="text-rose-500">*</span></label>
        <input
          id="product-price"
          type="number"
          bind:value={price}
          min="1000"
          step="500"
          placeholder="18000"
          required
          class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#FF634A] font-extrabold"
        />
      </div>
    </div>

    <!-- Instant Gross Margin Calculator Callout -->
    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5 text-emerald-800 font-bold">
        <TrendingUp class="w-4 h-4 text-emerald-600" />
        <span>Gross Margin Profit:</span>
      </div>
      <div class="text-right">
        <span class="font-extrabold text-emerald-700">Rp {grossMargin.amount.toLocaleString('id-ID')}</span>
        <span class="text-[11px] font-bold text-emerald-600"> (+{grossMargin.percentage}%)</span>
      </div>
    </div>

    <!-- Deskripsi Singkat -->
    <div class="space-y-1">
      <label for="product-desc" class="block text-xs font-bold text-[#18181B]">Deskripsi Singkat</label>
      <textarea
        id="product-desc"
        bind:value={description}
        rows="2"
        placeholder="cth: Espresso arabika robusta blend dengan susu segar dan sirup gula aren murni."
        class="w-full px-3 py-2 text-xs bg-[#F4F4F6] border border-[#D2D2D4] rounded-xl focus:outline-none focus:border-[#FF634A] text-[#18181B] font-medium"
      ></textarea>
    </div>

    {#if errorMsg}
      <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
        <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
        <span>{errorMsg}</span>
      </div>
    {/if}

    <!-- Dialog Actions -->
    <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
      <button
        type="button"
        onclick={onClose}
        class="px-4 py-2 rounded-xl text-xs font-bold text-[#52525B] hover:bg-zinc-100 transition-all cursor-pointer"
      >
        Batal
      </button>

      <button
        type="submit"
        disabled={loading}
        class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF634A] hover:bg-[#E54E36] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
      >
        {#if loading}
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
          <span>Menyimpan...</span>
        {:else}
          <Save class="w-3.5 h-3.5" />
          <span>{productToEdit ? 'Simpan Perubahan' : 'Tambah Menu'}</span>
        {/if}
      </button>
    </div>
  </form>
</Modal>
