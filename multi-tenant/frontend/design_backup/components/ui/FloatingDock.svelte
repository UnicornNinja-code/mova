<script lang="ts">
  import { Home, LayoutGrid, Flame, Zap, User } from 'lucide-svelte';

  export interface DockTabItem {
    id: string;
    icon: any;
    label: string;
    badge?: number | string;
    highlight?: boolean;
  }

  interface Props {
    activeTab?: string;
    tabs?: DockTabItem[];
    onTabChange?: (tabId: string) => void;
    class?: string;
  }

  let {
    activeTab = 'home',
    tabs = [
      { id: 'home', icon: Home, label: 'Beranda' },
      { id: 'catalog', icon: LayoutGrid, label: 'Katalog' },
      { id: 'hotspots', icon: Flame, label: 'Hotspot DSS' },
      { id: 'action', icon: Zap, label: 'Aksi Cepat', highlight: true },
      { id: 'profile', icon: User, label: 'Profil' },
    ],
    onTabChange = () => {},
    class: customClass = '',
  }: Props = $props();

  const handleSelect = (id: string) => {
    onTabChange(id);
  };
</script>

<!-- Floating Pill Dock Container -->
<nav
  aria-label="Navigasi Bawah Rider"
  class="relative mx-auto w-full bg-[#18181D]/90 backdrop-blur-2xl border border-white/10 rounded-full px-3 py-2 sm:py-2.5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)] flex items-center justify-around select-none transition-all duration-300 {customClass}"
>
  {#each tabs as tab}
    {@const IconComponent = tab.icon}
    {@const isActive = activeTab === tab.id}
    
    <button
      type="button"
      onclick={() => handleSelect(tab.id)}
      class="relative p-2.5 sm:p-3 rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer group focus:outline-none"
      title={tab.label}
      aria-label={tab.label}
    >
      <!-- Active Pill Halo Glow -->
      {#if isActive}
        <span class="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF634A]/25 to-amber-500/20 border border-[#FF634A]/40 shadow-lg shadow-[#FF634A]/25 transition-all"></span>
      {/if}

      <!-- Center Zap / Primary Action Button Highlight Accent -->
      {#if tab.highlight && !isActive}
        <span class="absolute inset-0 rounded-full bg-white/5 border border-white/10 group-hover:bg-[#FF634A]/20 transition-all"></span>
      {/if}

      <!-- Icon with Micro-Animation -->
      <span class="relative z-10 transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
        <IconComponent
          class="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2] transition-colors duration-200
          {isActive 
            ? 'text-[#FF634A]' 
            : tab.highlight 
              ? 'text-white' 
              : 'text-zinc-400 group-hover:text-white'}"
        />
      </span>

      <!-- Badge Indicator (e.g. pending duty or cart count) -->
      {#if tab.badge}
        <span class="absolute -top-0.5 -right-0.5 z-20 min-w-[16px] h-4 px-1 rounded-full bg-[#FF634A] text-white text-[9px] font-bold flex items-center justify-center shadow-md">
          {tab.badge}
        </span>
      {/if}

      <!-- Tiny Active Dot Underneath -->
      {#if isActive}
        <span class="absolute bottom-1 w-1 h-1 rounded-full bg-[#FF634A] shadow-sm shadow-[#FF634A]"></span>
      {/if}
    </button>
  {/each}
</nav>
