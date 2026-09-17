<script lang="ts">
  import { onMount } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import { ArrowLeft, History, ShoppingBag, Calendar, MapPin, Banknote, QrCode } from 'lucide-svelte';
  import { riderService } from '../../services/riderService';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(false);
  let salesHistory = $state<any[]>([
    { id: '1', product_name: 'Kopi Susu Gula Aren', quantity: 2, total_price: 36000, payment_method: 'QRIS', created_at: '10:15' },
    { id: '2', product_name: 'Americano Dingin', quantity: 1, total_price: 15000, payment_method: 'CASH', created_at: '10:42' },
    { id: '3', product_name: 'Caramel Macchiato', quantity: 3, total_price: 54000, payment_method: 'QRIS', created_at: '11:20' },
    { id: '4', product_name: 'Espresso Single Shot', quantity: 1, total_price: 12000, payment_method: 'CASH', created_at: '11:55' },
  ]);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };
</script>

<MobileFrame showStatusBar={true} showDynamicIsland={true}>
  <!-- Top Bar -->
  <div class="flex items-center justify-between pb-3 mb-4 border-b border-[#24242E]">
    <button
      type="button"
      onclick={() => navigateTo('/rider')}
      class="w-8 h-8 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
      title="Kembali ke Dasbor"
    >
      <ArrowLeft class="w-4 h-4" />
    </button>

    <div class="text-center">
      <h2 class="text-xs font-outfit-600 font-bold text-white uppercase tracking-wider">Riwayat Operasional</h2>
      <p class="text-[11px] text-zinc-400">Log Transaksi & Penugasan</p>
    </div>

    <div class="w-8 h-8 rounded-full bg-[#1C1C24] text-zinc-400 border border-[#2B2B38] flex items-center justify-center">
      <History class="w-4 h-4" />
    </div>
  </div>

  <div class="space-y-4 font-outfit-400">
    <div class="space-y-2">
      <span class="text-xs text-zinc-400 font-medium block">Transaksi Shift Aktif:</span>
      <div class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {#each salesHistory as sale}
          <div class="p-3.5 rounded-3xl bg-[#15151E] border border-[#262634] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-[#FF634A]/15 text-[#FF634A] flex items-center justify-center">
                <ShoppingBag class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-bold text-white">{sale.product_name}</h4>
                <div class="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                  <span>{sale.quantity}x Cup</span>
                  <span>• Jam {sale.created_at}</span>
                  <span class="flex items-center gap-0.5 text-emerald-400">
                    {#if sale.payment_method === 'QRIS'}
                      <QrCode class="w-3 h-3" /> QRIS
                    {:else}
                      <Banknote class="w-3 h-3" /> TUNAI
                    {/if}
                  </span>
                </div>
              </div>
            </div>

            <span class="text-xs font-bold text-white font-mono">
              Rp {sale.total_price.toLocaleString('id-ID')}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</MobileFrame>
