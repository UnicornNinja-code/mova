<script lang="ts">
  import { X, ShoppingBag, MapPin, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-svelte';
  import Button from '../ui/Button.svelte';

  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
    onRecordSale?: () => void;
    onGpsCheckIn?: () => void;
    onReportIssue?: () => void;
    onCheckout?: () => void;
  }

  let {
    isOpen = false,
    onClose = () => {},
    onRecordSale = () => {},
    onGpsCheckIn = () => {},
    onReportIssue = () => {},
    onCheckout = () => {},
  }: Props = $props();
</script>

{#if isOpen}
  <!-- Dialog Scrim Container within Phone Screen -->
  <div class="absolute inset-0 z-50 flex items-end justify-center p-0 select-none animate-in fade-in duration-200">
    <!-- Clickable backdrop scrim -->
    <button
      type="button"
      class="absolute inset-0 w-full h-full bg-black/75 backdrop-blur-md cursor-default focus:outline-none"
      onclick={onClose}
      aria-label="Tutup menu aksi cepat"
    ></button>

    <!-- Drawer / Bottom Sheet Container -->
    <div
      class="relative z-10 w-full bg-[#131317] border-t border-[#272732] rounded-t-[32px] p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
      role="dialog"
      aria-modal="true"
    >
      <!-- Sheet Header & Drag Handle -->
      <div class="flex flex-col items-center">
        <div class="w-10 h-1 bg-zinc-700 rounded-full mb-3 sm:hidden"></div>
        <div class="w-full flex items-center justify-between">
          <div class="space-y-0.5">
            <h3 class="text-base font-outfit-600 font-bold text-white tracking-tight">
              Aksi Cepat Operasional
            </h3>
            <p class="text-xs text-zinc-400">Pilih tindakan cepat tugas lapangan</p>
          </div>

          <button
            type="button"
            onclick={onClose}
            class="w-8 h-8 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Tutup"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Quick Action Tiles Grid -->
      <div class="grid grid-cols-2 gap-2.5 pt-1">
        <!-- 1. Record Sale Button -->
        <button
          type="button"
          onclick={() => { onClose(); onRecordSale(); }}
          class="p-3.5 rounded-2xl bg-gradient-to-br from-[#FF634A]/15 to-[#FF8573]/5 border border-[#FF634A]/30 hover:border-[#FF634A] text-left flex flex-col justify-between h-28 transition-all group cursor-pointer active:scale-95"
        >
          <div class="w-8 h-8 rounded-xl bg-[#FF634A] flex items-center justify-center text-white shadow-md shadow-[#FF634A]/30">
            <ShoppingBag class="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-white group-hover:text-[#FF634A] transition-colors">Catat Penjualan</h4>
            <p class="text-[10px] text-zinc-400">Input transaksi kopi</p>
          </div>
        </button>

        <!-- 2. GPS Check-in Button -->
        <button
          type="button"
          onclick={() => { onClose(); onGpsCheckIn(); }}
          class="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-700/5 border border-emerald-500/30 hover:border-emerald-500 text-left flex flex-col justify-between h-28 transition-all group cursor-pointer active:scale-95"
        >
          <div class="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
            <MapPin class="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Check-in Zona</h4>
            <p class="text-[10px] text-zinc-400">Verifikasi koordinat GPS</p>
          </div>
        </button>

        <!-- 3. Report Armada Issue -->
        <button
          type="button"
          onclick={() => { onClose(); onReportIssue(); }}
          class="p-3.5 rounded-2xl bg-[#1A1A22] border border-[#2A2A38] hover:border-amber-500/50 text-left flex flex-col justify-between h-28 transition-all group cursor-pointer active:scale-95"
        >
          <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <AlertTriangle class="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">Lapor Kendala</h4>
            <p class="text-[10px] text-zinc-400">Kendala fisik armada</p>
          </div>
        </button>

        <!-- 4. Checkout Shift -->
        <button
          type="button"
          onclick={() => { onClose(); onCheckout(); }}
          class="p-3.5 rounded-2xl bg-[#1A1A22] border border-[#2A2A38] hover:border-purple-500/50 text-left flex flex-col justify-between h-28 transition-all group cursor-pointer active:scale-95"
        >
          <div class="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <CheckCircle class="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">Selesai Shift</h4>
            <p class="text-[10px] text-zinc-400">Checkout & setor armada</p>
          </div>
        </button>
      </div>

      <!-- Quick Cancel Close -->
      <Button variant="outline" size="sm" class="w-full py-2.5 text-xs text-zinc-400" onclick={onClose}>
        Tutup Menu
      </Button>
    </div>
  </div>
{/if}
