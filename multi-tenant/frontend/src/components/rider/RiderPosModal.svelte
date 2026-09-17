<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    X, 
    ShoppingBag, 
    Plus, 
    Minus, 
    CreditCard, 
    QrCode, 
    Banknote, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    RefreshCw,
    Sparkles,
    Trash2
  } from 'lucide-svelte';
  import { riderService, type RiderSaleItem } from '../../services/riderService';
  import { productService, type ProductItem } from '../../services/productService';

  interface Props {
    open: boolean;
    onClose: () => void;
    onSaleRecorded: (saleResult: any) => void;
  }

  let { open = false, onClose, onSaleRecorded }: Props = $props();

  let loading = $state(false);
  let products = $state<ProductItem[]>([]);
  let cart = $state<Record<string, { product: ProductItem; quantity: number }>>({});

  let paymentMethod = $state<'CASH' | 'QRIS'>('CASH');
  let cashReceived = $state<number | null>(null);

  // QRIS Simulated Timer (180s)
  let qrisTimeLeft = $state(180);
  let qrisTimerInterval: any = null;

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const loadProducts = async () => {
    loading = true;
    errorMsg = null;
    try {
      const res = await productService.getProducts({ limit: 20 });
      products = res.products || [];
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat katalog produk.';
    } finally {
      loading = false;
    }
  };

  const updateCartQty = (product: ProductItem, delta: number) => {
    const current = cart[product.id]?.quantity || 0;
    const newQty = current + delta;
    if (newQty <= 0) {
      const newCart = { ...cart };
      delete newCart[product.id];
      cart = newCart;
    } else {
      cart = {
        ...cart,
        [product.id]: { product, quantity: newQty },
      };
    }
  };

  const totalAmount = $derived(
    Object.values(cart).reduce((sum, item) => sum + (item.product.price || 15000) * item.quantity, 0)
  );

  const totalCups = $derived(
    Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)
  );

  const cashChange = $derived(
    cashReceived !== null ? Math.max(0, cashReceived - totalAmount) : 0
  );

  const startQrisTimer = () => {
    qrisTimeLeft = 180;
    if (qrisTimerInterval) clearInterval(qrisTimerInterval);
    qrisTimerInterval = setInterval(() => {
      qrisTimeLeft -= 1;
      if (qrisTimeLeft <= 0) {
        clearInterval(qrisTimerInterval);
      }
    }, 1000);
  };

  const handleCheckoutSale = async () => {
    const itemsList: RiderSaleItem[] = Object.values(cart).map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.product.price,
    }));

    if (itemsList.length === 0) {
      errorMsg = 'Pilih minimal satu produk untuk dicatat.';
      return;
    }

    if (paymentMethod === 'CASH' && cashReceived !== null && cashReceived < totalAmount) {
      errorMsg = 'Nominal uang tunai yang diterima kurang dari total belanja.';
      return;
    }

    submitting = true;
    errorMsg = null;
    successMsg = null;

    const idempotencyKey = `pos_${generateUuid()}`;

    try {
      // Loop or submit items
      let lastResult: any = null;
      for (const item of itemsList) {
        lastResult = await riderService.recordSale(
          item,
          paymentMethod,
          `${idempotencyKey}_${item.product_id}`
        );
      }

      successMsg = `Penjualan ${totalCups} cup berhasil dicatat (Total: Rp ${totalAmount.toLocaleString('id-ID')})!`;
      onSaleRecorded({ totalAmount, totalCups, paymentMethod });
      
      // Reset cart
      cart = {};
      cashReceived = null;
      setTimeout(() => {
        onClose();
        successMsg = null;
      }, 1500);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mencatat transaksi penjualan.';
    } finally {
      submitting = false;
    }
  };

  $effect(() => {
    if (open) {
      loadProducts();
    } else {
      if (qrisTimerInterval) clearInterval(qrisTimerInterval);
    }
  });

  $effect(() => {
    if (paymentMethod === 'QRIS' && open) {
      startQrisTimer();
    } else {
      if (qrisTimerInterval) clearInterval(qrisTimerInterval);
    }
  });

  onDestroy(() => {
    if (qrisTimerInterval) clearInterval(qrisTimerInterval);
  });
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full bg-black/50 cursor-default focus:outline-none"
      onclick={onClose}
      aria-label="Tutup modal POS"
    ></button>

    <div
      class="relative z-10 w-full sm:max-w-lg bg-[#131317] border-t sm:border border-[#262632] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-2.5 border-b border-[#24242E]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center text-white font-bold shadow-md shadow-[#FF634A]/20">
            <ShoppingBag class="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 class="text-sm font-outfit-600 font-bold text-white">Kasir POS Penjualan Kopi</h3>
            <p class="text-[11px] text-zinc-400">Input transaksi & bukti pembayaran</p>
          </div>
        </div>

        <button
          type="button"
          onclick={onClose}
          class="w-7 h-7 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      {#if errorMsg}
        <div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      {#if successMsg}
        <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      {/if}

      <!-- Menu List with Quantity Adjusters -->
      <div class="space-y-2">
        <span class="text-xs text-zinc-400 font-medium">Pilih Menu Produk:</span>
        <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {#each products as product}
            <div class="p-2.5 rounded-xl bg-[#181822] border border-[#272734] flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-white">{product.name}</h4>
                <span class="text-[11px] text-[#FF634A] font-mono font-bold">
                  Rp {(product.price || 15000).toLocaleString('id-ID')}
                </span>
              </div>

              <!-- Quantity Controls -->
              <div class="flex items-center gap-2 bg-[#121218] border border-[#2E2E3C] rounded-xl p-1">
                <button
                  type="button"
                  onclick={() => updateCartQty(product, -1)}
                  class="w-6 h-6 rounded-lg bg-[#1E1E28] text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                >
                  <Minus class="w-3 h-3" />
                </button>
                <span class="w-6 text-center text-xs font-mono font-bold text-white">
                  {cart[product.id]?.quantity || 0}
                </span>
                <button
                  type="button"
                  onclick={() => updateCartQty(product, 1)}
                  class="w-6 h-6 rounded-lg bg-[#FF634A] text-white flex items-center justify-center cursor-pointer transition-colors active:scale-95 shadow-sm shadow-[#FF634A]/30"
                >
                  <Plus class="w-3 h-3" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Payment Method Toggle -->
      <div class="space-y-1.5">
        <span class="text-xs text-zinc-400 font-medium">Metode Pembayaran:</span>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            onclick={() => (paymentMethod = 'CASH')}
            class={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              paymentMethod === 'CASH'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                : 'bg-[#181822] border-[#2A2A38] text-zinc-400 hover:text-white'
            }`}
          >
            <Banknote class="w-4 h-4" />
            <span>Tunai (CASH)</span>
          </button>

          <button
            type="button"
            onclick={() => (paymentMethod = 'QRIS')}
            class={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              paymentMethod === 'QRIS'
                ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                : 'bg-[#181822] border-[#2A2A38] text-zinc-400 hover:text-white'
            }`}
          >
            <QrCode class="w-4 h-4" />
            <span>QRIS Dinamis</span>
          </button>
        </div>
      </div>

      <!-- Payment Specific Details -->
      {#if paymentMethod === 'CASH' && totalAmount > 0}
        <div class="p-3 rounded-2xl bg-[#181822] border border-[#282836] space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-zinc-400">Total Tagihan:</span>
            <span class="font-mono font-bold text-white text-sm">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2">
            <label for="cash-received-input" class="text-zinc-400 text-[11px] shrink-0">Uang Diterima:</label>
            <input
              id="cash-received-input"
              type="number"
              bind:value={cashReceived}
              placeholder={totalAmount.toString()}
              class="w-32 p-1.5 rounded-lg bg-[#111116] border border-[#2E2E3C] text-right font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {#if cashReceived !== null && cashReceived >= totalAmount}
            <div class="flex items-center justify-between pt-1 border-t border-[#242430] text-emerald-400 font-bold">
              <span>Kembalian:</span>
              <span class="font-mono">Rp {cashChange.toLocaleString('id-ID')}</span>
            </div>
          {/if}
        </div>
      {:else if paymentMethod === 'QRIS' && totalAmount > 0}
        <div class="p-3.5 rounded-2xl bg-gradient-to-br from-sky-950/40 to-[#131317] border border-sky-500/30 flex flex-col items-center text-center space-y-2">
          <div class="flex items-center justify-between w-full text-xs">
            <span class="text-sky-300 font-bold flex items-center gap-1">
              <QrCode class="w-3.5 h-3.5" /> Scan QRIS Pelanggan
            </span>
            <span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
              ⏱️ {qrisTimeLeft}s
            </span>
          </div>

          <!-- Simulated Dynamic QR Code Box -->
          <div class="w-32 h-32 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg">
            <div class="w-full h-full border-4 border-black/80 rounded-xl flex flex-col items-center justify-center p-1 text-[10px] text-black font-bold font-mono text-center">
              <span>MANTA KOPI</span>
              <span class="text-[8px] text-zinc-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
              <span class="text-[7px] text-zinc-400 mt-1">NMID: ID10203040</span>
            </div>
          </div>

          <p class="text-[10px] text-zinc-400">
            Arahkan kamera smartphone pembeli ke kode QR di atas.
          </p>
        </div>
      {/if}

      <!-- Bottom Order Total & Action -->
      <div class="pt-2 border-t border-[#24242E] space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-zinc-400">Total Belanja ({totalCups} Cup):</span>
          <span class="text-base font-outfit-600 font-bold text-[#FF634A] font-mono">
            Rp {totalAmount.toLocaleString('id-ID')}
          </span>
        </div>

        <button
          type="button"
          onclick={handleCheckoutSale}
          disabled={submitting || totalCups === 0}
          class="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#FF4D30] hover:to-[#FF634A] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-[#FF634A]/25 cursor-pointer disabled:opacity-50 active:scale-95"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{submitting ? 'Menyimpan Transaksi...' : `Simpan Penjualan (Rp ${totalAmount.toLocaleString('id-ID')})`}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
