<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    ShieldCheck, 
    History, 
    RefreshCw, 
    Clock, 
    User, 
    Filter, 
    FileSpreadsheet, 
    Sparkles, 
    AlertCircle 
  } from 'lucide-svelte';
  import { axiosInstance } from '../../lib/axios';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let auditLogs = $state<any[]>([
    { id: '1', action: 'DISTRIBUTION_COMMITTED', user_name: 'Supervisor Surabaya', entity: 'session:20260903-PAGI', details: 'Auto plotting committed for 12 riders', created_at: '2026-09-03 06:45:12' },
    { id: '2', action: 'EMERGENCY_SWAP', user_name: 'Supervisor Surabaya', entity: 'assignment:asn_102', details: 'Mid-day swap rider #10 to rider #15 (FLAT_TIRE)', created_at: '2026-09-03 11:20:05' },
    { id: '3', action: 'ARMADA_CLAIMED', user_name: 'Ahmad Rider', entity: 'armada:ARM-GB-001', details: 'Claimed via 180s hold checklist (IN_USE)', created_at: '2026-09-03 07:05:40' },
    { id: '4', action: 'SHIFT_SETTLEMENT_APPROVED', user_name: 'Supervisor Surabaya', entity: 'settlement:stl_88', details: 'Settled Rp 195.000 (Selisih: Rp 0)', created_at: '2026-09-03 15:10:22' },
    { id: '5', action: 'BWM_WEIGHTS_UPDATED', user_name: 'SuperAdmin', entity: 'dss_config:surabaya', details: 'Updated pairwise weights (CR = 0.042)', created_at: '2026-09-03 06:00:15' },
  ]);

  let cronJobs = $state<any[]>([
    { name: 'Weather Telemetry Sync', schedule: '*/30 * * * *', last_run: '10 menit lalu', status: 'ACTIVE', desc: 'Ambil data Open-Meteo per zona' },
    { name: 'Evening Shift Auto-Settlement', schedule: '0 22 * * *', last_run: 'Kemarin 22:00', status: 'ACTIVE', desc: 'Rekonsiliasi akhir & arsip sesi harian' },
    { name: 'LBS Redis Radar Expiry Cleanup', schedule: '*/5 * * * *', last_run: '2 menit lalu', status: 'ACTIVE', desc: 'Bersihkan geoposisi rider yang telah checkout' },
  ]);

  const loadAuditLogs = async () => {
    loading = true;
    try {
      const res = await axiosInstance.get('/audit', { params: { limit: 30 } });
      if (res.data && res.data.length > 0) {
        auditLogs = res.data;
      }
    } catch {
      // Keep defaults
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    loadAuditLogs();
  });
</script>

<div class="space-y-6 max-w-7xl mx-auto pb-12 font-outfit-400">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold shadow-lg shadow-purple-500/10">
        <ShieldCheck class="w-5 h-5 stroke-[2.2]" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl sm:text-2xl font-outfit-600 font-bold text-white">Log Audit & Penjadwal Cron</h1>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
            Security & Forensik
          </span>
        </div>
        <p class="text-xs text-zinc-400">
          Riwayat rekaman seluruh aksi operasional beresiko dan status penjadwalan latar belakang
        </p>
      </div>
    </div>

    <button
      type="button"
      onclick={loadAuditLogs}
      class="px-3.5 py-2 rounded-xl bg-[#1A1A22] hover:bg-[#24242E] text-zinc-300 text-xs font-bold border border-[#2E2E3C] transition-all cursor-pointer flex items-center gap-1.5"
    >
      <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
      <span>Refresh Log</span>
    </button>
  </div>

  <!-- Cron Jobs Status Grid -->
  <div class="space-y-2.5">
    <h3 class="text-xs font-bold text-zinc-300 flex items-center gap-2">
      <Clock class="w-4 h-4 text-purple-400" />
      Status Background Cron Scheduler
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      {#each cronJobs as job}
        <div class="p-4 rounded-3xl bg-[#131317] border border-[#24242E] space-y-2 shadow-lg">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">{job.name}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {job.status}
            </span>
          </div>
          <p class="text-[11px] text-zinc-400">{job.desc}</p>
          <div class="pt-2 border-t border-[#22222A] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>Cron: {job.schedule}</span>
            <span>Last: {job.last_run}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Audit Logs Table -->
  <div class="p-5 rounded-3xl bg-[#131317] border border-[#24242E] space-y-4 shadow-xl">
    <div class="flex items-center justify-between pb-3 border-b border-[#24242E]">
      <div class="flex items-center gap-2">
        <History class="w-4 h-4 text-purple-400" />
        <h3 class="text-sm font-bold text-white">Log Aktivitas Forensik Sistem</h3>
      </div>
      <span class="text-xs font-mono text-zinc-400">{auditLogs.length} Entri Terakhir</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs text-zinc-300">
        <thead class="text-[10px] font-bold uppercase text-zinc-400 border-b border-[#22222A] bg-[#16161D]">
          <tr>
            <th class="p-3">Waktu</th>
            <th class="p-3">Tipe Aksi</th>
            <th class="p-3">Pengguna / Petugas</th>
            <th class="p-3">Target Entitas</th>
            <th class="p-3">Detail Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#202028]">
          {#each auditLogs as log}
            <tr class="hover:bg-[#181822] transition-colors">
              <td class="p-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">{log.created_at}</td>
              <td class="p-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {log.action}
                </span>
              </td>
              <td class="p-3 font-bold text-white">{log.user_name || 'System'}</td>
              <td class="p-3 font-mono text-[11px] text-zinc-400">{log.entity || '-'}</td>
              <td class="p-3 text-zinc-300 text-[11px]">{log.details}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
