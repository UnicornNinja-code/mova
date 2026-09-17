<script lang="ts">
  import { Bell, MapPin, Bike, LogOut } from 'lucide-svelte';
  import { authStore } from '../../lib/stores/auth.svelte';

  interface Props {
    zoneName?: string;
    armadaCode?: string;
    unreadNotifs?: number;
    onLogout?: () => void;
    onNotifClick?: () => void;
  }

  let {
    zoneName = 'Zona Pahlawan',
    armadaCode = 'ARM-GB-001',
    unreadNotifs = 2,
    onLogout = () => {},
    onNotifClick = () => {},
  }: Props = $props();

  const riderName = $derived(authStore.user?.name || 'Rider Lapangan');
</script>

<header class="w-full flex items-center justify-between py-2.5 mb-2 select-none">
  <!-- Left: Avatar & Greeting -->
  <div class="flex items-center gap-2.5">
    <div class="relative w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF634A] to-amber-500 p-0.5 shadow-md shadow-[#FF634A]/20">
      <div class="w-full h-full rounded-full bg-[#18181D] flex items-center justify-center text-white font-bold text-sm">
        {riderName.charAt(0).toUpperCase()}
      </div>
      <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#18181D]"></span>
    </div>

    <div class="flex flex-col">
      <span class="text-[11px] text-zinc-400 font-medium">Selamat Siang,</span>
      <h1 class="text-sm font-outfit-600 font-bold text-white tracking-tight leading-tight">
        {riderName.split(' ')[0]}
      </h1>
    </div>
  </div>

  <!-- Right: Status Tags & Action Buttons -->
  <div class="flex items-center gap-2">
    <!-- Assigned Armada Pill -->
    <div class="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#18181D] border border-[#272730] text-[11px] font-mono text-zinc-300">
      <Bike class="w-3.5 h-3.5 text-[#FF634A]" />
      <span>{armadaCode}</span>
    </div>

    <!-- Notification Bell Button -->
    <button
      type="button"
      onclick={onNotifClick}
      class="relative w-9 h-9 rounded-full bg-[#18181D] border border-[#272730] hover:border-[#383842] flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
      title="Notifikasi"
      aria-label="Buka Notifikasi"
    >
      <Bell class="w-4 h-4" />
      {#if unreadNotifs > 0}
        <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF634A]"></span>
      {/if}
    </button>

    <!-- Logout / Selesai Sesi Button -->
    <button
      type="button"
      onclick={onLogout}
      class="w-9 h-9 rounded-full bg-[#18181D] border border-[#272730] hover:border-rose-500/50 hover:text-rose-400 flex items-center justify-center text-zinc-400 transition-all cursor-pointer"
      title="Keluar Sesi"
      aria-label="Logout"
    >
      <LogOut class="w-4 h-4" />
    </button>
  </div>
</header>
