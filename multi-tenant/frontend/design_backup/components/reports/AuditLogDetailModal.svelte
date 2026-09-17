<script lang="ts">
  import { X, ShieldCheck, Clock, User, Globe, Activity, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-svelte';
  import type { AuditLogItem } from '../../services/reportService';

  interface Props {
    open: boolean;
    onClose: () => void;
    log: AuditLogItem | null;
  }

  let { open = false, onClose, log }: Props = $props();

  let copied = $state(false);

  const handleCopyJson = async () => {
    if (!log?.details) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.error(err);
    }
  };
</script>

{#if open && log}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup modal audit log"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <!-- Modal Panel -->
    <div class="relative w-full max-w-xl bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400 flex items-center justify-center shadow-md">
            <Activity class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Detail Rekaman Audit Log</h3>
            <p class="text-xs text-[#A1A1AA]">ID Log #{log.id} • {new Date(log.created_at).toLocaleString('id-ID')}</p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Overview Info Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Pengguna</span>
          <div class="font-outfit-600 text-white truncate">{log.user_name || 'System Auto'}</div>
          <span class="text-[10px] text-[#A1A1AA]">{log.user_role || 'SYSTEM'}</span>
        </div>

        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Aksi & Entitas</span>
          <div class="font-outfit-600 text-purple-400">{log.action}</div>
          <span class="text-[10px] text-[#A1A1AA]">{log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}</span>
        </div>

        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Status Eksekusi</span>
          <div class="font-outfit-600 font-mono {log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}">
            {log.status || 'SUCCESS'}
          </div>
          <span class="text-[10px] text-[#A1A1AA] font-mono truncate">{log.ip_address || '127.0.0.1'}</span>
        </div>
      </div>

      <!-- Payload JSON Details -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-outfit-600 text-zinc-300">Rincian Perubahan Data (Payload JSON):</span>
          {#if log.details}
            <button
              type="button"
              onclick={handleCopyJson}
              class="px-2.5 py-1 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-200 border border-[#2E2E38] text-[11px] font-outfit-600 flex items-center gap-1 cursor-pointer transition-all"
            >
              {#if copied}
                <Check class="w-3 h-3 text-emerald-400" />
                <span class="text-emerald-400">Tersalin</span>
              {:else}
                <Copy class="w-3 h-3 text-[#FF634A]" />
                <span>Salin JSON</span>
              {/if}
            </button>
          {/if}
        </div>

        <pre class="p-4 rounded-2xl bg-[#09090B] border border-[#222228] font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-56 leading-relaxed selection:bg-[#FF634A]/30"><code>{log.details ? JSON.stringify(log.details, null, 2) : '// Tidak ada payload data tambahan'}</code></pre>
      </div>

      <!-- Footer Action -->
      <div class="pt-3 border-t border-[#24242A] flex items-center justify-end">
        <button
          type="button"
          onclick={onClose}
          class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-white text-xs font-outfit-600 transition-colors cursor-pointer"
        >
          Tutup Detail
        </button>
      </div>
    </div>
  </div>
{/if}
