<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const LEGEND_CATEGORIES = [
    { label: 'Kuliner & Kafe', icon: 'ri-restaurant-2-fill', color: '#F97316' },
    { label: 'Perkantoran & Bisnis', icon: 'ri-building-4-fill', color: '#0EA5E9' },
    { label: 'Edukasi & Kampus', icon: 'ri-graduation-cap-fill', color: '#8B5CF6' },
    { label: 'Pasar & Perbelanjaan', icon: 'ri-store-2-fill', color: '#10B981' },
    { label: 'Titik Transit & Stasiun', icon: 'ri-subway-fill', color: '#6366F1' },
    { label: 'Fasilitas Kesehatan', icon: 'ri-hospital-fill', color: '#EC4899' },
    { label: 'Tempat Ibadah', icon: 'ri-community-fill', color: '#14B8A6' },
  ];
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between border-b border-[#24242A] pb-2">
    <div class="flex items-center gap-1.5 text-white font-extrabold text-xs">
      <i class="ri-information-line text-[#FF634A]"></i>
      <span>Legenda Simbol & POI C3</span>
    </div>
    <button onclick={onClose} class="text-[#71717A] hover:text-white cursor-pointer p-0.5" aria-label="Tutup legenda">
      <X class="w-4 h-4" />
    </button>
  </div>

  <div class="space-y-2 text-[11px]">
    <!-- Layer Types Legend -->
    <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">Layer Geospasial</span>
    <div class="space-y-1.5 bg-[#18181D] p-2.5 rounded-xl border border-[#24242A]">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#FF634A]"></span>
          <span class="text-zinc-300">Central HUB (Pusat Operasional)</span>
        </span>
        <span class="text-[9px] font-mono text-zinc-500">RADIUS</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2">
          <span class="w-3 h-1 bg-[#F59E0B]"></span>
          <span class="text-zinc-300">Jalan Protokol / Arteri Primer</span>
        </span>
        <span class="text-[9px] font-mono text-amber-400">BOBOT TINGGI</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2">
          <span class="w-3 h-1 bg-[#DC2626]"></span>
          <span class="text-zinc-300">Jalan Tol (Zona Terlarang)</span>
        </span>
        <span class="text-[9px] font-mono text-rose-400">NO-SELL</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-md border border-blue-400 bg-blue-500/20"></span>
          <span class="text-zinc-300">Poligon Zona Penjualan</span>
        </span>
        <span class="text-[9px] font-mono text-blue-400">TARGET</span>
      </div>
    </div>

    <!-- POI Categories Legend -->
    <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block pt-1">Kategori Titik POI Potensial</span>
    <div class="grid grid-cols-1 gap-1">
      {#each LEGEND_CATEGORIES as item}
        <div class="flex items-center gap-2 p-1.5 rounded-lg bg-[#18181D] border border-[#24242A]">
          <div class="w-5 h-5 rounded-md flex items-center justify-center text-white" style="background-color: {item.color};">
            <i class="{item.icon} text-xs"></i>
          </div>
          <span class="text-zinc-300 text-[11px]">{item.label}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
