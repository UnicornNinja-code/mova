<script lang="ts">
  import { cn } from "$lib/utils";
  import { MovaLogo } from "$components/ui/brand";
  import { Badge } from "$components/ui/badge";
  import { Button } from "$components/ui/button";

  export interface SidebarNavItem {
    id: string;
    label: string;
    icon: string;
    badge?: string;
    badgeVariant?: "default" | "active" | "hold" | "in-review" | "progress";
    href?: string;
  }

  export interface SidebarNavGroup {
    group: string;
    items: SidebarNavItem[];
  }

  interface AppSidebarProps {
    collapsed?: boolean;
    activeId?: string;
    onselect?: (id: string) => void;
    ontoggleCollapse?: () => void;
    class?: string;
  }

  let {
    collapsed = $bindable(false),
    activeId = $bindable("dashboard"),
    onselect,
    ontoggleCollapse,
    class: className = "",
  }: AppSidebarProps = $props();

  const navigationGroups: SidebarNavGroup[] = [
    {
      group: "COMMAND & DSS",
      items: [
        { id: "dashboard", label: "Dashboard Utama", icon: "bx-grid-alt", badge: "Live", badgeVariant: "default" },
        { id: "topsis-rank", label: "Rekomendasi TOPSIS", icon: "bx-target-lock", badge: "Auto", badgeVariant: "active" },
        { id: "spatial-map", label: "Peta Spasial Geofence", icon: "bx-map-alt" },
        { id: "bwm-weights", label: "Kalibrasi Bobot BWM", icon: "bx-slider-alt" },
      ],
    },
    {
      group: "ARMADA & OPERASIONAL",
      items: [
        { id: "fleet-manage", label: "Manajemen Armada", icon: "bx-car", badge: "32", badgeVariant: "in-review" },
        { id: "hold-verification", label: "Reservasi & Hold (3-Min)", icon: "bx-time-five", badge: "180s", badgeVariant: "hold" },
        { id: "riders-hub", label: "Petugas & Rider Hub", icon: "bx-group" },
      ],
    },
    {
      group: "DATA & INTEGRASI",
      items: [
        { id: "poi-sync", label: "Sinkronisasi POI (OSM)", icon: "bx-layer" },
        { id: "weather-telemetry", label: "Telemetri Cuaca Hub", icon: "bx-cloud-rain", badge: "30m", badgeVariant: "progress" },
        { id: "audit-logs", label: "Audit Logs & Security", icon: "bx-shield-quarter" },
      ],
    },
  ];

  function handleItemClick(id: string) {
    activeId = id;
    onselect?.(id);
  }
</script>

<aside
  class={cn(
    "relative flex flex-col justify-between border-r border-white/10 bg-[#121215] text-[#FAFAFA] font-sans transition-all duration-300 ease-in-out select-none",
    collapsed ? "w-20" : "w-64 sm:w-72",
    className
  )}
>
  <!-- Top Branding & Status Header -->
  <div class="p-5 border-b border-white/[0.06]">
    <div class="flex items-center justify-between">
      {#if !collapsed}
        <MovaLogo size="md" />
      {:else}
        <span class="font-heading text-2xl font-extrabold text-white">M<span class="text-[#FF634A]">.</span></span>
      {/if}

      <!-- Collapse Toggle Button via Primitive -->
      <Button
        variant="outline"
        size="icon"
        aria-label="Toggle sidebar collapse"
        onclick={() => {
          collapsed = !collapsed;
          ontoggleCollapse?.();
        }}
        class="h-8 w-8 rounded-lg border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
      >
        <i class={cn("bx text-lg transition-transform duration-200", collapsed ? "bx-chevron-right" : "bx-chevron-left")}></i>
      </Button>
    </div>

    <!-- Active Hub Status Indicator -->
    {#if !collapsed}
      <div class="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#18181b] p-2.5">
        <div class="flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="font-heading text-xs font-semibold text-zinc-300">Hub Surabaya Pusat</span>
        </div>
        <span class="text-[11px] font-heading text-[#FF634A]">ONLINE</span>
      </div>
    {/if}
  </div>

  <!-- Navigation Scroll Area -->
  <div class="flex-1 overflow-y-auto px-3 py-4 space-y-6">
    {#each navigationGroups as group}
      <div class="space-y-1">
        {#if !collapsed}
          <div class="px-3 pb-1.5 font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {group.group}
          </div>
        {/if}

        {#each group.items as item}
          <button
            type="button"
            onclick={() => handleItemClick(item.id)}
            class={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-heading font-medium transition-all duration-150 relative cursor-pointer",
              activeId === item.id
                ? "bg-[#FF634A]/10 text-white font-semibold border border-[#FF634A]/30 shadow-sm"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
            )}
            title={collapsed ? item.label : undefined}
          >
            <!-- Left Active Indicator Pill with Glow -->
            {#if activeId === item.id}
              <div class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#FF634A] shadow-[0_0_8px_rgba(255,99,74,0.6)]"></div>
            {/if}

            <i class={cn("bx text-lg leading-none shrink-0 transition-colors", activeId === item.id ? "text-[#FF634A]" : "text-zinc-400 group-hover:text-white")}></i>

            {#if !collapsed}
              <span class="flex-1 text-left truncate">{item.label}</span>
              {#if item.badge}
                <Badge variant={item.badgeVariant || "default"} class="h-5 px-2 text-[10px]">
                  {item.badge}
                </Badge>
              {/if}
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Footer User Profile Widget -->
  <div class="p-3 border-t border-white/[0.06] bg-[#0e0e10]/60">
    <div class={cn("flex items-center gap-3 rounded-2xl border border-white/10 bg-[#18181b] p-2.5", collapsed && "justify-center p-2")}>
      <!-- Avatar Initial -->
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF634A] to-[#D9442C] text-white font-heading font-bold text-sm shadow-md">
        FB
      </div>

      {#if !collapsed}
        <div class="flex-1 min-w-0 leading-tight">
          <div class="truncate font-heading text-xs font-bold text-white">Febriyan R.</div>
          <div class="truncate text-[11px] font-sans text-zinc-400">Superadmin Hub</div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Logout session"
          class="h-7 w-7 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
          title="Keluar Akun"
        >
          <i class="bx bx-log-out text-base"></i>
        </Button>
      {/if}
    </div>
  </div>
</aside>
