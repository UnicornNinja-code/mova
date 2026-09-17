<script lang="ts">
  import { AlertTriangle, Trash2, Archive, Loader2 } from 'lucide-svelte';
  import { productService, type ProductItem } from '../../services/productService';
  import Modal from '../ui/Modal.svelte';

  interface Props {
    isOpen: boolean;
    product: ProductItem | null;
    onClose: () => void;
    onSuccess: () => void;
  }

  let { isOpen, product, onClose, onSuccess }: Props = $props();

  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  const handleArchive = async () => {
    if (!product) return;
    loading = true;
    errorMsg = null;
    try {
      await productService.updateStatus(product.id, 'DISCONTINUED');
      onSuccess();
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal mengarsipkan produk.';
    } finally {
      loading = false;
    }
  };

  const handlePermanentDelete = async () => {
    if (!product) return;
    loading = true;
    errorMsg = null;
    try {
      await productService.deleteProduct(product.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      // If server returns error due to sales logs guard
      errorMsg = err?.response?.data?.msg || 'Produk memiliki transaksi penjualan dan tidak dapat dihapus permanen.';
    } finally {
      loading = false;
    }
  };
</script>

<Modal {isOpen} {onClose} title="Hapus / Nonaktifkan Produk">
  <div class="space-y-4">
    {#if product}
      <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertTriangle class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1">
          <p class="font-extrabold text-sm">
            Apakah Anda yakin ingin memproses "{product.name}"?
          </p>
          <p class="leading-relaxed text-[#52525B]">
            Untuk menjaga integritas laporan keuangan & histori transaksi penjualan, menu yang telah terjual tidak dapat dihapus permanen. Gunakan fitur <strong>Arsipkan</strong> untuk menonaktifkan penjualan.
          </p>
        </div>
      </div>

      {#if errorMsg}
        <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {errorMsg}
        </div>
      {/if}

      <!-- Actions -->
      <div class="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-2">
        <button
          type="button"
          onclick={onClose}
          class="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-[#52525B] hover:bg-zinc-100 transition-all cursor-pointer text-center"
        >
          Batal
        </button>

        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={loading}
            onclick={handlePermanentDelete}
            class="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Hapus Permanen (Hanya jika belum ada riwayat transaksi)"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Hapus Permanen</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onclick={handleArchive}
            class="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF634A] hover:bg-[#E54E36] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {#if loading}
              <Loader2 class="w-3.5 h-3.5 animate-spin" />
              <span>Memproses...</span>
            {:else}
              <Archive class="w-3.5 h-3.5" />
              <span>Arsipkan (Discontinued)</span>
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</Modal>
