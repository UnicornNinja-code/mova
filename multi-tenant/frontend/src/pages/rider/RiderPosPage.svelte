<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import { 
    ShoppingBag, 
    ArrowLeft, 
    Plus, 
    Minus, 
    QrCode, 
    Banknote, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    ArrowRight,
    Wifi,
    WifiOff
  } from 'lucide-svelte';
  import { riderService, type RiderSaleItem } from '../../services/riderService';
  import { productService, type ProductItem } from '../../services/productService';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(false);
  let products = $state<ProductItem[]>([]);
  let cart = $state<Record<string, { product: ProductItem; quantity: number }>>({});

  let paymentMethod = $state<'CASH' | 'QRIS'>('CASH');
  let cashReceived = $state<number | null>(null);

  // Anti-throttling Dynamic QRIS Countdown Timer
  let qrisExpiresAt = $state(0);
  let now = $state(Date.now());
  let qrisTimerInterval: any = null;

  let qrisTimeLeft = $derived(
    paymentMethod === 'QRIS' && qrisExpiresAt > 0
      ? Math.max(0, Math.floor((qrisExpiresAt - now) / 1000))
      : 0
  );

  let isOnline = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);
  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let totalCupsSession = $state(0);
  let totalRevenueSession = $state(0);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

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
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat katalog produk kopi.';
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
    qrisExpiresAt = Date.now() + 180 * 1000;
    now = Date.now();
    if (qrisTimerInterval) clearInterval(qrisTimerInterval);
    qrisTimerInterval = setInterval(() => {
      now = Date.now();
      if (qrisExpiresAt - now <= 0) {
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
      errorMsg = 'Pilih minimal satu menu kopi.';
      return;
    }

    if (paymentMethod === 'CASH' && cashReceived !== null && cashReceived < totalAmount) {
      errorMsg = 'Uang tunai yang diterima kurang dari total pesanan.';
      return;
    }

    submitting = true;
    errorMsg = null;
    successMsg = null;

    const idempotencyKey = `pos_${generateUuid()}`;

    try {
      for (const item of itemsList) {
        await riderService.recordSale(
          item,
          paymentMethod,
          `${idempotencyKey}_${item.product_id}`
        );
      }

      totalCupsSession += totalCups;
      totalRevenueSession += totalAmount;
      successMsg = `Penjualan ${totalCups} cup (Rp ${totalAmount.toLocaleString('id-ID')}) tercatat!`;
      
      cart = {};
      cashReceived = null;
      setTimeout(() => {
        successMsg = null;
      }, 2500);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan transaksi.';
    } finally {
      submitting = false;
    }
  };

  onMount(() => {
    loadProducts();

    const handleOnline = () => { isOnline = true; };
    const handleOffline = () => { isOnline = false; };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (qrisTimerInterval) clearInterval(qrisTimerInterval);
    };
  });

  $effect(() => {
    if (paymentMethod === 'QRIS') {
      startQrisTimer();
    }
  });

  onDestroy(() => {
    if (qrisTimerInterval) clearInterval(qrisTimerInterval);
  });
</script>

<MobileFrame showStatusBar={true} showDynamicIsland={true}>
  <!-- Top Bar -->
  <div class="flex items-center justify-between pb-3 mb-3 border-b border-[#24242E]">
    <button
      type="button"
      onclick={() => navigateTo('/rider')}
      class="w-8 h-8 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
      title="Kembali ke Dasbor"
    >
      <ArrowLeft class="w-4 h-4" />
    </button>

    <div class="text-center">
      <h2 class="text-xs font-outfit-600 font-bold text-white uppercase tracking-wider">Langkah 4 dari 5</h2>
      <p class="text-[11px] text-zinc-400">Kasir POS Lapangan</p>
    </div>

    <!-- Network Status Badge -->
    <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold {isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
      {#if isOnline}
        <Wifi class="w-3 h-3" /> <span>ONLINE</span>
      {:else}
        <WifiOff class="w-3 h-3" /> <span>OFFLINE</span>
      {/if}
    </div>
  </div>

  <div class="space-y-3 font-outfit-400">
    {#if errorMsg}
      <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
        <span>{errorMsg}</span>
      </div>
    {/if}

    {#if successMsg}
      <div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
        <span>{successMsg}</span>
      </div>
    {/if}

    <!-- Product Menu List -->
    <div class="p-3.5 rounded-3xl bg-[#15151E] border border-[#262634] space-y-2 shadow-xl">
      <div class="flex items-center justify-between text-xs text-zinc-400 font-medium pb-1 border-b border-[#242430]">
        <span>Pilih Menu Kopi:</span>
        <span class="text-white font-mono">{products.length} Menu Siap Saji</span>
      </div>

      <div class="space-y-2 max-h-52 overflow-y-auto pr-1">
        {#each products as product}
          <div class="p-2.5 rounded-2xl bg-[#101016] border border-[#242430] flex items-center justify-between">
            <div>
              <h4 class="text-xs font-bold text-white">{product.name}</h4>
              <span class="text-[11px] text-[#FF634A] font-mono font-bold">
                Rp {(product.price || 15000).toLocaleString('id-ID')}
              </span>
            </div>

            <!-- Quantity Controls -->
            <div class="flex items-center gap-2 bg-[#181822] border border-[#282836] rounded-xl p-1">
              <button
                type="button"
                onclick={() => updateCartQty(product, -1)}
                class="w-6 h-6 rounded-lg bg-[#22222E] text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
              >
                <Minus class="w-3 h-3" />
              </button>
              <span class="w-5 text-center text-xs font-mono font-bold text-white">
                {cart[product.id]?.quantity || 0}
              </span>
              <button
                type="button"
                onclick={() => updateCartQty(product, 1)}
                class="w-6 h-6 rounded-lg bg-[#FF634A] text-white flex items-center justify-center cursor-pointer active:scale-95 shadow-sm shadow-[#FF634A]/30"
              >
                <Plus class="w-3 h-3" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Payment Method Switcher -->
    <div class="p-3.5 rounded-3xl bg-[#15151E] border border-[#262634] space-y-2.5 shadow-xl">
      <span class="text-xs text-zinc-400 font-medium block">Metode Pembayaran:</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onclick={() => (paymentMethod = 'CASH')}
          class={`p-2.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
            paymentMethod === 'CASH'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
              : 'bg-[#101016] border-[#242430] text-zinc-400 hover:text-white'
          }`}
        >
          <Banknote class="w-4 h-4" />
          <span>Tunai (CASH)</span>
        </button>

        <button
          type="button"
          onclick={() => (paymentMethod = 'QRIS')}
          class={`p-2.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
            paymentMethod === 'QRIS'
              ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
              : 'bg-[#101016] border-[#242430] text-zinc-400 hover:text-white'
          }`}
        >
          <QrCode class="w-4 h-4" />
          <span>QRIS Dinamis</span>
        </button>
      </div>

      {#if paymentMethod === 'CASH' && totalAmount > 0}
        <div class="pt-2 border-t border-[#242430] space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <label for="cash-received" class="text-zinc-300 font-bold shrink-0">Uang Diterima:</label>
            <input
              id="cash-received"
              type="number"
              bind:value={cashReceived}
              placeholder={totalAmount.toString()}
              class="w-32 p-1.5 rounded-xl bg-black/40 border border-[#2E2E3C] text-right font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {#if cashReceived !== null && cashReceived >= totalAmount}
            <div class="flex items-center justify-between text-emerald-400 font-bold pt-1">
              <span>Uang Kembalian:</span>
              <span class="font-mono text-sm">Rp {cashChange.toLocaleString('id-ID')}</span>
            </div>
          {/if}
        </div>
      {:else if paymentMethod === 'QRIS' && totalAmount > 0}
        <div class="p-3 rounded-2xl bg-gradient-to-br from-sky-950/40 to-[#101016] border border-sky-500/30 flex flex-col items-center text-center space-y-2">
          <div class="flex items-center justify-between w-full text-xs">
            <span class="text-sky-300 font-bold flex items-center gap-1">
              <QrCode class="w-3.5 h-3.5" /> Scan QRIS Pelanggan
            </span>
            <span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
              ⏱️ {qrisTimeLeft}s
            </span>
          </div>

          <!-- Dynamic QR Code Card -->
          <div class="w-28 h-28 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg">
            <div class="w-full h-full border-4 border-black rounded-xl flex flex-col items-center justify-center p-1 text-[9px] text-black font-bold font-mono text-center">
              <span>MANTA KOPI</span>
              <span class="text-[8px] text-zinc-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
              <span class="text-[6px] text-zinc-400 mt-0.5">NMID: ID10203040</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Order Action Bar -->
    <div class="space-y-2 pt-1">
      <div class="flex items-center justify-between px-2 text-xs">
        <span class="text-zinc-400">Total Pesanan ({totalCups} Cup):</span>
        <span class="text-base font-bold text-[#FF634A] font-mono">
          Rp {totalAmount.toLocaleString('id-ID')}
        </span>
      </div>

      <button
        type="button"
        onclick={handleCheckoutSale}
        disabled={submitting || totalCups === 0}
        class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#FF4D30] hover:to-[#FF634A] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF634A]/25 cursor-pointer disabled:opacity-50 active:scale-95"
      >
        <CheckCircle2 class="w-4 h-4" />
        <span>{submitting ? 'Menyimpan...' : `Simpan Penjualan (Rp ${totalAmount.toLocaleString('id-ID')})`}</span>
      </button>

      <!-- Move to Shift Settlement Button -->
      <button
        type="button"
        onclick={() => navigateTo('/rider/settlement')}
        class="w-full py-2.5 text-center text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
      >
        <span>Selesaikan Shift Hari Ini & Settlement</span>
        <ArrowRight class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</MobileFrame>
