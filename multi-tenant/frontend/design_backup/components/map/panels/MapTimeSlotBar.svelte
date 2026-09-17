<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';

  interface Props {
    selectedTimeSlotKey: 'pagi' | 'siang' | 'sore' | 'malam';
    timeSlotDefinitions: Record<'pagi' | 'siang' | 'sore' | 'malam', { name: string; timeRange: string; icon: string; desc: string }>;
    onSelectSlot: (slot: 'pagi' | 'siang' | 'sore' | 'malam') => void;
    onBackToDashboard?: () => void;
  }

  let {
    selectedTimeSlotKey,
    timeSlotDefinitions,
    onSelectSlot,
    onBackToDashboard,
  }: Props = $props();

  let activeTimeSlot = $derived(timeSlotDefinitions[selectedTimeSlotKey]);
</script>

<div class="h-11 bg-[#131316]/95 backdrop-blur-xl border border-[#2E2E38] rounded-3xl shadow-2xl px-2 sm:px-3 flex items-center gap-2 text-white shrink-0">
  <!-- Time Slot Switcher Pills -->
  <div class="flex items-center gap-1 bg-[#18181D] p-0.5 rounded-2xl border border-[#24242A]">
    {#each (['pagi', 'siang', 'sore', 'malam'] as const) as slotKey}
      {@const def = timeSlotDefinitions[slotKey]}
      {@const isSelected = selectedTimeSlotKey === slotKey}
      <button
        onclick={() => onSelectSlot(slotKey)}
        class="px-2 sm:px-3 py-1 rounded-xl text-[11px] font-outfit-600 transition-all flex items-center gap-1 cursor-pointer
        {isSelected 
          ? 'bg-[#FF634A] text-white shadow-md shadow-orange-950/40 font-bold' 
          : 'text-zinc-400 hover:text-white hover:bg-[#22222A]'}"
        title="{def.name} ({def.timeRange}) — {def.desc}"
      >
        <i class="{def.icon} text-xs"></i>
        <span>{def.name}</span>
      </button>
    {/each}
  </div>

  <span class="text-[#3E3E4A] hidden md:inline">|</span>

  <!-- Current Active Window Label -->
  <div class="hidden lg:flex items-center gap-1.5 text-xs">
    <span class="text-[#8E8E93] text-[10px] font-mono">JAM:</span>
    <span class="font-bold text-[#FF8573] font-mono text-[11px]">{activeTimeSlot?.timeRange}</span>
  </div>

  {#if onBackToDashboard}
    <button
      onclick={onBackToDashboard}
      class="ml-1 px-2.5 py-1 rounded-xl bg-[#1C1C22] hover:bg-[#282830] text-[11px] font-outfit-600 text-zinc-300 hover:text-white border border-[#2E2E38] transition-all flex items-center gap-1 cursor-pointer"
      title="Kembali ke Dashboard Utama"
    >
      <ArrowLeft class="w-3.5 h-3.5" />
      <span class="hidden sm:inline">Dashboard</span>
    </button>
  {/if}
</div>
