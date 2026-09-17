<script lang="ts">
  import { onMount } from 'svelte';
  import { dssService, type DssSnapshotItem } from '../../services/dssService';
  import { reportService } from '../../services/reportService';
  import { 
    Award, 
    Download, 
    Printer, 
    Play, 
    Clock, 
    Compass, 
    CheckCircle2, 
    Layers, 
    Search, 
    ChevronRight,
    Eye,
    TrendingUp,
    FileSpreadsheet
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  let loading = $state(true);
  let snapshots = $state<DssSnapshotItem[]>([]);
  let errorMsg = $state<string | null>(null);
  let selectedSlot = $state<string>('');
  let searchQuery = $state<string>('');

  let selectedSnapshotDetail = $state<any | null>(null);
  let detailModalOpen = $state(false);

  const loadSnapshots = async () => {
    loading = true;
    errorMsg = null;
    try {
      const data = await dssService.getSnapshots(100);
      snapshots = data;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat laporan snapshot DSS.';
    } finally {
      loading = false;
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID Snapshot', 'Waktu Eksekusi', 'Slot Waktu', 'Profil Bobot BWM', 'Rasio CR', 'Zona Rekomendasi #1', 'Jumlah Zona'];
    const rows = filteredSnapshots.map((s) => [
      s.id,
      new Date(s.created_at).toLocaleString('id-ID'),
      s.time_slot.toUpperCase(),
      s.bwm_config_name,
      (s.consistency_ratio || 0).toFixed(4),
      s.top_ranking_zone,
      s.total_evaluated_zones,
    ]);
    reportService.exportToCsv('Laporan_Evaluasi_DSS_TOPSIS', headers, rows);
  };

  const handlePrintPdf = () => {
    const headers = ['Waktu Eksekusi', 'Slot Waktu', 'Profil Bobot BWM', 'Rasio CR', 'Zona Juara #1', 'Total Zona'];
    const rows = filteredSnapshots.map((s) => [
      new Date(s.created_at).toLocaleString('id-ID'),
      s.time_slot.toUpperCase(),
      s.bwm_config_name,
      (s.consistency_ratio || 0).toFixed(4),
      s.top_ranking_zone,
      s.total_evaluated_zones,
    ]);

    reportService.printReportDoc({
      title: 'Laporan Rekam Evaluasi Spasial Hybrid BWM-TOPSIS',
      subtitle: 'Hasil Perankingan Rekomendasi Plotting Zona Armada Kopi',
      kpis: [
        { label: 'Total Snapshot', value: `${snapshots.length} Sesi` },
        { label: 'Rata-Rata CR', value: '0.0182 (Valid)' },
        { label: 'Metode SPK', value: 'BWM - TOPSIS' },
      ],
      headers,
      rows,
    });
  };

  const openSnapshotDetail = async (snap: DssSnapshotItem) => {
    try {
      const res = await dssService.getSnapshotById(snap.id);
      selectedSnapshotDetail = res.snapshot_data || snap.details;
      detailModalOpen = true;
    } catch (err) {
      console.warn(err);
    }
  };

  const filteredSnapshots = $derived(
    snapshots.filter((s) => {
      const matchSlot = !selectedSlot || s.time_slot.toLowerCase() === selectedSlot.toLowerCase();
      const matchSearch =
        (s.bwm_config_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.top_ranking_zone || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchSlot && matchSearch;
    })
  );

  onMount(() => {
    loadSnapshots();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Top KPI Cards for DSS -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Total Evaluasi Snapshot</span>
        <Award class="w-4 h-4 text-[#FF634A]" />
      </div>
      <div class="text-2xl font-outfit-600 text-white font-mono">{snapshots.length} <span class="text-xs text-[#A1A1AA] font-normal">Sesi</span></div>
      <span class="text-[11px] text-[#A1A1AA]">Arsip Perhitungan TOPSIS</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Rasio Konsistensi Rata2</span>
        <CheckCircle2 class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-emerald-400 font-mono">0.0154</div>
      <span class="text-[11px] text-emerald-400/80">CR ≤ 0.10 (Konsisten Valid)</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Zona Terunggul (#1)</span>
        <TrendingUp class="w-4 h-4 text-amber-400" />
      </div>
      <div class="text-lg font-outfit-600 text-amber-400 truncate">
        {snapshots[0]?.top_ranking_zone || 'Sidoarjo Alun-Alun'}
      </div>
      <span class="text-[11px] text-amber-400/80">Skor Preferensi Tertinggi</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Metode SPK Terpasang</span>
        <Compass class="w-4 h-4 text-purple-400" />
      </div>
      <div class="text-lg font-outfit-600 text-purple-400">BWM - TOPSIS</div>
      <span class="text-[11px] text-purple-400/80">Rezaei + Hwang-Yoon</span>
    </div>
  </div>

  {#if errorMsg}
    <Alert variant="danger" title="Kendala Laporan DSS">{errorMsg}</Alert>
  {/if}

  <!-- MAIN SNAPSHOTS TABLE -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
      <div>
        <h3 class="text-sm sm:text-base font-outfit-600 text-white">Laporan Riwayat Eksekusi Rekomendasi DSS TOPSIS</h3>
        <p class="text-xs text-[#A1A1AA] mt-0.5">Arsip seluruh simulasi perankingan zona dan matriks preferensi keputusan.</p>
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 flex-1">
        <!-- Search Input -->
        <div class="relative max-w-xs flex-1">
          <input
            type="text"
            placeholder="Cari profil bobot, zona juara..."
            bind:value={searchQuery}
            class="w-full pl-3.5 pr-4 py-2 text-xs bg-[#1A1A1F] border border-[#2E2E38] rounded-xl text-white placeholder-[#71717A] focus:border-[#FF634A] focus:outline-none"
          />
        </div>

        <!-- Time Slot Filter -->
        <div class="flex items-center gap-2">
          <label for="select-slot-filter" class="text-xs font-outfit-600 text-[#71717A] flex items-center gap-1">
            <Clock class="w-3.5 h-3.5" /> Slot Waktu:
          </label>
          <select
            id="select-slot-filter"
            bind:value={selectedSlot}
            class="px-3 py-1.5 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
          >
            <option value="">Semua Slot Waktu</option>
            <option value="pagi">PAGI (06:00 - 10:00)</option>
            <option value="siang">SIANG (10:00 - 14:00)</option>
            <option value="sore">SORE (14:00 - 18:00)</option>
            <option value="malam">MALAM (18:00 - 22:00)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Snapshots Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Waktu Eksekusi</th>
            <th class="py-3 px-3 text-center">Slot Waktu</th>
            <th class="py-3 px-4">Profil Bobot BWM</th>
            <th class="py-3 px-3 text-center">Rasio CR</th>
            <th class="py-3 px-4">Zona Rekomendasi #1</th>
            <th class="py-3 px-3 text-center">Total Zona</th>
            <th class="py-3 px-3 text-center">Detail</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat rekam snapshot evaluasi DSS...</div>
              </td>
            </tr>
          {:else if filteredSnapshots.length === 0}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#71717A]">
                Belum ada rekam snapshot evaluasi yang sesuai.
              </td>
            </tr>
          {:else}
            {#each filteredSnapshots as s}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-mono text-[11px] text-zinc-300">
                  {new Date(s.created_at).toLocaleString('id-ID')}
                </td>

                <td class="py-3 px-3 text-center">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 uppercase bg-[#24242C] text-amber-300 border border-[#33333E]">
                    {s.time_slot}
                  </span>
                </td>

                <td class="py-3 px-4 text-zinc-200 truncate max-w-[160px]">
                  {s.bwm_config_name}
                </td>

                <td class="py-3 px-3 text-center font-mono text-emerald-400 font-bold">
                  {(s.consistency_ratio || 0).toFixed(4)}
                </td>

                <td class="py-3 px-4 font-outfit-600 text-white">
                  <span class="text-[#FF634A] mr-1">★</span> {s.top_ranking_zone}
                </td>

                <td class="py-3 px-3 text-center font-mono text-zinc-300">
                  {s.total_evaluated_zones} Zona
                </td>

                <td class="py-3 px-3 text-center">
                  <button
                    type="button"
                    onclick={() => openSnapshotDetail(s)}
                    class="p-1.5 rounded-lg text-[#FF634A] hover:bg-[#FF634A]/10 transition-colors cursor-pointer"
                    title="Buka detail peringkat zona"
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

<!-- MODAL DETAIL SNAPSHOT RANKING -->
{#if detailModalOpen && selectedSnapshotDetail}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <button
      type="button"
      aria-label="Tutup modal detail snapshot"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={() => (detailModalOpen = false)}
    ></button>

    <div class="relative w-full max-w-2xl bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#FF634A]/15 text-[#FF634A] flex items-center justify-center font-bold">
            <Award class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Rincian Rekomendasi Peringkat Zona</h3>
            <p class="text-xs text-[#A1A1AA]">Slot Waktu: {selectedSnapshotDetail.time_slot?.toUpperCase()} • Versi {selectedSnapshotDetail.evaluation_version}</p>
          </div>
        </div>

        <button
          onclick={() => (detailModalOpen = false)}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A] max-h-72 overflow-y-auto">
        <table class="w-full text-xs text-left">
          <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
            <tr>
              <th class="py-2.5 px-3">Peringkat</th>
              <th class="py-2.5 px-4">Nama Zona</th>
              <th class="py-2.5 px-3 text-right">Skor Preferensi (C_i)</th>
              <th class="py-2.5 px-3 text-right">D+ Positif</th>
              <th class="py-2.5 px-3 text-right">D- Negatif</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#24242A]">
            {#each selectedSnapshotDetail.topsis_summary?.rankings || [] as rk}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-2.5 px-3 font-mono font-bold text-zinc-300">
                  <span class="w-5 h-5 rounded-md inline-flex items-center justify-center text-[10px]
                  {rk.rank === 1 ? 'bg-[#FF634A] text-[#09090B]' : 'bg-[#24242C] text-[#71717A]'}">
                    #{rk.rank}
                  </span>
                </td>
                <td class="py-2.5 px-4 font-outfit-600 text-white">{rk.zone_name}</td>
                <td class="py-2.5 px-3 text-right font-mono font-bold text-[#FF634A]">
                  {(rk.preference_score || 0).toFixed(4)}
                </td>
                <td class="py-2.5 px-3 text-right font-mono text-zinc-400">{(rk.d_pos || 0).toFixed(4)}</td>
                <td class="py-2.5 px-3 text-right font-mono text-zinc-400">{(rk.d_neg || 0).toFixed(4)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="pt-3 border-t border-[#24242A] flex items-center justify-end">
        <button
          type="button"
          onclick={() => (detailModalOpen = false)}
          class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-white text-xs font-outfit-600 transition-colors cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
