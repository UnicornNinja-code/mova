<script lang="ts">
  import { onMount } from 'svelte';
  import { reportService, type AuditLogItem } from '../../services/reportService';
  import AuditLogDetailModal from './AuditLogDetailModal.svelte';
  import { 
    Activity, 
    Download, 
    Printer, 
    Search, 
    Filter, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    Shield, 
    Eye,
    RefreshCw
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  let loading = $state(true);
  let logs = $state<AuditLogItem[]>([]);
  let errorMsg = $state<string | null>(null);

  // Filters
  let selectedAction = $state('');
  let selectedEntity = $state('');
  let selectedStatus = $state('');
  let searchQuery = $state('');

  // Selected Log for detail modal
  let selectedLog = $state<AuditLogItem | null>(null);
  let detailModalOpen = $state(false);

  const loadAuditLogs = async () => {
    loading = true;
    errorMsg = null;
    try {
      const res = await reportService.getAuditLogs({
        action: selectedAction || undefined,
        entity_type: selectedEntity || undefined,
        status: selectedStatus || undefined,
        limit: 100,
      });
      logs = res.logs || [];
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat log audit sistem.';
    } finally {
      loading = false;
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID Log', 'Waktu', 'Pengguna', 'Role', 'Aksi', 'Entitas', 'Status', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      l.id,
      new Date(l.created_at).toLocaleString('id-ID'),
      l.user_name || 'System',
      l.user_role || 'SYSTEM',
      l.action,
      `${l.entity_type}${l.entity_id ? ` (#${l.entity_id})` : ''}`,
      l.status,
      l.ip_address || '127.0.0.1',
    ]);
    reportService.exportToCsv('Laporan_Audit_Log_Sistem', headers, rows);
  };

  const handlePrintPdf = () => {
    const headers = ['Waktu', 'Pengguna', 'Role', 'Aksi Operasi', 'Entitas', 'Status', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      new Date(l.created_at).toLocaleString('id-ID'),
      l.user_name || 'System',
      l.user_role || 'SYSTEM',
      l.action,
      l.entity_type,
      l.status,
      l.ip_address || '-',
    ]);

    reportService.printReportDoc({
      title: 'Laporan Audit Log Keamanan & Operasional Sistem',
      subtitle: 'Catatan Jejak Audit Aktivitas Pengguna & Perubahan Konfigurasi',
      kpis: [
        { label: 'Total Log Terekam', value: `${logs.length} Log` },
        { label: 'Tingkat Keberhasilan', value: `${(logs.filter(l => l.status === 'SUCCESS').length / (logs.length || 1) * 100).toFixed(1)}%` },
        { label: 'Entitas Terkini', value: 'Multi-Entity' },
      ],
      headers,
      rows,
    });
  };

  const openDetail = (log: AuditLogItem) => {
    selectedLog = log;
    detailModalOpen = true;
  };

  const filteredLogs = $derived(
    logs.filter((l) => {
      const matchSearch =
        (l.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.entity_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.ip_address || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    })
  );

  onMount(() => {
    loadAuditLogs();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Top KPI Cards for Audit -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Total Log Terarsip</span>
        <Activity class="w-4 h-4 text-purple-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-white font-mono">{logs.length} <span class="text-xs text-[#A1A1AA] font-normal">Entri</span></div>
      <span class="text-[11px] text-[#A1A1AA]">Rekaman Aktivitas Sistem</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Status Sukses</span>
        <CheckCircle2 class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-emerald-400 font-mono">
        {logs.filter((l) => l.status === 'SUCCESS').length}
      </div>
      <span class="text-[11px] text-emerald-400/80">Operasi Berhasil</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Gagal / Peringatan</span>
        <AlertTriangle class="w-4 h-4 text-rose-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-rose-400 font-mono">
        {logs.filter((l) => l.status === 'FAILED').length}
      </div>
      <span class="text-[11px] text-rose-400/80">Perlu Perhatian</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Aksi DSS & Bobot</span>
        <Shield class="w-4 h-4 text-amber-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-amber-400 font-mono">
        {logs.filter((l) => l.entity_type.includes('DSS') || l.action.includes('CALIBRATE')).length}
      </div>
      <span class="text-[11px] text-amber-400/80">Perubahan Algoritma</span>
    </div>
  </div>

  {#if errorMsg}
    <Alert variant="danger" title="Kendala Audit Log">{errorMsg}</Alert>
  {/if}

  <!-- MAIN AUDIT LOGS TABLE -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
      <div>
        <h3 class="text-sm sm:text-base font-outfit-600 text-white">Log Audit Keamanan & Jejak Operasional</h3>
        <p class="text-xs text-[#A1A1AA] mt-0.5">Seluruh perubahan konfigurasi, zona, data armada, dan eksekusi DSS terekam otomatis.</p>
      </div>

      <!-- Export Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onclick={handleExportCsv}
          class="px-3.5 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-200 hover:text-white border border-[#2E2E38] text-xs font-outfit-600 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Download class="w-3.5 h-3.5 text-emerald-400" />
          <span>Unduh CSV</span>
        </button>

        <button
          type="button"
          onclick={handlePrintPdf}
          class="pill-btn-orange text-xs font-outfit-600 cursor-pointer"
        >
          <span class="px-4 py-2 flex items-center gap-1.5 text-white font-bold">
            <Printer class="w-3.5 h-3.5" />
            <span>Cetak / Ekspor PDF</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <!-- Search Input -->
      <div class="relative">
        <input
          type="text"
          placeholder="Cari aksi, user, IP..."
          bind:value={searchQuery}
          class="w-full pl-3.5 pr-4 py-2 text-xs bg-[#1A1A1F] border border-[#2E2E38] rounded-xl text-white placeholder-[#71717A] focus:border-[#FF634A] focus:outline-none"
        />
      </div>

      <!-- Action Filter -->
      <div>
        <select
          bind:value={selectedAction}
          onchange={loadAuditLogs}
          class="w-full px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
        >
          <option value="">Semua Jenis Aksi</option>
          <option value="LOGIN">LOGIN</option>
          <option value="CREATE">CREATE (Tambah Data)</option>
          <option value="UPDATE">UPDATE (Ubah Data)</option>
          <option value="DELETE">DELETE (Hapus Data)</option>
          <option value="CALIBRATE_BWM">CALIBRATE_BWM (Bobot)</option>
          <option value="EVALUATE_TOPSIS">EVALUATE_TOPSIS (Simulasi)</option>
        </select>
      </div>

      <!-- Entity Filter -->
      <div>
        <select
          bind:value={selectedEntity}
          onchange={loadAuditLogs}
          class="w-full px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
        >
          <option value="">Semua Entitas Target</option>
          <option value="ZONE">Zona Wilayah</option>
          <option value="USER">Pengguna</option>
          <option value="DSS_CONFIGURATION">Konfigurasi DSS</option>
          <option value="COMPETITOR">Kompetitor Kopi</option>
          <option value="ARMADA">Armada Kopi</option>
        </select>
      </div>

      <!-- Status Filter -->
      <div>
        <select
          bind:value={selectedStatus}
          onchange={loadAuditLogs}
          class="w-full px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
        >
          <option value="">Semua Status</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>
    </div>

    <!-- Logs Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Waktu</th>
            <th class="py-3 px-4">Pengguna</th>
            <th class="py-3 px-4">Aksi Operasi</th>
            <th class="py-3 px-4">Entitas Target</th>
            <th class="py-3 px-3 text-center">Status</th>
            <th class="py-3 px-4">IP Address</th>
            <th class="py-3 px-3 text-center">Detail</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat catatan log audit...</div>
              </td>
            </tr>
          {:else if filteredLogs.length === 0}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#71717A]">
                Tidak ada catatan log audit yang sesuai filter.
              </td>
            </tr>
          {:else}
            {#each filteredLogs as log}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-mono text-[11px] text-zinc-300">
                  {new Date(log.created_at).toLocaleString('id-ID')}
                </td>

                <td class="py-3 px-4">
                  <div class="font-outfit-600 text-white">{log.user_name || 'System Auto'}</div>
                  <div class="text-[10px] text-[#71717A]">{log.user_role || 'SYSTEM'}</div>
                </td>

                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-md font-mono text-[10.5px] bg-[#24242C] text-purple-300 border border-[#33333E]">
                    {log.action}
                  </span>
                </td>

                <td class="py-3 px-4 text-zinc-300">
                  {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                </td>

                <td class="py-3 px-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600
                  {log.status === 'SUCCESS' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'}">
                    {log.status || 'SUCCESS'}
                  </span>
                </td>

                <td class="py-3 px-4 font-mono text-[11px] text-[#71717A]">
                  {log.ip_address || '127.0.0.1'}
                </td>

                <td class="py-3 px-3 text-center">
                  <button
                    type="button"
                    onclick={() => openDetail(log)}
                    class="p-1.5 rounded-lg text-[#FF634A] hover:bg-[#FF634A]/10 transition-colors cursor-pointer"
                    title="Buka payload JSON"
                  >
                    <Eye class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<AuditLogDetailModal
  open={detailModalOpen}
  onClose={() => (detailModalOpen = false)}
  log={selectedLog}
/>
