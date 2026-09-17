<script lang="ts">
  import { onMount } from 'svelte';
  import { reportService, type DssConfigItem } from '../../services/reportService';
  import { 
    Compass, 
    Download, 
    Printer, 
    CheckCircle2, 
    Clock, 
    Layers, 
    Sliders, 
    Sparkles,
    FileText,
    History
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  let loading = $state(true);
  let configs = $state<DssConfigItem[]>([]);
  let errorMsg = $state<string | null>(null);

  const CRITERIA_NAMES: Record<string, string> = {
    '1': 'C1 - Densitas POI',
    '2': 'C2 - Diversitas POI',
    '3': 'C3 - Keramaian Waktu',
    '4': 'C4 - Kondisi Cuaca',
    '5': 'C5 - Jarak Aksesibilitas',
    '6': 'C6 - Indeks Kompetitor',
  };

  const loadConfigs = async () => {
    loading = true;
    errorMsg = null;
    try {
      const data = await reportService.getDssConfigs();
      configs = data;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat arsip konfigurasi bobot BWM.';
    } finally {
      loading = false;
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID Konfigurasi', 'Nama Profil', 'Status', 'Kriteria Terbaik (C_B)', 'Kriteria Terburuk (C_W)', 'Tanggal Dibuat'];
    const rows = configs.map((c) => [
      c.id,
      c.name,
      c.is_active ? 'AKTIF' : 'NONAKTIF/ARSIP',
      CRITERIA_NAMES[String(c.best_criteria_id)] || `ID ${c.best_criteria_id}`,
      CRITERIA_NAMES[String(c.worst_criteria_id)] || `ID ${c.worst_criteria_id}`,
      new Date(c.created_at).toLocaleString('id-ID'),
    ]);
    reportService.exportToCsv('Laporan_Konfigurasi_Bobot_BWM', headers, rows);
  };

  const handlePrintPdf = () => {
    const headers = ['Nama Profil Kalibrasi', 'Status', 'Kriteria Terbaik (C_B)', 'Kriteria Terburuk (C_W)', 'Waktu Ditetapkan'];
    const rows = configs.map((c) => [
      c.name,
      c.is_active ? 'RESMI AKTIF' : 'ARSIP HISTORIS',
      CRITERIA_NAMES[String(c.best_criteria_id)] || `C${c.best_criteria_id}`,
      CRITERIA_NAMES[String(c.worst_criteria_id)] || `C${c.worst_criteria_id}`,
      new Date(c.created_at).toLocaleString('id-ID'),
    ]);

    reportService.printReportDoc({
      title: 'Laporan Riwayat Konfigurasi & Kalibrasi Bobot BWM',
      subtitle: 'Arsip Preferensi Best-Worst Method (Rezaei 2016) untuk Mesin Rekomendasi TOPSIS',
      kpis: [
        { label: 'Total Versi Konfigurasi', value: `${configs.length} Versi` },
        { label: 'Status Mesin', value: '1 Aktif Beroperasi' },
        { label: 'Kriteria Aktif', value: '6 Kriteria SPK' },
      ],
      headers,
      rows,
    });
  };

  onMount(() => {
    loadConfigs();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Top KPI Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Total Riwayat Bobot</span>
        <History class="w-4 h-4 text-purple-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-white font-mono">{configs.length} <span class="text-xs text-[#A1A1AA] font-normal">Profil</span></div>
      <span class="text-[11px] text-[#A1A1AA]">Arsip Kalibrasi BWM</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Konfigurasi Resmi</span>
        <CheckCircle2 class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-emerald-400 font-mono">1 Profil</div>
      <span class="text-[11px] text-emerald-400/80">Aktif Digunakan Pipeline</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Jumlah Kriteria</span>
        <Sliders class="w-4 h-4 text-[#FF634A]" />
      </div>
      <div class="text-2xl font-outfit-600 text-[#FF634A] font-mono">6 Kriteria</div>
      <span class="text-[11px] text-[#FF634A]/80">C1 s/d C6 Spasial</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Batas Konsistensi</span>
        <Compass class="w-4 h-4 text-amber-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-amber-400 font-mono">CR ≤ 0.10</div>
      <span class="text-[11px] text-amber-400/80">Ambang Batas Rezaei</span>
    </div>
  </div>

  {#if errorMsg}
    <Alert variant="danger" title="Kendala Konfigurasi BWM">{errorMsg}</Alert>
  {/if}

  <!-- MAIN CONFIGS TABLE -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
      <div>
        <h3 class="text-sm sm:text-base font-outfit-600 text-white">Laporan Arsip & Konfigurasi Bobot BWM</h3>
        <p class="text-xs text-[#A1A1AA] mt-0.5">Catatan seluruh penetapan skala Saaty dan bobot kriteria resmi.</p>
      </div>

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

    <!-- Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Nama Profil Kalibrasi</th>
            <th class="py-3 px-3 text-center">Status</th>
            <th class="py-3 px-4">Kriteria Terbaik (C_B)</th>
            <th class="py-3 px-4">Kriteria Terburuk (C_W)</th>
            <th class="py-3 px-4">Waktu Penetapan</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="5" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat data konfigurasi BWM...</div>
              </td>
            </tr>
          {:else if configs.length === 0}
            <tr>
              <td colspan="5" class="py-8 text-center text-xs text-[#71717A]">
                Belum ada konfigurasi BWM yang tersimpan.
              </td>
            </tr>
          {:else}
            {#each configs as cfg}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-outfit-600 text-white flex items-center gap-2">
                  <Compass class="w-4 h-4 text-[#FF634A]" />
                  <span>{cfg.name}</span>
                </td>

                <td class="py-3 px-3 text-center">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600
                  {cfg.is_active ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-zinc-800 text-zinc-400'}">
                    {cfg.is_active ? 'AKTIF RESMI' : 'ARSIP'}
                  </span>
                </td>

                <td class="py-3 px-4 text-purple-300 font-mono">
                  {CRITERIA_NAMES[String(cfg.best_criteria_id)] || `ID #${cfg.best_criteria_id}`}
                </td>

                <td class="py-3 px-4 text-blue-300 font-mono">
                  {CRITERIA_NAMES[String(cfg.worst_criteria_id)] || `ID #${cfg.worst_criteria_id}`}
                </td>

                <td class="py-3 px-4 font-mono text-[11px] text-zinc-300">
                  {new Date(cfg.created_at).toLocaleString('id-ID')}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
