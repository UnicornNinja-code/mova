<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Wifi, BatteryMedium, Signal } from 'lucide-svelte';

  interface Props {
    title?: string;
    showStatusBar?: boolean;
    showDynamicIsland?: boolean;
    deviceTime?: string;
    class?: string;
    children?: Snippet;
    footer?: Snippet;
    modal?: Snippet;
  }

  let {
    title = '',
    showStatusBar = true,
    showDynamicIsland = true,
    deviceTime = '',
    class: customClass = '',
    children,
    footer,
    modal,
  }: Props = $props();

  // Format live current time if not provided
  let currentTime = $state('');

  $effect(() => {
    const updateTime = () => {
      if (deviceTime) {
        currentTime = deviceTime;
        return;
      }
      const now = new Date();
      currentTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  });
</script>

<!-- Outer Container with Ambient Radial Glow for Desktop Experience -->
<div class="relative w-full min-h-screen flex items-center justify-center sm:py-8 sm:px-4 bg-[#09090B] pattern-dots-dark overflow-x-hidden font-outfit-400 select-none">
  <!-- Soft Ambient Backlight -->
  <div class="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-[#FF634A]/15 via-purple-600/10 to-blue-500/10 rounded-full blur-[130px] pointer-events-none"></div>

  <!-- Mobile Phone Hardware Shell (Responsive: Fullscreen on mobile, iPhone bezel on desktop) -->
  <div class="relative w-full sm:max-w-[400px] h-full sm:h-[844px] bg-[#0E0E12] sm:border-[8px] sm:border-[#1F1F26] sm:rounded-[52px] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col overflow-hidden transition-all duration-300 {customClass}">
    
    <!-- Top Hardware Speaker Earpiece Accent (Desktop Mockup Only) -->
    <div class="hidden sm:block absolute top-2.5 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#282832] rounded-full z-50"></div>

    <!-- Status Bar & Dynamic Island -->
    {#if showStatusBar}
      <div class="relative z-40 px-6 pt-3 pb-2 flex items-center justify-between text-zinc-300 text-xs font-outfit-600 select-none shrink-0">
        <!-- Digital Clock Time -->
        <span class="text-[13px] font-semibold tracking-tight text-white pl-1">{currentTime || '09:41'}</span>

        <!-- Dynamic Island Capsule -->
        {#if showDynamicIsland}
          <div class="absolute left-1/2 -translate-x-1/2 top-2.5 h-7 w-28 bg-black border border-white/10 rounded-full flex items-center justify-between px-2.5 shadow-md shadow-black/80 transition-all hover:w-36 duration-300 cursor-pointer group">
            <div class="w-2.5 h-2.5 rounded-full bg-[#FF634A] animate-pulse"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700"></div>
          </div>
        {/if}

        <!-- Status Icons (Cellular, Wifi, Battery) -->
        <div class="flex items-center gap-2 pr-1 text-zinc-300">
          <Signal class="w-3.5 h-3.5" />
          <Wifi class="w-3.5 h-3.5" />
          <div class="flex items-center gap-0.5">
            <span class="text-[10px] text-zinc-400 font-mono">92%</span>
            <BatteryMedium class="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>
    {/if}

    <!-- Scrollable Screen Content Body -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-none px-4 pb-28 pt-1">
      {#if children}
        {@render children()}
      {/if}
    </div>

    <!-- Fixed / Floating Bottom Safe Area / Dock Container -->
    {#if footer}
      <div class="absolute bottom-4 inset-x-4 z-30 flex justify-center">
        <div class="w-full max-w-[340px]">
          {@render footer()}
        </div>
      </div>
    {/if}

    <!-- Modal Overlay Slot (Sliding Bottom Sheet) inside Phone Hardware -->
    {#if modal}
      {@render modal()}
    {/if}

    <!-- Bottom Home Indicator Bar -->
    <div class="hidden sm:block absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-40 pointer-events-none"></div>
  </div>
</div>

<style>
  /* Custom thin scrollbar styling */
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-none {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
