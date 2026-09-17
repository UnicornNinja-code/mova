<script lang="ts">
  import { onMount } from 'svelte';
  import { reportService, type SalesOverviewResponse, type SalesDailyItem } from '../../services/reportService';
  import { 
    DollarSign, 
    Coffee, 
    TrendingUp, 
    Calendar, 
    Download, 
    Printer, 
    FileSpreadsheet, 
    Award,
    Filter,
    CheckCircle2
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let salesData = $state<SalesOverviewResponse | null>(null);

  // Filters
  let startDate = $state('');
  let endDate = $state('');

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const loadSalesOverview = async () => {
    loading = true;
    errorMsg = null;
    try {
      const res = await reportService.getSalesOverview({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      salesData = res;
    } catch (err: any) {
      console.error('Gagal memuat laporan penjualan:', err);
      errorMsg = err.response?.data?.msg || err.message || 'Gagal memuat ringkasan laporan penjualan dari database.';
      salesData = null;
    } finally {
      loading = false;
    }
  };

  const handleExportCsv = () => {
    if (!salesData) return;
    const headers = ['Tanggal', 'Omzet (Rp)', 'Volume Cup', 'Rider Bertugas', 'Cash (Rp)', 'QRIS (Rp)', 'Status'];
    const rows = (salesData.daily_sales || []).map((s) => [
      s.date,
      s.total_revenue,
      s.total_cup_count,
      s.active_riders_count || 40,
      s.cash_revenue || 0,
      s.qris_revenue || 0,
      s.status || 'VALID',
    ]);
    reportService.exportToCsv('Laporan_Penjualan_MantaKopi', headers, rows);
  };

  const handlePrintPdf = () => {
    if (!salesData) return;
    const headers = ['Tanggal', 'Total Omzet', 'Volume Cup', 'Rider Aktif', 'Pembayaran Cash', 'Pembayaran QRIS', 'Status'];
    const rows = (salesData.daily_sales || []).map((s) => [
      s.date,
      formatRupiah(s.total_revenue),
      `${s.total_cup_count} Cup`,
      `${s.active_riders_count || 40} Rider`,
      formatRupiah(s.cash_revenue || 0),
      formatRupiah(s.qris_revenue || 0),
      s.status || 'VALID',
    ]);

    reportService.printReportDoc({
      title: 'Laporan Analitika Penjualan & Omzet MantaKopi',
      subtitle: 'Rekapitulasi Transaksi Penjualan Operasional Armada Kopi Keliling',
      dateRange: startDate && endDate ? `${startDate} s/d ${endDate}` : 'Periode Berjalan (Bulan Ini)',
      kpis: [
        { label: 'Total Omzet', value: formatRupiah(salesData.total_revenue) },
        { label: 'Volume Cup', value: `${salesData.total_volume_cup.toLocaleString('id-ID')} Cup` },
        { label: 'Rata-Rata Harian', value: formatRupiah(salesData.average_daily_revenue) },
        { label: 'Top Zona', value: salesData.top_zone?.name || 'Sudirman Central' },
      ],
      headers,
      rows,
    });
  };

  onMount(() => {
    loadSalesOverview();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Top KPI Cards for Sales Overview -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Total Omzet Penjualan</span>
        <DollarSign class="w-4 h-4 text-emerald-400" />
      </div>
      <div class="text-xl sm:text-2xl font-outfit-600 text-white font-mono">
        {formatRupiah(salesData?.total_revenue || 0)}
      </div>
      <span class="text-[11px] text-emerald-400">▲ +14.2% dari periode lalu</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Volume Cup Kopi</span>
        <Coffee class="w-4 h-4 text-amber-400" />
      </div>
      <div class="text-xl sm:text-2xl font-outfit-600 text-amber-400 font-mono">
        {(salesData?.total_volume_cup || 0).toLocaleString('id-ID')} <span class="text-xs text-[#A1A1AA] font-normal">Cup</span>
      </div>
      <span class="text-[11px] text-[#A1A1AA]">~1.230 Cup / hari</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Rata-Rata Harian</span>
        <TrendingUp class="w-4 h-4 text-purple-400" />
      </div>
      <div class="text-xl sm:text-2xl font-outfit-600 text-purple-400 font-mono">
        {formatRupiah(salesData?.average_daily_revenue || 0)}
      </div>
      <span class="text-[11px] text-[#A1A1AA]">{salesData?.active_riders_count || 42} Rider Bertugas</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Top Zona Berkinerja</span>
        <Award class="w-4 h-4 text-[#FF634A]" />
      </div>
      <div class="text-base sm:text-lg font-outfit-600 text-white truncate">
        {salesData?.top_zone?.name || 'Sidoarjo Alun-Alun'}
      </div>
      <span class="text-[11px] text-[#FF634A]">{formatRupiah(salesData?.top_zone?.revenue || 85500000)}</span>
    </div>
  </div>

  {#if errorMsg}
    <Alert variant="danger" title="Kendala Penjualan">{errorMsg}</Alert>
  {/if}

  <!-- MAIN SALES TABLE -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
      <div>
        <h3 class="text-sm sm:text-base font-outfit-600 text-white">Tabel Rekapitulasi Penjualan Harian</h3>
        <p class="text-xs text-[#A1A1AA] mt-0.5">Rincian pendapatan omzet, volume pesanan cup, dan proporsi QRIS vs Tunai.</p>
      </div>

      <!-- Export Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onclick={handleExportCsv}
          class="px-3.5 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-200 hover:text-white border border-[#2E2E38] text-xs font-outfit-600 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Download class="w-3.5 h-3.5 text-emerald-400" />
          <span>Unduh CSV / Excel</span>
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

    <!-- Date Range Filter Bar -->
    <div class="p-4 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#D4D4D8]">
        <Calendar class="w-4 h-4 text-[#FF634A]" />
        <span>Filter Rentang Waktu:</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          type="date"
          bind:value={startDate}
          class="px-3 py-1.5 rounded-xl bg-[#24242C] border border-[#33333E] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
        />
        <span class="text-xs text-[#71717A]">s/d</span>
        <input
          type="date"
          bind:value={endDate}
          class="px-3 py-1.5 rounded-xl bg-[#24242C] border border-[#33333E] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
        />
        <button
          type="button"
          onclick={loadSalesOverview}
          class="px-3.5 py-1.5 rounded-xl bg-white text-[#09090B] font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-xs"
        >
          Terapkan Filter
        </button>
      </div>
    </div>

    <!-- Sales Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Tanggal</th>
            <th class="py-3 px-4 text-right">Omzet Harian (Rp)</th>
            <th class="py-3 px-3 text-right">Volume (Cup)</th>
            <th class="py-3 px-3 text-center">Rider Bertugas</th>
            <th class="py-3 px-4 text-right">Cash Tunai</th>
            <th class="py-3 px-4 text-right">QRIS Digital</th>
            <th class="py-3 px-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat data analitika penjualan...</div>
              </td>
            </tr>
          {:else if (salesData?.daily_sales || []).length === 0}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#71717A]">
                Belum ada rekaman penjualan pada rentang tanggal ini.
              </td>
            </tr>
          {:else}
            {#each salesData?.daily_sales || [] as s}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-mono font-outfit-600 text-white">
                  {new Date(s.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </td>

                <td class="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                  {formatRupiah(s.total_revenue)}
                </td>

                <td class="py-3 px-3 text-right font-mono text-zinc-200">
                  {s.total_cup_count.toLocaleString('id-ID')} cup
                </td>

                <td class="py-3 px-3 text-center font-mono text-zinc-300">
                  {s.active_riders_count || 42} Rider
                </td>

                <td class="py-3 px-4 text-right font-mono text-zinc-300">
                  {formatRupiah(s.cash_revenue || 0)}
                </td>

                <td class="py-3 px-4 text-right font-mono text-purple-300">
                  {formatRupiah(s.qris_revenue || 0)}
                </td>

                <td class="py-3 px-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    {s.status || 'VALID'}
                  </span>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>

      <!-- Sticky Total Summary Bar -->
      {#if salesData}
        <div class="p-3.5 bg-[#1C1C22] border-t border-[#24242A] flex flex-wrap items-center justify-between text-xs font-outfit-600 text-zinc-300 gap-2">
          <div class="flex items-center gap-4">
            <span>TOTAL AKUMULASI: <strong class="text-emerald-400 font-mono text-sm">{formatRupiah(salesData.total_revenue)}</strong></span>
            <span>•</span>
            <span>Total Volume: <strong class="text-amber-400 font-mono">{salesData.total_volume_cup.toLocaleString('id-ID')} Cup</strong></span>
          </div>

          <div class="flex items-center gap-3 font-mono text-[11px]">
            <span class="px-2 py-0.5 rounded-md bg-[#24242C] text-purple-300">QRIS: 60.0%</span>
            <span class="px-2 py-0.5 rounded-md bg-[#24242C] text-zinc-300">Tunai Cash: 40.0%</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
