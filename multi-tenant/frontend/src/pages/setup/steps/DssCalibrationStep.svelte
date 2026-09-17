<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    BrainCircuit, 
    Sparkles, 
    Info, 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    ArrowLeft, 
    Sliders,
    HelpCircle,
    Check,
    Lock,
    Unlock,
    RotateCcw
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';
  import { dssService, type BwmCalculationResult } from '../../../services/dssService';

  interface Props {
    onNext: () => void;
    onPrev: () => void;
  }

  let { onNext, onPrev }: Props = $props();

  const CRITERIA = [
    {
      id: '1',
      code: 'C1',
      name: 'Densitas POI',
      type: 'BENEFIT',
      desc: 'Semakin banyak titik aktivitas di sekitar area, semakin besar potensi pelanggan.',
      detail: 'Menghitung konsentrasi fasilitas publik, kampus, kantor, dan pusat perbelanjaan di dalam area jangkauan.',
    },
    {
      id: '2',
      code: 'C2',
      name: 'Diversitas POI',
      type: 'BENEFIT',
      desc: 'Menilai variasi jenis aktivitas di sekitar area.',
      detail: 'Kombinasi kategori pengunjung (pelajar, pegawai kantor, warga) menciptakan stabilitas pesanan sepanjang hari.',
    },
    {
      id: '3',
      code: 'C3',
      name: 'Keramaian Berbasis Waktu',
      type: 'BENEFIT',
      desc: 'Menilai potensi keramaian sesuai periode operasional.',
      detail: 'Kepadatan puncak calon konsumen yang bervariasi pada jam pagi, siang, sore, dan malam.',
    },
    {
      id: '4',
      code: 'C4',
      name: 'Kondisi Cuaca',
      type: 'COST',
      desc: 'Menilai risiko cuaca yang dapat menghambat aktivitas penjualan.',
      detail: 'Probabilitas presipitasi hujan tinggi yang berpotensi mengurangi mobilitas pembeli pejalan kaki.',
    },
    {
      id: '5',
      code: 'C5',
      name: 'Jarak ke Hub',
      type: 'COST',
      desc: 'Menilai jarak tempuh dari pusat operasional ke area kandidat.',
      detail: 'Jarak tempuh dari Central Hub ke lokasi tujuan, berpengaruh langsung pada efisiensi baterai/bahan bakar armada.',
    },
    {
      id: '6',
      code: 'C6',
      name: 'Kompetitor',
      type: 'COST',
      desc: 'Menilai keberadaan kompetitor di sekitar area.',
      detail: 'Kepadatan kedai kopi lain dalam radius terdekat yang berpotensi mengurangi pangsa pasar.',
    },
  ];

  const SAATY_DESCRIPTIONS: Record<number, string> = {
    1: '1 - Sama Penting (Equal)',
    2: '2 - Antara Sama & Sedikit Lebih Penting',
    3: '3 - Sedikit Lebih Penting (Moderate)',
    4: '4 - Antara Sedikit & Cukup Penting',
    5: '5 - Cukup Penting (Strong)',
    6: '6 - Antara Cukup & Sangat Penting',
    7: '7 - Sangat Penting (Very Strong)',
    8: '8 - Antara Sangat & Mutlak Penting',
    9: '9 - Mutlak Lebih Penting (Extreme)',
  };

  let activeInfoId = $state<string | null>(null);
  let isCriteriaLocked = $state(false);
  let isCalculating = $state(false);
  let hasCalculated = $state(false);
  let calcError = $state<string | null>(null);
  let calculationResult = $state<BwmCalculationResult | null>(null);

  const toggleInfo = (id: string) => {
    activeInfoId = activeInfoId === id ? null : id;
  };

  const handleBestChange = (newBestId: string) => {
    if (newBestId === setupStore.dss.worstCriteriaId) {
      const alt = CRITERIA.find((c) => c.id !== newBestId);
      if (alt) setupStore.dss.worstCriteriaId = alt.id;
    }
    setupStore.dss.bestCriteriaId = newBestId;
    setupStore.dss.bestToOthers[newBestId] = 1;
    hasCalculated = false;
  };

  const handleWorstChange = (newWorstId: string) => {
    if (newWorstId === setupStore.dss.bestCriteriaId) {
      const alt = CRITERIA.find((c) => c.id !== newWorstId);
      if (alt) setupStore.dss.bestCriteriaId = alt.id;
    }
    setupStore.dss.worstCriteriaId = newWorstId;
    setupStore.dss.othersToWorst[newWorstId] = 1;
    hasCalculated = false;
  };

  // Step 1: Lock Criteria
  const lockCriteria = () => {
    calcError = null;
    if (setupStore.dss.bestCriteriaId === setupStore.dss.worstCriteriaId) {
      calcError = 'Kriteria Terbaik (Best) dan Terburuk (Worst) tidak boleh sama.';
      return;
    }
    isCriteriaLocked = true;
    // Auto-scroll slightly down to Vector Assessment
    setTimeout(() => {
      const el = document.getElementById('bwm-vector-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Unlock Criteria if user wants to change
  const unlockCriteria = () => {
    isCriteriaLocked = false;
    hasCalculated = false;
  };

  const handleSliderChange = (vector: 'best' | 'worst', targetId: string, val: number) => {
    if (vector === 'best') {
      setupStore.dss.bestToOthers = { ...setupStore.dss.bestToOthers, [targetId]: val };
    } else {
      setupStore.dss.othersToWorst = { ...setupStore.dss.othersToWorst, [targetId]: val };
    }
    hasCalculated = false;
  };

  // Step 2: Compute Weights via Real LP Solver
  const runBwmSolver = async () => {
    isCalculating = true;
    calcError = null;

    try {
      const res = await dssService.calculateBwmWeights({
        name: 'Konfigurasi Onboarding MOVA',
        best_criteria_id: setupStore.dss.bestCriteriaId,
        worst_criteria_id: setupStore.dss.worstCriteriaId,
        best_to_others: setupStore.dss.bestToOthers,
        worst_to_others: setupStore.dss.othersToWorst,
      });

      if (res && res.bwm_result) {
        calculationResult = res.bwm_result;
        setupStore.dss.weights = res.bwm_result.weights || {};
        setupStore.dss.cr = res.bwm_result.consistency_ratio;
        setupStore.dss.isConsistent = res.bwm_result.is_consistent;
        setupStore.dss.calibrated = true;
        setupStore.dss.details = res.bwm_result.formatted_details || [];
        hasCalculated = true;

        if (!res.bwm_result.is_consistent) {
          calcError = `Rasio Konsistensi (CR = ${res.bwm_result.consistency_ratio.toFixed(4)}) melebihi ambang batas 0.10. Harap sesuaikan kembali nilai perbandingan agar konsisten.`;
        }

        // Auto-scroll to results
        setTimeout(() => {
          const el = document.getElementById('bwm-results-section');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    } catch (err: any) {
      calcError = err?.response?.data?.msg || err?.message || 'Gagal menghitung bobot BWM.';
    } finally {
      isCalculating = false;
    }
  };

  // Step 3: Final confirmation of weights
  const handleProceed = () => {
    if (!hasCalculated || !setupStore.dss.calibrated) {
      calcError = 'Silakan lakukan perhitungan bobot BWM terlebih dahulu.';
      return;
    }
    if (!setupStore.dss.isConsistent) {
      calcError = 'Rasio konsistensi (CR) melebihi batas 0.10. Mohon sesuaikan nilai perbandingan agar hasil rekomendasi objektif.';
      return;
    }
    onNext();
  };

  const bestObj = $derived(CRITERIA.find((c) => c.id === setupStore.dss.bestCriteriaId) || CRITERIA[0]);
  const worstObj = $derived(CRITERIA.find((c) => c.id === setupStore.dss.worstCriteriaId) || CRITERIA[4]);
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 05</span>
      <span>•</span>
      <span>Model DSS</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Faktor apa yang paling penting bagi rekomendasi operasional Anda?
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      MOVA menggunakan Best-Worst Method (BWM) untuk menentukan tingkat kepentingan kriteria sebelum diolah oleh mesin rekomendasi TOPSIS.
    </p>
  </div>

  {#if calcError}
    <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in duration-200">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{calcError}</span>
    </div>
  {/if}

  <!-- ============================================================ -->
  <!-- BAGIAN A — PENJELASAN 6 KRITERIA UTAMA                       -->
  <!-- ============================================================ -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        1. Kriteria Penilaian Operasional
      </h3>
      <span class="text-[11px] text-zinc-400">Klik ikon info untuk rincian</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each CRITERIA as crit}
        <div class="bg-[#18181D] border border-[#272730] rounded-xl p-3.5 space-y-2 hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-xs font-outfit-700 text-[#FF634A]">{crit.code}</span>
                <span class="text-xs font-outfit-700 text-white truncate">{crit.name}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded font-outfit-600 {crit.type === 'BENEFIT' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}">
                  {crit.type}
                </span>
                <button
                  type="button"
                  onclick={() => toggleInfo(crit.id)}
                  class="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                  title="Lihat penjelasan lengkap"
                >
                  <HelpCircle class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p class="text-[11px] text-zinc-400 mt-1 leading-relaxed">{crit.desc}</p>
          </div>

          {#if activeInfoId === crit.id}
            <div class="mt-2 p-2 bg-[#121214] border border-[#272730] rounded-lg text-[10px] text-zinc-300 leading-relaxed animate-in fade-in duration-150">
              {crit.detail}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- BAGIAN B — PEMILIHAN BEST & WORST CRITERIA                  -->
  <!-- Saat dikonfirmasi: sistem mengunci dan warna jadi pucat       -->
  <!-- ============================================================ -->
  <div class="rounded-2xl border transition-all duration-300 p-4 sm:p-5 space-y-4 {isCriteriaLocked ? 'bg-[#121214]/80 border-[#272730] opacity-60 shadow-none' : 'bg-[#18181D] border-[#272730] shadow-xl'}">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24242A] pb-3">
      <div>
        <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide flex items-center gap-2">
          {#if isCriteriaLocked}
            <Lock class="w-4 h-4 text-emerald-400" />
            <span class="text-zinc-300">2. Kriteria Terbaik & Terburuk (Terkunci)</span>
          {:else}
            <span>2. Pilih Kriteria Terbaik (Best) & Terburuk (Worst)</span>
          {/if}
        </h3>
        <p class="text-[11px] text-zinc-400 mt-0.5">
          {isCriteriaLocked ? 'Kriteria telah dikonfirmasi dan dikunci. Klik tombol "Ubah Kriteria" jika ingin mengganti.' : 'Pilih satu kriteria paling penting dan satu kriteria paling rendah prioritasnya.'}
        </p>
      </div>

      {#if isCriteriaLocked}
        <button
          type="button"
          onclick={unlockCriteria}
          class="px-3 py-1.5 rounded-xl border border-zinc-700 bg-[#18181D] hover:bg-[#24242A] text-zinc-300 text-xs font-outfit-600 transition-all flex items-center gap-1.5 cursor-pointer w-fit"
        >
          <Unlock class="w-3.5 h-3.5 text-amber-400" />
          <span>Ubah Kriteria</span>
        </button>
      {/if}
    </div>

    <!-- Dropdowns Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- Best Criterion Selection -->
      <div class="space-y-1.5 bg-[#121214] border border-[#24242A] p-3.5 rounded-xl">
        <label for="best-criterion" class="block text-xs font-outfit-700 {isCriteriaLocked ? 'text-zinc-400' : 'text-emerald-400'} uppercase tracking-wide flex items-center gap-1.5">
          <span>Kriteria Paling Penting (BEST)</span>
          {#if isCriteriaLocked}
            <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">TERPILIH</span>
          {/if}
        </label>
        <p class="text-[11px] text-zinc-400 pb-1">
          Kriteria yang paling berpengaruh terhadap keputusan operasional.
        </p>
        <select
          id="best-criterion"
          disabled={isCriteriaLocked}
          value={setupStore.dss.bestCriteriaId}
          onchange={(e) => handleBestChange((e.target as HTMLSelectElement).value)}
          class="w-full px-3 py-2 bg-[#18181D] border border-[#272730] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/60 transition-all font-outfit-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {#each CRITERIA as c}
            <option value={c.id} disabled={c.id === setupStore.dss.worstCriteriaId}>
              {c.code} — {c.name} ({c.type})
            </option>
          {/each}
        </select>
      </div>

      <!-- Worst Criterion Selection -->
      <div class="space-y-1.5 bg-[#121214] border border-[#24242A] p-3.5 rounded-xl">
        <label for="worst-criterion" class="block text-xs font-outfit-700 {isCriteriaLocked ? 'text-zinc-400' : 'text-rose-400'} uppercase tracking-wide flex items-center gap-1.5">
          <span>Kriteria Paling Rendah (WORST)</span>
          {#if isCriteriaLocked}
            <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400">TERPILIH</span>
          {/if}
        </label>
        <p class="text-[11px] text-zinc-400 pb-1">
          Kriteria yang pengaruhnya paling rendah dibandingkan kriteria lainnya.
        </p>
        <select
          id="worst-criterion"
          disabled={isCriteriaLocked}
          value={setupStore.dss.worstCriteriaId}
          onchange={(e) => handleWorstChange((e.target as HTMLSelectElement).value)}
          class="w-full px-3 py-2 bg-[#18181D] border border-[#272730] rounded-lg text-xs text-white focus:outline-none focus:border-rose-500/60 transition-all font-outfit-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {#each CRITERIA as c}
            <option value={c.id} disabled={c.id === setupStore.dss.bestCriteriaId}>
              {c.code} — {c.name} ({c.type})
            </option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Confirm Button to lock criteria -->
    {#if !isCriteriaLocked}
      <div class="flex justify-end pt-2">
        <button
          type="button"
          onclick={lockCriteria}
          class="px-5 py-2.5 rounded-xl text-xs font-outfit-700 text-white bg-[#24242A] hover:bg-[#2f2f38] border border-[#3A3A45] hover:border-zinc-500 transition-all flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Lock class="w-3.5 h-3.5 text-[#FF634A]" />
          <span>Konfirmasi Kriteria & Lanjut ke Penilaian Vektor</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- ============================================================ -->
  <!-- BAGIAN C — PENILAIAN VEKTOR PERBANDINGAN                     -->
  <!-- Hanya aktif setelah kriteria dikunci                        -->
  <!-- ============================================================ -->
  {#if isCriteriaLocked}
    <div id="bwm-vector-section" class="space-y-4 bg-[#18181D] border border-[#272730] rounded-2xl p-4 sm:p-5 animate-in fade-in duration-300">
      <div class="border-b border-[#24242A] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide flex items-center gap-2">
            <Sliders class="w-4 h-4 text-[#FF634A]" />
            <span>3. Penilaian Vektor Perbandingan (Pairwise Scale 1–9)</span>
          </h3>
          <p class="text-[11px] text-zinc-400 mt-0.5">
            Tentukan seberapa penting kriteria Best terhadap kriteria lainnya, dan kriteria lainnya terhadap Worst.
          </p>
        </div>
      </div>

      <!-- Vector 1: Best to Others (A_B) -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-outfit-700 text-emerald-400">Vektor Best-to-Others:</span>
          <span class="text-xs text-zinc-300 font-medium">
            Seberapa lebih penting [{bestObj.code} - {bestObj.name}] terhadap:
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each CRITERIA as c}
            {#if c.id !== setupStore.dss.bestCriteriaId}
              {@const val = setupStore.dss.bestToOthers[c.id] || 1}
              <div class="p-3 bg-[#121214] border border-[#24242A] rounded-xl space-y-1.5 hover:border-zinc-700 transition-all">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-zinc-300 font-medium">{c.code} ({c.name})</span>
                  <span class="font-mono text-[#FF634A] font-outfit-700">{val} / 9</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="9"
                  step="1"
                  value={val}
                  oninput={(e) => handleSliderChange('best', c.id, parseInt((e.target as HTMLInputElement).value))}
                  class="w-full accent-[#FF634A] cursor-pointer"
                />
                <p class="text-[10px] text-zinc-400 truncate">{SAATY_DESCRIPTIONS[val]}</p>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Vector 2: Others to Worst (A_W) -->
      <div class="space-y-3 pt-3 border-t border-[#24242A]">
        <div class="flex items-center gap-2">
          <span class="text-xs font-outfit-700 text-rose-400">Vektor Others-to-Worst:</span>
          <span class="text-xs text-zinc-300 font-medium">
            Seberapa lebih penting kriteria lain terhadap [{worstObj.code} - {worstObj.name}]:
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each CRITERIA as c}
            {#if c.id !== setupStore.dss.worstCriteriaId}
              {@const val = setupStore.dss.othersToWorst[c.id] || 1}
              <div class="p-3 bg-[#121214] border border-[#24242A] rounded-xl space-y-1.5 hover:border-zinc-700 transition-all">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-zinc-300 font-medium">{c.code} ({c.name})</span>
                  <span class="font-mono text-[#FF634A] font-outfit-700">{val} / 9</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="9"
                  step="1"
                  value={val}
                  oninput={(e) => handleSliderChange('worst', c.id, parseInt((e.target as HTMLInputElement).value))}
                  class="w-full accent-[#FF634A] cursor-pointer"
                />
                <p class="text-[10px] text-zinc-400 truncate">{SAATY_DESCRIPTIONS[val]}</p>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Trigger Solver Button -->
      <div class="pt-3 flex justify-end">
        <button
          type="button"
          onclick={runBwmSolver}
          disabled={isCalculating}
          class="px-6 py-2.5 rounded-xl text-xs font-outfit-700 text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {#if isCalculating}
            <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Menghitung Solver BWM...</span>
          {:else}
            <BrainCircuit class="w-4 h-4" />
            <span>{hasCalculated ? 'Hitung Ulang Bobot BWM' : 'Hitung Bobot BWM'}</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- ============================================================ -->
  <!-- BAGIAN D — HASIL KALKULASI BOBOT & KONFIRMASI AKHIR          -->
  <!-- ============================================================ -->
  {#if hasCalculated}
    <div id="bwm-results-section" class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-300">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24242A] pb-3">
        <div>
          <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 text-emerald-400" />
            <span>4. Hasil Kalibrasi Bobot & Konsistensi (BWM Output)</span>
          </h3>
          <p class="text-[11px] text-zinc-400">
            Dihitung secara objektif melalui Linear Programming Solver backend.
          </p>
        </div>

        <!-- Consistency Ratio Badge -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-zinc-400">Consistency Ratio:</span>
          <span class="font-mono text-xs font-outfit-700 px-2 py-0.5 rounded-lg {setupStore.dss.isConsistent ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
            CR = {setupStore.dss.cr ? setupStore.dss.cr.toFixed(4) : '0.0000'}
            ({setupStore.dss.isConsistent ? 'KONSISTEN' : 'TIDAK KONSISTEN'})
          </span>
        </div>
      </div>

      <!-- Criteria Weights Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {#each CRITERIA as c, idx}
          {@const detail = setupStore.dss.details?.find((d: any) => d.code === c.code || d.code === `C${idx + 1}` || (d.name && d.name.toLowerCase().includes(c.name.toLowerCase())))}
          {@const weightVal = detail?.weight ?? setupStore.dss.weights[c.code] ?? setupStore.dss.weights[c.id] ?? (calculationResult?.weights?.[c.code] ?? calculationResult?.weights?.[c.id] ?? 0)}
          {@const pct = (detail?.weight_percentage != null ? detail.weight_percentage : (weightVal * 100)).toFixed(1)}
          <div class="p-3 bg-[#121214] border border-[#24242A] rounded-xl space-y-1 text-center">
            <span class="text-[10px] font-mono text-zinc-500">{c.code}</span>
            <p class="text-xs font-outfit-700 text-white truncate">{c.name}</p>
            <p class="text-sm font-outfit-700 font-mono text-[#FF634A]">{pct}%</p>
            <div class="w-full bg-[#272730] h-1.5 rounded-full overflow-hidden mt-1">
              <div class="bg-gradient-to-r from-[#FF634A] to-[#FF8573] h-full transition-all duration-300" style="width: {pct}%"></div>
            </div>
          </div>
        {/each}
      </div>

      {#if setupStore.dss.isConsistent}
        <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
          <Check class="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Model BWM berhasil dikalibrasi secara konsisten (CR ≤ 0.10). Siap digunakan untuk perhitungan TOPSIS.</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Wizard Navigation Actions -->
  <div class="pt-4 flex items-center justify-between gap-3">
    <button
      type="button"
      onclick={onPrev}
      class="px-5 py-2.5 rounded-xl text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Kembali</span>
    </button>
    <button
      type="button"
      onclick={handleProceed}
      disabled={!hasCalculated || !setupStore.dss.isConsistent}
      class="px-6 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-lg shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer"
    >
      <span>Konfirmasi Bobot & Lanjutkan ke Sinkronisasi</span>
      <ArrowRight class="w-4 h-4" />
    </button>
  </div>
</div>
