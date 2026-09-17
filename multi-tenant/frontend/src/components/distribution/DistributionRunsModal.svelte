<script lang="ts">
  import { onMount } from 'svelte';
  import { X, History, Sparkles, CheckCircle2, User, Calendar, Clock, Layers } from 'lucide-svelte';
  import { distributionService, type DistributionRunItem } from '../../services/distributionService';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open = false, onClose }: Props = $props();

  let loading = $state(false);
  let runs = $state<DistributionRunItem[]>([]);
  let errorMsg = $state<string | null>(null);

  $effect(() => {
    if (open) {
      loadRuns();
    }
  });

  const loadRuns = async () => {
    loading = true;
    errorMsg = null;
    try {
      runs = await distributionService.getDistributionRuns(30);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal memuat riwayat eksekusi distribusi.';
    } finally {
      loading = false;
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-outfit-400">
    <button
      type="button"
      aria-label="Tutup riwayat run"
      class="fixed inset-0 bg-black/50 border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-3xl bg-[#131316] border border-[#2E2E38] rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[85vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-300 flex items-center justify-center font-bold">
            <History class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Log Eksekusi & Audit Distribusi (Distribution Runs)</h3>
            <p class="text-xs text-[#A1A1AA]">Rekaman historis batch plotting, executor, dan rasio pemenuhan kuota</p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if loading}
        <div class="py-16 text-center text-xs text-zinc-400 space-y-2">
          <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin"></div>
          <div>Memuat log audit eksekusi distribusi...</div>
        </div>
      {:else if errorMsg}
        <div class="p-3 bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs rounded-2xl">
          {errorMsg}
        </div>
      {:else if runs.length === 0}
        <div class="py-16 text-center text-xs text-zinc-500">
          Belum ada rekaman eksekusi batch distribusi di sistem.
        </div>
      {:else}
        <div class="space-y-3 overflow-y-auto pr-1 flex-1">
          {#each runs as run}
            <div class="p-4 bg-[#18181E] border border-[#262630] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-bold text-white text-sm">{run.run_number}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold
                  {run.execution_type === 'AUTO' ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40' : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'}">
                    {run.execution_type}
                  </span>
                  {#if run.session_code}
                    <span class="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                      {run.session_code}
                    </span>
                  {/if}
                </div>

                <div class="text-[11px] text-zinc-400 flex flex-wrap items-center gap-3 pt-0.5">
                  <span class="flex items-center gap-1">
                    <User class="w-3 h-3 text-zinc-500" />
                    Eksekutor: <strong class="text-zinc-200">{run.executed_by_name || 'System Auto'}</strong>
                  </span>
                  <span class="flex items-center gap-1">
                    <Clock class="w-3 h-3 text-zinc-500" />
                    {new Date(run.executed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              <!-- Metrics -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center">
                  <div class="text-[10px] text-emerald-400">Terploting</div>
                  <div class="text-sm font-mono font-bold text-emerald-300">{run.assigned_count}</div>
                </div>

                {#if run.unassigned_count > 0}
                  <div class="px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-center">
                    <div class="text-[10px] text-amber-400">Waitlist</div>
                    <div class="text-sm font-mono font-bold text-amber-300">{run.unassigned_count}</div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="pt-2 border-t border-[#24242A] flex justify-end">
        <button
          type="button"
          onclick={onClose}
          class="px-4 py-2 rounded-xl bg-[#24242A] hover:bg-[#32323A] text-white text-xs font-outfit-600 cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
