<script lang="ts">
  import type { SalesTrendItem } from '../../services/dashboardService';

  interface Props {
    trendData: SalesTrendItem[];
    range: string;
    startDate?: string;
    endDate?: string;
    onRangeChange: (range: string, customStart?: string, customEnd?: string) => void;
    loading?: boolean;
  }

  let {
    trendData = [],
    range = '7d',
    startDate = '',
    endDate = '',
    onRangeChange,
    loading = false
  }: Props = $props();

  let showCustomPicker = $state(false);
  let customStartDate = $state('');
  let customEndDate = $state('');
  let dateRangeError = $state<string | null>(null);

  // Active Hover Inspector State
  let hoveredItem = $state<SalesTrendItem | null>(null);

  $effect(() => {
    if (startDate) customStartDate = startDate;
    if (endDate) customEndDate = endDate;
  });

  const formatRupiahShort = (num: number) => {
    if (num >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toFixed(1)}J`;
    }
    if (num >= 1_000) {
      return `Rp ${(num / 1_000).toFixed(0)}k`;
    }
    return `Rp ${num}`;
  };

  const formatIndoDateFull = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Dynamic month evaluation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentMonthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(now);

  const isLongRange = $derived(range === '30d' || range === 'this_month' || trendData.length > 10);

  const formatAxisLabel = (dateStr: string, isLong: boolean, index: number, total: number) => {
    try {
      const d = new Date(dateStr);
      if (!isLong) {
        return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
      }
      const dayNum = String(d.getDate()).padStart(2, '0');
      if (total > 15) {
        if (index === 0 || index === total - 1 || index % 5 === 0) {
          return dayNum;
        }
        return '';
      }
      return dayNum;
    } catch {
      return dateStr;
    }
  };

  let maxRevenue = $derived(
    trendData.length > 0 ? Math.max(...trendData.map(d => d.total_revenue || 0), 100000) : 100000
  );

  let totalPeriodRevenue = $derived(
    trendData.reduce((sum, d) => sum + (d.total_revenue || 0), 0)
  );

  let totalPeriodCups = $derived(
    trendData.reduce((sum, d) => sum + (d.total_units_sold ?? d.total_units ?? 0), 0)
  );

  let totalPeriodTrx = $derived(
    trendData.reduce((sum, d) => sum + (d.total_transactions || 0), 0)
  );

  const handleQuickFilter = (val: string) => {
    showCustomPicker = false;
    dateRangeError = null;
    onRangeChange(val);
  };

  const validateCustomDates = () => {
    if (!customStartDate || !customEndDate) {
      dateRangeError = 'Pilih tanggal mulai dan tanggal akhir.';
      return false;
    }

    const start = new Date(`${customStartDate}T00:00:00+07:00`);
    const end = new Date(`${customEndDate}T00:00:00+07:00`);

    if (start > end) {
      dateRangeError = 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir.';
      return false;
    }

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 31) {
      dateRangeError = `Rentang ${diffDays} hari melebihi batas maksimal 1 bulan (31 hari).`;
      return false;
    }

    dateRangeError = null;
    return true;
  };

  const handleApplyCustom = (e: Event) => {
    e.preventDefault();
    if (validateCustomDates()) {
      showCustomPicker = false;
      onRangeChange('custom', customStartDate, customEndDate);
    }
  };

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    customStartDate = start.toISOString().split('T')[0];
    customEndDate = end.toISOString().split('T')[0];
    validateCustomDates();
  };

  const setMonthPreset = () => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
    customStartDate = firstDay;
    customEndDate = lastDay;
    validateCustomDates();
  };
</script>

<div class="card-dark p-4 sm:p-5 flex flex-col justify-between relative min-h-[390px] lg:min-h-[430px] font-outfit-400">
  <!-- Header: Title, Metric Badge & Filter Toolbar -->
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#24242A]">
    <div>
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-title-18 font-outfit-600 text-white leading-tight">Tren Penjualan & Omzet</h3>
        {#if trendData.length > 0}
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 font-outfit-600 text-[11px] border border-emerald-800/40">
            Total: Rp {totalPeriodRevenue.toLocaleString('id-ID')}
          </span>
        {/if}
      </div>
      <p class="text-body-14 text-xs text-[#A1A1AA] mt-0.5">
        Akumulasi {totalPeriodCups.toLocaleString('id-ID')} cup ({totalPeriodTrx.toLocaleString('id-ID')} trx) dalam {trendData.length} hari
      </p>
    </div>

    <!-- Filter Buttons Toolbar (Using Split Pills from Screenshot) -->
    <div class="flex flex-wrap items-center gap-1.5 self-start lg:self-auto">
      <div class="inline-flex rounded-full bg-[#18181D] p-1 border border-[#27272E]">
        {#each [
          { label: 'Hari Ini', value: 'today' },
          { label: 'Seminggu', value: '7d' },
          { label: 'Bulan Ini', value: 'this_month' },
        ] as opt}
          <button
            onclick={() => handleQuickFilter(opt.value)}
            class="px-3 py-1 text-xs font-outfit-600 rounded-full transition-all cursor-pointer
            {range === opt.value 
              ? 'bg-white text-[#09090B] shadow-md font-extrabold' 
              : 'text-[#A1A1AA] hover:text-white'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <!-- Atur Periode (Pill Button with Dropdown Chevron) -->
      <div class="relative">
        <button
          onclick={() => showCustomPicker = !showCustomPicker}
          class="pill-btn-white text-xs font-outfit-600"
        >
          <span class="px-3.5 py-1.5 flex items-center gap-1.5">
            <i class="bx bx-calendar text-sm"></i>
            <span>{range === 'custom' && startDate ? `${startDate.slice(5)} s/d ${endDate.slice(5)}` : 'Atur Periode'}</span>
          </span>
          <span class="pill-divider"></span>
          <span class="px-2 py-1.5 flex items-center">
            <i class="bx bx-chevron-down text-sm"></i>
          </span>
        </button>

        <!-- Custom Date Range Dropdown Popover with Dark Styling -->
        {#if showCustomPicker}
          <div class="absolute right-0 top-full mt-2 w-80 bg-[#151519] rounded-3xl border border-[#2E2E38] shadow-2xl p-4 z-40 space-y-3">
            <div class="text-xs font-outfit-600 text-white flex items-center justify-between pb-2 border-b border-[#24242A]">
              <span class="flex items-center gap-1.5">
                <i class="bx bx-calendar text-[#FF634A]"></i>
                Atur Periode (Maks. 1 Bulan)
              </span>
              <button 
                type="button"
                onclick={() => showCustomPicker = false} 
                class="text-[#71717A] hover:text-white text-xs cursor-pointer"
                aria-label="Tutup"
              >
                <i class="bx bx-x text-lg"></i>
              </button>
            </div>

            <!-- Quick Presets -->
            <div class="space-y-1">
              <div class="text-[10px] font-outfit-600 text-[#71717A] uppercase tracking-wider">Preset Cepat:</div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  onclick={() => setPresetRange(7)}
                  class="px-2.5 py-1 text-[11px] font-outfit-600 bg-[#1F1F24] hover:bg-white hover:text-[#09090B] rounded-full text-[#A1A1AA] cursor-pointer transition-all border border-[#2C2C34]"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onclick={() => setPresetRange(14)}
                  class="px-2.5 py-1 text-[11px] font-outfit-600 bg-[#1F1F24] hover:bg-white hover:text-[#09090B] rounded-full text-[#A1A1AA] cursor-pointer transition-all border border-[#2C2C34]"
                >
                  14 Hari
                </button>
                <button
                  type="button"
                  onclick={setMonthPreset}
                  class="px-2.5 py-1 text-[11px] font-outfit-600 bg-[#FF634A]/10 border border-[#FF634A]/30 text-[#FF634A] rounded-full hover:bg-[#FF634A] hover:text-white cursor-pointer transition-all"
                >
                  Bulan Ini ({currentMonthName})
                </button>
              </div>
            </div>

            <!-- Custom Form Inputs -->
            <form onsubmit={handleApplyCustom} class="space-y-2.5 pt-1">
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label for="start-date-input" class="block text-[10px] font-outfit-600 text-[#A1A1AA]">Mulai Dari</label>
                  <input
                    id="start-date-input"
                    type="date"
                    bind:value={customStartDate}
                    onchange={validateCustomDates}
                    required
                    class="w-full px-2.5 py-1.5 text-xs bg-[#1F1F26] border border-[#2E2E38] rounded-xl focus:outline-none focus:border-[#FF634A] text-white font-outfit-400"
                  />
                </div>

                <div class="space-y-1">
                  <label for="end-date-input" class="block text-[10px] font-outfit-600 text-[#A1A1AA]">Sampai Dengan</label>
                  <input
                    id="end-date-input"
                    type="date"
                    bind:value={customEndDate}
                    onchange={validateCustomDates}
                    required
                    class="w-full px-2.5 py-1.5 text-xs bg-[#1F1F26] border border-[#2E2E38] rounded-xl focus:outline-none focus:border-[#FF634A] text-white font-outfit-400"
                  />
                </div>
              </div>

              {#if dateRangeError}
                <div class="p-2 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px] flex items-start gap-1.5 font-outfit-400">
                  <i class="bx bx-error-circle text-rose-400 text-sm shrink-0 mt-0.5"></i>
                  <span>{dateRangeError}</span>
                </div>
              {/if}

              <div class="pt-2 border-t border-[#24242A] flex items-center justify-between">
                <span class="text-[10px] text-[#71717A]">Maks. 31 hari</span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    onclick={() => showCustomPicker = false}
                    class="px-3 py-1 text-xs text-[#A1A1AA] hover:text-white cursor-pointer font-outfit-600"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    class="pill-btn-orange text-xs"
                  >
                    <span class="px-3 py-1 font-outfit-600 text-white">Terapkan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- INTERACTIVE HOVER DETAIL INSPECTOR HUD -->
  <div class="mt-2 min-h-[44px] px-3.5 py-2 rounded-2xl border transition-all duration-200 flex flex-wrap items-center justify-between gap-2 text-xs
    {hoveredItem 
      ? 'bg-[#1D1D23] border-[#383844] text-white shadow-xl' 
      : 'bg-[#16161B] border-[#222228] text-[#71717A]'}"
  >
    {#if hoveredItem}
      {@const aov = hoveredItem.total_transactions > 0 ? Math.round((hoveredItem.total_revenue || 0) / hoveredItem.total_transactions) : 0}
      <div class="flex items-center gap-2">
        <span class="font-outfit-600 text-[#FF8573] flex items-center gap-1 text-xs">
          <i class="bx bx-calendar"></i>
          {formatIndoDateFull(hoveredItem.date)}:
        </span>
        <span class="font-outfit-600 text-emerald-400 text-sm">
          Rp {(hoveredItem.total_revenue || 0).toLocaleString('id-ID')}
        </span>
      </div>

      <div class="flex items-center gap-3 text-[11px] text-zinc-300 font-outfit-400">
        <span>Volume: <strong class="text-white font-outfit-600">{hoveredItem.total_units_sold ?? hoveredItem.total_units ?? 0} Cup</strong></span>
        <span class="text-zinc-600">|</span>
        <span>Pesanan: <strong class="text-white font-outfit-600">{hoveredItem.total_transactions || 0} Trx</strong></span>
        {#if aov > 0}
          <span class="text-zinc-600">|</span>
          <span>AOV: <strong class="text-amber-400 font-outfit-600">Rp {aov.toLocaleString('id-ID')}</strong></span>
        {/if}
      </div>
    {:else}
      <div class="flex items-center gap-1.5 text-[11px] text-[#A1A1AA] font-outfit-400">
        <i class="bx bxs-hot text-[#FF634A]"></i>
        <span>Arahkan kursor ke batang grafik untuk melihat rincian detail omzet, volume cup, dan AOV harian.</span>
      </div>
      <div class="text-[11px] font-outfit-600 text-white hidden sm:block">
        Puncak: {formatRupiahShort(maxRevenue)} / hari
      </div>
    {/if}
  </div>

  <!-- EXPANDED TALL CHART VIEWPORT -->
  <div class="mt-3 flex-1 h-64 sm:h-72 lg:h-80 flex flex-col justify-between relative">
    {#if loading}
      <div class="h-full flex items-center justify-center animate-pulse text-xs text-[#71717A]">
        Memuat grafik tren penjualan real...
      </div>
    {:else if trendData.length === 0}
      <div class="h-full flex flex-col items-center justify-center text-xs text-[#71717A] gap-1">
        <span>Belum ada data transaksi penjualan pada rentang tanggal ini.</span>
      </div>
    {:else}
      <!-- Background Horizontal Gridlines -->
      <div class="absolute inset-x-0 top-2 bottom-8 pointer-events-none flex flex-col justify-between opacity-30">
        <div class="border-b border-dashed border-[#3A3A45] w-full flex justify-end pr-2 text-[9px] text-[#A1A1AA] font-outfit-600">{formatRupiahShort(maxRevenue)}</div>
        <div class="border-b border-dashed border-[#2C2C36] w-full flex justify-end pr-2 text-[9px] text-[#71717A] font-outfit-600">{formatRupiahShort(maxRevenue * 0.75)}</div>
        <div class="border-b border-dashed border-[#2C2C36] w-full flex justify-end pr-2 text-[9px] text-[#71717A] font-outfit-600">{formatRupiahShort(maxRevenue * 0.5)}</div>
        <div class="border-b border-dashed border-[#2C2C36] w-full flex justify-end pr-2 text-[9px] text-[#71717A] font-outfit-600">{formatRupiahShort(maxRevenue * 0.25)}</div>
        <div class="border-b border-[#24242A] w-full"></div>
      </div>

      <!-- Bar & Distribution Container -->
      <div class="h-56 sm:h-64 lg:h-72 w-full flex items-end {trendData.length === 1 ? 'justify-center' : 'justify-between'} gap-1 sm:gap-2 px-1 z-10">
        {#each trendData as item, idx}
          {@const isHovered = hoveredItem?.date === item.date}
          {@const heightPercent = Math.min(Math.max(((item.total_revenue || 0) / maxRevenue) * 100, 6), 100)}
          {@const label = range === 'today' ? 'Hari Ini' : formatAxisLabel(item.date, isLongRange, idx, trendData.length)}
          <div
            role="presentation"
            class="{trendData.length === 1 ? 'w-28' : 'flex-1 min-w-[8px]'} h-full flex flex-col justify-end items-center gap-1.5 cursor-pointer group"
            onmouseenter={() => hoveredItem = item}
            onmouseleave={() => hoveredItem = null}
          >
            <!-- Dedicated Bar Track Area -->
            <div class="w-full flex-1 flex items-end justify-center relative pb-0.5">
              <div 
                class="w-full {trendData.length === 1 ? 'max-w-[48px]' : isLongRange ? 'max-w-[16px]' : 'max-w-[36px]'} rounded-t-md sm:rounded-t-lg transition-all duration-300
                {isHovered 
                  ? 'bg-gradient-to-t from-[#FF634A] to-[#FFB2A6] ring-2 ring-[#FF634A] shadow-[0_0_15px_rgba(255,99,74,0.6)] brightness-125' 
                  : 'bg-gradient-to-t from-[#FF634A] to-[#FF8573] hover:brightness-110'}"
                style="height: {heightPercent}%; min-height: 10px;"
              ></div>
            </div>

            <!-- X Axis Label -->
            <span class="text-[9px] sm:text-[10px] font-outfit-600 truncate h-4 shrink-0 flex items-center transition-colors
              {isHovered ? 'text-[#FF634A] font-extrabold scale-110' : 'text-[#71717A] group-hover:text-white'}"
            >
              {label}
            </span>
          </div>
        {/each}
      </div>

      <!-- Footer Summary Indicator -->
      <div class="pt-2 border-t border-[#24242A] flex items-center justify-between text-[11px] text-[#A1A1AA] font-outfit-400 z-10">
        <span>Puncak: <strong class="text-white font-outfit-600">{formatRupiahShort(maxRevenue)}</strong> / hari</span>
        <span class="text-emerald-400 font-outfit-600 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          PostgreSQL Connected ({trendData.length} Hari)
        </span>
      </div>
    {/if}
  </div>
</div>
