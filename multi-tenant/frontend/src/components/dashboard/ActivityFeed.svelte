<script lang="ts">
  export interface ActivityItem {
    id: string;
    timestamp: string;
    type: 'SALES' | 'RIDER' | 'ZONE' | 'FLEET' | 'CRON';
    title: string;
    details?: string;
  }

  interface Props {
    activities: ActivityItem[];
    onClear: () => void;
  }

  let { activities = [], onClear }: Props = $props();

  const typeConfig = {
    SALES: { label: 'SALES', iconClass: 'bx bx-shopping-bag', color: 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40' },
    RIDER: { label: 'RIDER', iconClass: 'bx bx-map-pin', color: 'text-blue-400 bg-blue-950/40 border border-blue-800/40' },
    ZONE: { label: 'ZONA', iconClass: 'bx bx-shield-quarter', color: 'text-rose-400 bg-rose-950/40 border border-rose-800/40' },
    FLEET: { label: 'FLEET', iconClass: 'bx bx-cycling', color: 'text-amber-400 bg-amber-950/40 border border-amber-800/40' },
    CRON: { label: 'CRON', iconClass: 'bx bx-broadcast', color: 'text-[#A1A1AA] bg-[#1F1F24] border border-[#2C2C34]' },
  };
</script>

<div class="card-dark p-4 sm:p-5 flex flex-col justify-between font-outfit-400">
  <!-- Header: Live Feed Title & Clear Button -->
  <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
    <div class="flex items-center gap-2">
      <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
      <div>
        <h3 class="text-title-18 font-outfit-600 text-white leading-tight">Live Activity Stream</h3>
        <p class="text-[11px] text-[#A1A1AA]">Event PostgreSQL & Socket.IO real-time</p>
      </div>
    </div>

    <button
      onclick={onClear}
      class="p-1.5 text-[#71717A] hover:text-rose-400 hover:bg-[#1F1F24] rounded-lg transition-colors cursor-pointer"
      title="Bersihkan Aktivitas"
    >
      <i class="bx bx-trash text-base"></i>
    </button>
  </div>

  <!-- Activity List Stream -->
  <div class="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
    {#if activities.length === 0}
      <div class="py-12 text-center text-xs text-[#71717A]">
        Menunggu event aktivitas real-time berikutnya...
      </div>
    {:else}
      {#each activities as item (item.id)}
        {@const cfg = typeConfig[item.type] || typeConfig.CRON}
        <div class="flex items-start gap-2.5 p-2 rounded-2xl bg-[#18181D] border border-[#24242A] transition-all hover:bg-[#202027] hover:border-[#34343E]">
          <div class="w-7 h-7 rounded-xl flex items-center justify-center {cfg.color} shrink-0 mt-0.5">
            <i class="{cfg.iconClass} text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <div class="flex items-center gap-1.5 truncate">
                <span class="px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-400 text-[9px] font-outfit-600 border border-amber-800/40">
                  Simulasi
                </span>
                <span class="text-xs font-outfit-600 text-white truncate">{item.title}</span>
              </div>
              <span class="text-[10px] text-[#71717A] shrink-0 font-mono">{item.timestamp}</span>
            </div>
            {#if item.details}
              <p class="text-[11px] text-[#A1A1AA] truncate mt-0.5">{item.details}</p>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Footer Indicator -->
  <div class="mt-3 pt-2.5 border-t border-[#24242A] flex items-center justify-between text-[10px] text-[#71717A]">
    <span>Auto-scroll Aktif (●)</span>
    <span class="font-outfit-600 text-white">{activities.length} Event Terkini</span>
  </div>
</div>
