<script lang="ts">
  import { presenceStore, type LiveRiderTelemetry } from '../../lib/stores/presenceStore.svelte';
  import { Users, Crosshair, ChevronRight, CheckCircle2, AlertTriangle, HelpCircle, MapPinOff } from 'lucide-svelte';

  interface Props {
    onSelectRider: (riderId: string) => void;
  }

  let { onSelectRider }: Props = $props();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return {
          icon: CheckCircle2,
          class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          label: 'Compliant',
        };
      case 'DEVIATED':
        return {
          icon: AlertTriangle,
          class: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          label: 'Deviated',
        };
      case 'UNASSIGNED':
        return {
          icon: HelpCircle,
          class: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          label: 'Unassigned',
        };
      case 'OUTSIDE':
        return {
          icon: MapPinOff,
          class: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          label: 'Outside',
        };
      default:
        return {
          icon: HelpCircle,
          class: 'bg-zinc-800 text-zinc-400 border-zinc-700',
          label: status,
        };
    }
  };

  const handleFocus = (riderId: string) => {
    presenceStore.focusRider(riderId);
  };
</script>

<div class="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
  <!-- Table Header Bar -->
  <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Users class="w-4 h-4 text-amber-400" />
      <h3 class="text-sm font-bold text-zinc-100">Status Operasional Rider Aktif</h3>
    </div>
    <span class="text-xs text-zinc-400">
      Menampilkan <b>{presenceStore.filteredRiders.length}</b> dari {presenceStore.liveRiders.size} Rider
    </span>
  </div>

  <!-- Data Grid Table -->
  <div class="overflow-x-auto">
    <table class="w-full text-left text-xs text-zinc-300">
      <thead class="bg-zinc-950/60 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
        <tr>
          <th class="py-3 px-4">Nama Rider</th>
          <th class="py-3 px-4">Zona Tugas</th>
          <th class="py-3 px-4">Zona Saat Ini</th>
          <th class="py-3 px-4">Status Kepatuhan</th>
          <th class="py-3 px-4">Kecepatan</th>
          <th class="py-3 px-4">Update Terakhir</th>
          <th class="py-3 px-4 text-right">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800/60">
        {#if presenceStore.filteredRiders.length === 0}
          <tr>
            <td colspan="7" class="py-8 text-center text-zinc-500">
              Tidak ada data rider yang cocok dengan filter aktif.
            </td>
          </tr>
        {:else}
          {#each presenceStore.filteredRiders as rider (rider.rider_id)}
            {@const badge = getStatusBadge(rider.compliance_status)}
            {@const StatusIcon = badge.icon}
            <tr class="hover:bg-zinc-800/40 transition-colors">
              <td class="py-3 px-4">
                <div class="font-bold text-zinc-100">{rider.rider_name}</div>
                <div class="text-[10px] text-zinc-500">{rider.fleet_code || 'Armada Standar'}</div>
              </td>
              <td class="py-3 px-4">
                <span class="font-medium text-zinc-300">{rider.assigned_zone_name || '-'}</span>
              </td>
              <td class="py-3 px-4">
                <span class="font-medium {rider.actual_zone_name ? 'text-zinc-200' : 'text-zinc-500'}">
                  {rider.actual_zone_name || 'Di Luar Zona'}
                </span>
              </td>
              <td class="py-3 px-4">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold {badge.class}">
                  <StatusIcon class="w-3 h-3" />
                  {badge.label}
                </span>
              </td>
              <td class="py-3 px-4">
                <span class="text-zinc-300 font-mono">{Math.round(rider.speed_mps * 3.6)} km/h</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-zinc-400">{new Date(rider.last_ping).toLocaleTimeString()}</span>
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onclick={() => handleFocus(rider.rider_id)}
                    class="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                    title="Fokus di Peta"
                  >
                    <Crosshair class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onclick={() => onSelectRider(rider.rider_id)}
                    class="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                  >
                    Riwayat
                    <ChevronRight class="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
