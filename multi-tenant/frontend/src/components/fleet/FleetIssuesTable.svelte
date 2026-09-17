<script lang="ts">
  import { CheckCircle2, RefreshCw, Tag, Wrench, Check } from 'lucide-svelte';
  import type { FleetIssueItem } from '../../services/armadaService';

  interface Props {
    issues: FleetIssueItem[];
    onRefresh: () => void;
    onResolveIssue: (issueId: string, resolutionType: 'RESOLVED' | 'SENT_TO_MAINTENANCE') => void;
  }

  let { issues, onRefresh, onResolveIssue }: Props = $props();
</script>

<div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
  <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
    <div>
      <h3 class="text-base font-outfit-600 text-white">Daftar Laporan Kerusakan & Bengkel</h3>
      <p class="text-xs text-[#A1A1AA]">Laporan insiden / kendala unit dari rider saat bertugas di lapangan</p>
    </div>
    <button
      onclick={onRefresh}
      class="px-3 py-1.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-xs text-white font-outfit-600 flex items-center gap-1.5 transition-colors cursor-pointer"
    >
      <RefreshCw class="w-3.5 h-3.5" />
      <span>Refresh Laporan</span>
    </button>
  </div>

  {#if issues.length === 0}
    <div class="py-12 text-center text-xs text-zinc-500 space-y-2">
      <CheckCircle2 class="w-8 h-8 text-emerald-400/60 mx-auto" />
      <div>Semua unit armada dalam kondisi prima. Tidak ada laporan kendala aktif.</div>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each issues as issue}
        <div class="p-4 bg-[#18181D] border border-[#26262E] rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-white text-sm">#{issue.armada_code}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600
              {issue.severity === 'CRITICAL' ? 'bg-rose-950/50 text-rose-400 border border-rose-800/40' : 'bg-amber-950/50 text-amber-400 border border-amber-800/40'}">
                {issue.severity}
              </span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">
              {new Date(issue.reported_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div class="text-xs space-y-1">
            <div class="text-zinc-300 font-semibold flex items-center gap-1.5">
              <Tag class="w-3.5 h-3.5 text-[#FF634A]" />
              <span>Komponen: {issue.issue_type}</span>
            </div>
            <p class="text-zinc-400 leading-relaxed bg-[#121215] p-2.5 rounded-xl border border-[#222228]">
              "{issue.description}"
            </p>
            <div class="text-[11px] text-zinc-500 pt-1">
              Dilaporkan oleh: <strong class="text-zinc-300">{issue.rider_name}</strong>
            </div>
          </div>

          <!-- Issue Action Buttons -->
          {#if issue.status === 'REPORTED'}
            <div class="pt-2 border-t border-[#24242A] flex items-center justify-end gap-2">
              <button
                type="button"
                onclick={() => onResolveIssue(issue.id, 'SENT_TO_MAINTENANCE')}
                class="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Wrench class="w-3.5 h-3.5" />
                <span>Kirim ke Bengkel (Maintenance)</span>
              </button>

              <button
                type="button"
                onclick={() => onResolveIssue(issue.id, 'RESOLVED')}
                class="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" />
                <span>Selesaikan Kendala</span>
              </button>
            </div>
          {:else}
            <div class="pt-2 border-t border-[#24242A] flex items-center justify-between text-[11px]">
              <span class="text-zinc-500">Status Penyelesaian:</span>
              <span class="px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-400 font-mono font-bold">
                {issue.status}
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
