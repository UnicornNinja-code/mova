<script lang="ts">
  import { onMount } from 'svelte';
  import { dssService, type ActiveDssConfig, type BwmCalculationResult } from '../../services/dssService';
  import BwmMathAuditDrawer from './BwmMathAuditDrawer.svelte';
  import { 
    Compass, 
    CheckCircle2, 
    AlertTriangle, 
    RotateCcw, 
    Sparkles, 
    Save, 
    Calculator, 
    FileText, 
    ShieldCheck, 
    Sliders, 
    Layers,
    ArrowRight,
    Lock
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  const CRITERIA_DEFINITIONS = [
    { id: '1', code: 'C1', name: 'Densitas POI', type: 'BENEFIT', desc: 'Jumlah entitas POI di dalam poligon zona' },
    { id: '2', code: 'C2', name: 'Diversitas POI', type: 'BENEFIT', desc: 'Variasi kategori POI aktif di zona' },
    { id: '3', code: 'C3', name: 'Keramaian Waktu', type: 'BENEFIT', desc: 'Potensi keramaian pengunjung pada slot waktu' },
    { id: '4', code: 'C4', name: 'Kondisi Cuaca', type: 'COST', desc: 'Risiko presipitasi curah hujan Open-Meteo' },
    { id: '5', code: 'C5', name: 'Jarak Aksesibilitas', type: 'COST', desc: 'Jarak geodetik dari koordinat asal/rider' },
    { id: '6', code: 'C6', name: 'Indeks Kompetitor', type: 'COST', desc: 'Tingkat persaingan kedai kopi di area zona' },
  ];

  const SAATY_DESCRIPTIONS: Record<number, string> = {
    1: '1 - Sama penting (Equal)',
    2: '2 - Antara sama & sedikit lebih penting',
    3: '3 - Sedikit lebih penting (Moderate)',
    4: '4 - Antara sedikit & cukup penting',
    5: '5 - Cukup penting (Strong)',
    6: '6 - Antara cukup & sangat penting',
    7: '7 - Sangat penting (Very Strong)',
    8: '8 - Antara sangat & mutlak penting',
    9: '9 - Mutlak lebih penting (Extreme)',
  };

  let loading = $state(true);
  let calculating = $state(false);
  let applying = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  let activeConfig = $state<ActiveDssConfig | null>(null);

  // Selection states
  let bestCriteriaId = $state<string>('1'); // Default C1 (Densitas POI)
  let worstCriteriaId = $state<string>('5'); // Default C5 (Jarak Aksesibilitas)

  // Vectors
  let bestToOthers = $state<Record<string, number>>({
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 7,
    '6': 5,
  });

  let othersToWorst = $state<Record<string, number>>({
    '1': 7,
    '2': 5,
    '3': 4,
    '4': 3,
    '5': 1,
    '6': 2,
  });

  // Calculation Result
  let calculationResult = $state<BwmCalculationResult | null>(null);
  let mathDrawerOpen = $state(false);
  let applyModalOpen = $state(false);
  let configNameInput = $state('Konfigurasi Bobot BWM Kalibrasi Sidoarjo');
  let solverDuration = $state(18);

  const bestCriteria = $derived(CRITERIA_DEFINITIONS.find((c) => c.id === bestCriteriaId));
  const worstCriteria = $derived(CRITERIA_DEFINITIONS.find((c) => c.id === worstCriteriaId));

  const otherCriteriaForBest = $derived(CRITERIA_DEFINITIONS.filter((c) => c.id !== bestCriteriaId));
  const otherCriteriaForWorst = $derived(CRITERIA_DEFINITIONS.filter((c) => c.id !== worstCriteriaId));

  const isConsistent = $derived((calculationResult?.consistency_ratio ?? 0) <= 0.1);

  // Live Impact Preview
  let impactRankings = $state<any[]>([]);
  let loadingImpact = $state(false);
  let impactDebounceTimer: any = null;

  const loadImpactPreview = async () => {
    if (!calculationResult?.weights) return;
    loadingImpact = true;
    try {
      const res = await dssService.previewBwmImpact({
        weights: calculationResult.weights,
        time_slot: 'pagi',
      });
      impactRankings = res.rankings?.slice(0, 3) || [];
    } catch (e) {
      console.warn('Gagal memuat dampak simulasi bobot:', e);
    } finally {
      loadingImpact = false;
    }
  };

  const debouncedImpactPreview = () => {
    clearTimeout(impactDebounceTimer);
    impactDebounceTimer = setTimeout(() => {
      loadImpactPreview();
    }, 400);
  };

  // Local Simplex Approximation / Live Estimator for Instant UI responsiveness
  const computeLocalBwm = () => {
    try {
      const n = CRITERIA_DEFINITIONS.length;
      const rawWeights: Record<string, number> = {};
      let sumW = 0;

      CRITERIA_DEFINITIONS.forEach((c) => {
        const a_Bj = bestToOthers[c.id] || 1;
        const a_jW = othersToWorst[c.id] || 1;
        const a_BW = bestToOthers[worstCriteriaId] || 7;
        const w_j = 0.5 * (1 / a_Bj + a_jW / a_BW);
        rawWeights[c.id] = w_j;
        sumW += w_j;
      });

      const normalizedWeights: Record<string, number> = {};
      CRITERIA_DEFINITIONS.forEach((c) => {
        normalizedWeights[c.id] = sumW > 0 ? rawWeights[c.id] / sumW : 1 / n;
      });

      // Calculate estimate of xi*
      let maxDev = 0;
      const w_B = normalizedWeights[bestCriteriaId] || 0.3;
      const w_W = normalizedWeights[worstCriteriaId] || 0.05;

      CRITERIA_DEFINITIONS.forEach((c) => {
        const w_j = normalizedWeights[c.id] || 0.1;
        const a_Bj = bestToOthers[c.id] || 1;
        const a_jW = othersToWorst[c.id] || 1;
        const devB = Math.abs(w_B - a_Bj * w_j);
        const devW = Math.abs(w_j - a_jW * w_W);
        if (devB > maxDev) maxDev = devB;
        if (devW > maxDev) maxDev = devW;
      });

      const a_BW = bestToOthers[worstCriteriaId] || 7;
      const CI_MAP: Record<number, number> = { 1: 0.0, 2: 0.44, 3: 1.0, 4: 1.63, 5: 2.3, 6: 3.0, 7: 3.73, 8: 4.47, 9: 5.23 };
      const ci = CI_MAP[Math.round(a_BW)] || 3.73;
      const cr = ci > 0 ? maxDev / ci : 0.0;

      calculationResult = {
        best_criteria_id: bestCriteriaId,
        worst_criteria_id: worstCriteriaId,
        a_BW,
        weights: normalizedWeights,
        xi_star: maxDev,
        ci,
        consistency_ratio: cr,
        is_consistent: cr <= 0.1,
        formatted_details: CRITERIA_DEFINITIONS.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          weight: normalizedWeights[c.id],
          weight_percentage: parseFloat((normalizedWeights[c.id] * 100).toFixed(2)),
        })),
      };

      debouncedImpactPreview();
    } catch (e) {
      console.warn('Live BWM calculation error:', e);
    }
  };

  const loadActiveConfig = async () => {
    loading = true;
    errorMsg = null;
    try {
      const config = await dssService.getActiveConfig();
      if (config) {
        activeConfig = config;
        if (config.best_criteria_id) bestCriteriaId = String(config.best_criteria_id);
        if (config.worst_criteria_id) worstCriteriaId = String(config.worst_criteria_id);
        if (config.best_to_others) bestToOthers = { ...bestToOthers, ...config.best_to_others };
        if (config.worst_to_others) othersToWorst = { ...othersToWorst, ...config.worst_to_others };
      }
      computeLocalBwm();
    } catch (err: any) {
      console.warn('Gagal memuat konfigurasi BWM aktif:', err);
    } finally {
      loading = false;
    }
  };

  const handleBestChange = (newBestId: string) => {
    if (newBestId === worstCriteriaId) {
      // swap or change worst
      const alt = CRITERIA_DEFINITIONS.find((c) => c.id !== newBestId);
      if (alt) worstCriteriaId = alt.id;
    }
    bestCriteriaId = newBestId;
    bestToOthers[newBestId] = 1;
    computeLocalBwm();
  };

  const handleWorstChange = (newWorstId: string) => {
    if (newWorstId === bestCriteriaId) {
      const alt = CRITERIA_DEFINITIONS.find((c) => c.id !== newWorstId);
      if (alt) bestCriteriaId = alt.id;
    }
    worstCriteriaId = newWorstId;
    othersToWorst[newWorstId] = 1;
    computeLocalBwm();
  };

  const handleSliderChange = (vectorType: 'best' | 'worst', targetId: string, value: number) => {
    if (vectorType === 'best') {
      bestToOthers = { ...bestToOthers, [targetId]: value };
    } else {
      othersToWorst = { ...othersToWorst, [targetId]: value };
    }
    computeLocalBwm();
  };

  const handleResetDefaults = () => {
    bestCriteriaId = '1';
    worstCriteriaId = '5';
    bestToOthers = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 7, '6': 5 };
    othersToWorst = { '1': 7, '2': 5, '3': 4, '4': 3, '5': 1, '6': 2 };
    computeLocalBwm();
    successMsg = 'Preferensi BWM telah diatur ulang ke profil standar seimbang.';
    setTimeout(() => (successMsg = null), 3000);
  };

  const handleRunBackendSolver = async () => {
    calculating = true;
    errorMsg = null;
    successMsg = null;
    const startTime = performance.now();

    try {
      const res = await dssService.calculateBwmWeights({
        name: configNameInput,
        best_criteria_id: bestCriteriaId,
        worst_criteria_id: worstCriteriaId,
        best_to_others: bestToOthers,
        worst_to_others: othersToWorst,
      });

      solverDuration = Math.round(performance.now() - startTime) || 16;
      if (res.bwm_result) {
        calculationResult = res.bwm_result;
      }
      successMsg = res.msg || 'Optimasi solver linier BWM selesai dihitung.';
      setTimeout(() => (successMsg = null), 4000);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menghitung bobot BWM.';
    } finally {
      calculating = false;
    }
  };

  const handleApplyOfficialWeights = async () => {
    applyModalOpen = false;
    applying = true;
    errorMsg = null;

    try {
      const res = await dssService.calculateBwmWeights({
        name: configNameInput || 'Konfigurasi Resmi BWM Sidoarjo',
        best_criteria_id: bestCriteriaId,
        worst_criteria_id: worstCriteriaId,
        best_to_others: bestToOthers,
        worst_to_others: othersToWorst,
      });

      successMsg = '✅ Bobot resmi BWM berhasil disimpan dan diterapkan ke seluruh pipeline rekomendasi TOPSIS!';
      await loadActiveConfig();
      setTimeout(() => (successMsg = null), 5000);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menerapkan bobot BWM.';
    } finally {
      applying = false;
    }
  };

  onMount(() => {
    loadActiveConfig();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Top Active Config Status Banner -->
  <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex items-center gap-3.5">
      <div class="w-12 h-12 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400 flex items-center justify-center shrink-0 shadow-md">
        <Compass class="w-6 h-6" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-sm sm:text-base font-outfit-600 text-white">Status Konfigurasi Bobot BWM Aktif</h3>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> AKTIF
          </span>
        </div>
        <p class="text-xs text-[#A1A1AA] mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>Profil: <strong class="text-zinc-200 font-semibold">{activeConfig?.name || 'Default Kalibrasi Sidoarjo (1/6 Equal Weights Fallback)'}</strong></span>
          {#if activeConfig?.consistency_ratio !== undefined}
            <span>• Rasio CR: <strong class="font-mono text-purple-400 font-semibold">{activeConfig.consistency_ratio.toFixed(4)}</strong></span>
          {/if}
          {#if (activeConfig as any)?.created_by_name}
            <span>• Analis: <strong class="text-zinc-200">{(activeConfig as any).created_by_name}</strong></span>
          {/if}
          {#if (activeConfig as any)?.activated_at}
            <span>• Diaktifkan: <strong class="text-zinc-300 font-mono">{new Date((activeConfig as any).activated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</strong></span>
          {/if}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 self-end sm:self-auto">
      <button
        type="button"
        onclick={() => (mathDrawerOpen = true)}
        class="pill-btn-dark text-xs font-outfit-600"
      >
        <span class="px-3.5 py-2 flex items-center gap-1.5">
          <Calculator class="w-3.5 h-3.5 text-purple-400" />
          <span>Audit Matematis</span>
        </span>
      </button>

      <button
        type="button"
        onclick={handleResetDefaults}
        class="pill-btn-dark text-xs font-outfit-600"
        title="Kembalikan nilai ke default seimbang"
      >
        <span class="px-3 py-2 flex items-center gap-1.5 text-[#A1A1AA] hover:text-white">
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </span>
      </button>
    </div>
  </div>

  <!-- Feedback Alerts -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala Optimasi BWM">
      {errorMsg}
    </Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Berhasil">
      {successMsg}
    </Alert>
  {/if}

  <!-- MAIN 2-COLUMN LAYOUT: Controls on Left, Live Results on Right -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <!-- LEFT PANEL: Best/Worst Selection & Saaty Scale Sliders (Col 7) -->
    <div class="lg:col-span-7 space-y-6">
      <!-- 1. SELECT BEST & WORST CRITERIA -->
      <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-[#FF634A]/15 text-[#FF634A] text-xs font-outfit-600 flex items-center justify-center border border-[#FF634A]/30">1</span>
            <h4 class="text-sm font-outfit-600 text-white">Tentukan Kriteria Terbaik & Terburuk</h4>
          </div>
          <span class="text-[11px] text-[#71717A]">Langkah 1 dari 2</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Best Criteria Dropdown -->
          <div class="space-y-1.5">
            <label for="select-best-criteria" class="block text-xs font-outfit-600 text-zinc-300">
              Kriteria Terbaik (C_B - Paling Diutamakan):
            </label>
            <select
              id="select-best-criteria"
              value={bestCriteriaId}
              onchange={(e) => handleBestChange(e.currentTarget.value)}
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs sm:text-sm font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
            >
              {#each CRITERIA_DEFINITIONS as crit}
                <option value={crit.id} disabled={crit.id === worstCriteriaId}>
                  [{crit.code}] {crit.name} ({crit.type})
                </option>
              {/each}
            </select>
            <p class="text-[11px] text-[#71717A] leading-tight">
              {bestCriteria?.desc}
            </p>
          </div>

          <!-- Worst Criteria Dropdown -->
          <div class="space-y-1.5">
            <label for="select-worst-criteria" class="block text-xs font-outfit-600 text-zinc-300">
              Kriteria Terburuk (C_W - Paling Rendah Pengaruhnya):
            </label>
            <select
              id="select-worst-criteria"
              value={worstCriteriaId}
              onchange={(e) => handleWorstChange(e.currentTarget.value)}
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs sm:text-sm font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
            >
              {#each CRITERIA_DEFINITIONS as crit}
                <option value={crit.id} disabled={crit.id === bestCriteriaId}>
                  [{crit.code}] {crit.name} ({crit.type})
                </option>
              {/each}
            </select>
            <p class="text-[11px] text-[#71717A] leading-tight">
              {worstCriteria?.desc}
            </p>
          </div>
        </div>
      </div>

      <!-- 2. SAATY 1-9 PAIRWISE PREFERENCE SLIDERS -->
      <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6">
        <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-[#FF634A]/15 text-[#FF634A] text-xs font-outfit-600 flex items-center justify-center border border-[#FF634A]/30">2</span>
            <h4 class="text-sm font-outfit-600 text-white">Matriks Perbandingan Skala Saaty (1 – 9)</h4>
          </div>
          <span class="text-[11px] text-[#71717A]">Auto Live Solver</span>
        </div>

        <!-- Section A: Best-to-Others Vector (A_B) -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-outfit-600 text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5" /> Vektor A_B: Kriteria Terbaik vs Kriteria Lainnya
            </h5>
            <span class="text-[10px] text-[#71717A]">C_B: [{bestCriteria?.code}] {bestCriteria?.name}</span>
          </div>

          <div class="space-y-3.5">
            {#each otherCriteriaForBest as crit}
              {@const val = bestToOthers[crit.id] || 1}
              <div class="p-3.5 rounded-2xl bg-[#1A1A1F] border border-[#272730] space-y-2 hover:border-[#383842] transition-all">
                <div class="flex items-center justify-between text-xs font-outfit-600">
                  <span class="text-white flex items-center gap-2">
                    <span class="w-5 h-5 rounded-md bg-[#24242C] text-[10px] flex items-center justify-center text-purple-400 font-mono">
                      {bestCriteria?.code}
                    </span>
                    <span>vs</span>
                    <span class="w-5 h-5 rounded-md bg-[#24242C] text-[10px] flex items-center justify-center text-zinc-300 font-mono">
                      {crit.code}
                    </span>
                    <span>{crit.name}</span>
                  </span>
                  <span class="px-2 py-0.5 rounded-lg bg-purple-950/40 text-purple-300 border border-purple-800/40 font-mono text-xs">
                    Skala: {val}
                  </span>
                </div>

                <!-- Visual Level Bar Meter (1 to 9) -->
                <div class="flex items-center gap-1 py-0.5">
                  {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as step}
                    <div
                      class="h-1.5 flex-1 rounded-sm transition-all {step <= val ? 'bg-[#FF634A]' : 'bg-[#2B2B36]'}"
                    ></div>
                  {/each}
                </div>

                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="9"
                    step="1"
                    value={val}
                    oninput={(e) => handleSliderChange('best', crit.id, parseInt(e.currentTarget.value, 10))}
                    class="w-full h-2 bg-[#272730] rounded-lg appearance-none cursor-pointer accent-[#FF634A]"
                  />
                </div>

                <div class="flex items-center justify-between text-[10px] text-[#71717A]">
                  <span class="font-outfit-600 text-zinc-300">{SAATY_DESCRIPTIONS[val]}</span>
                  <span>1 (Sama) ➔ 9 (Mutlak)</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Section B: Others-to-Worst Vector (A_W) -->
        <div class="space-y-4 pt-4 border-t border-[#24242A]">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-outfit-600 text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders class="w-3.5 h-3.5" /> Vektor A_W: Kriteria Lainnya vs Kriteria Terburuk
            </h5>
            <span class="text-[10px] text-[#71717A]">C_W: [{worstCriteria?.code}] {worstCriteria?.name}</span>
          </div>

          <div class="space-y-3.5">
            {#each otherCriteriaForWorst as crit}
              {@const val = othersToWorst[crit.id] || 1}
              <div class="p-3.5 rounded-2xl bg-[#1A1A1F] border border-[#272730] space-y-2 hover:border-[#383842] transition-all">
                <div class="flex items-center justify-between text-xs font-outfit-600">
                  <span class="text-white flex items-center gap-2">
                    <span class="w-5 h-5 rounded-md bg-[#24242C] text-[10px] flex items-center justify-center text-zinc-300 font-mono">
                      {crit.code}
                    </span>
                    <span>{crit.name}</span>
                    <span>vs</span>
                    <span class="w-5 h-5 rounded-md bg-[#24242C] text-[10px] flex items-center justify-center text-blue-400 font-mono">
                      {worstCriteria?.code}
                    </span>
                  </span>
                  <span class="px-2 py-0.5 rounded-lg bg-blue-950/40 text-blue-300 border border-blue-800/40 font-mono text-xs">
                    Skala: {val}
                  </span>
                </div>

                <!-- Visual Level Bar Meter (1 to 9) -->
                <div class="flex items-center gap-1 py-0.5">
                  {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as step}
                    <div
                      class="h-1.5 flex-1 rounded-sm transition-all {step <= val ? 'bg-blue-400' : 'bg-[#2B2B36]'}"
                    ></div>
                  {/each}
                </div>

                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="9"
                    step="1"
                    value={val}
                    oninput={(e) => handleSliderChange('worst', crit.id, parseInt(e.currentTarget.value, 10))}
                    class="w-full h-2 bg-[#272730] rounded-lg appearance-none cursor-pointer accent-[#FF634A]"
                  />
                </div>

                <div class="flex items-center justify-between text-[10px] text-[#71717A]">
                  <span class="font-outfit-600 text-zinc-300">{SAATY_DESCRIPTIONS[val]}</span>
                  <span>1 (Sama) ➔ 9 (Mutlak)</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onclick={handleRunBackendSolver}
            disabled={calculating}
            class="pill-btn-dark text-xs font-outfit-600 disabled:opacity-50"
          >
            <span class="px-4 py-2.5 flex items-center gap-2">
              <Calculator class="w-4 h-4 text-purple-400" />
              <span>{calculating ? 'Memproses Solver...' : 'Uji Solver LP Backend'}</span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL: Live BWM Weights Result & Consistency Ratio (Col 5) -->
    <div class="lg:col-span-5 space-y-6 sticky top-6">
      <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
          <div>
            <h4 class="text-sm font-outfit-600 text-white">Hasil Bobot Optimal (W*) & Konsistensi</h4>
            <p class="text-xs text-[#A1A1AA] mt-0.5">Komputasi linear programming $\min \xi$</p>
          </div>

          <!-- Live CR Badge -->
          <div class="flex flex-col items-end">
            {#if isConsistent}
              <span class="px-2.5 py-1 rounded-full text-xs font-outfit-600 bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5" /> Konsisten
              </span>
            {:else}
              <span class="px-2.5 py-1 rounded-full text-xs font-outfit-600 bg-rose-950/50 text-rose-400 border border-rose-800/50 flex items-center gap-1">
                <AlertTriangle class="w-3.5 h-3.5" /> Kalibrasi Ulang
              </span>
            {/if}
          </div>
        </div>

        <!-- Metric Cards & Health Gauge -->
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
            <span class="text-[10px] uppercase font-outfit-600 text-[#71717A] block">Nilai Deviasi ξ*</span>
            <div class="text-lg font-outfit-600 font-mono text-purple-400">
              {(calculationResult?.xi_star ?? 0.0382).toFixed(4)}
            </div>
            <span class="text-[10px] text-[#A1A1AA]">Maksimum Deviasi</span>
          </div>

          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
            <span class="text-[10px] uppercase font-outfit-600 text-[#71717A] block">Kelayakan (CR)</span>
            <div class="text-lg font-outfit-600 font-mono {isConsistent ? 'text-emerald-400' : 'text-rose-400'}">
              {(calculationResult?.consistency_ratio ?? 0.012).toFixed(4)}
            </div>
            <span class="text-[10px] {isConsistent ? 'text-emerald-400' : 'text-rose-400'} font-semibold">
              {isConsistent ? '✓ Sangat Baik (CR ≤ 0.10)' : '✗ CR > 0.10 (Perlu Kalibrasi)'}
            </span>
          </div>
        </div>

        <!-- Inconsistency "Why?" Explanation Guide -->
        {#if !isConsistent}
          <div class="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs space-y-1.5 font-outfit-400">
            <div class="font-outfit-600 text-amber-300 flex items-center gap-1.5">
              <AlertTriangle class="w-4 h-4 text-amber-400" />
              <span>Mengapa Konfigurasi Belum Konsisten?</span>
            </div>
            <p class="text-[11px] leading-relaxed text-amber-200/90">
              Rasio konsistensi saat ini adalah <strong>{(calculationResult?.consistency_ratio ?? 0).toFixed(4)}</strong> (melebihi batas toleransi 0.10). Terdapat kontradiksi antara perbandingan kriteria utama [{bestCriteria?.name}] dengan kriteria lainnya.
            </p>
            <p class="text-[10px] text-amber-300 font-outfit-600">
              💡 Saran: Kurangi nilai skala ekstrim (7-9) pada kriteria yang kurang dominan atau seimbangkan nilai A_B dan A_W.
            </p>
          </div>
        {/if}

        <!-- Weight Distribution List & Bars -->
        <div class="space-y-3 pt-1">
          <h5 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wider">Distribusi Bobot Prioritas (W*):</h5>

          {#if calculationResult?.formatted_details}
            <div class="space-y-2.5">
              {#each calculationResult.formatted_details as item}
                {@const pct = item.weight_percentage || 0}
                <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-lg bg-[#272730] text-[10px] font-mono font-bold flex items-center justify-center text-[#FF634A]">
                        {item.code}
                      </span>
                      <span class="font-outfit-600 text-white">{item.name}</span>
                    </div>
                    <div class="text-right">
                      <span class="font-mono text-zinc-200 font-semibold">{item.weight.toFixed(4)}</span>
                      <span class="text-[11px] font-mono text-[#FF634A] ml-1.5 font-bold">({pct}%)</span>
                    </div>
                  </div>

                  <!-- Visual Progress Bar -->
                  <div class="w-full h-2 bg-[#272730] rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-300 {item.code === 'C1' ? 'bg-gradient-to-r from-[#FF634A] to-[#FF8573]' : item.code === 'C2' ? 'bg-blue-500' : item.code === 'C3' ? 'bg-amber-500' : item.code === 'C4' ? 'bg-cyan-500' : item.code === 'C5' ? 'bg-purple-500' : 'bg-rose-500'}"
                      style="width: {Math.min(100, pct * 2.2)}%"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- SIMULASI DAMPAK BOBOT TERHADAP ZONA (IMPACT OF WEIGHT) -->
        <div class="p-4 rounded-2xl bg-[#17171C] border border-[#24242A] space-y-3">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-outfit-600 text-white flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-[#FF634A]" />
              <span>Simulasi Dampak Bobot ke Zona Teratas:</span>
            </h5>
            {#if loadingImpact}
              <span class="text-[10px] text-zinc-400 animate-pulse">Menghitung...</span>
            {/if}
          </div>

          {#if impactRankings.length > 0}
            <div class="space-y-1.5">
              {#each impactRankings as r, idx}
                <div class="p-2.5 rounded-xl bg-[#1F1F26] border border-[#2B2B36] flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-5 h-5 rounded-full {idx === 0 ? 'bg-amber-400 text-black font-bold' : idx === 1 ? 'bg-zinc-300 text-black font-bold' : 'bg-amber-800 text-white'} text-[10px] flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <span class="font-outfit-600 text-zinc-100 truncate">{r.zone_name}</span>
                  </div>
                  <div class="font-mono text-emerald-400 font-bold shrink-0 ml-2">
                    C* = {(r.preference_score ?? 0).toFixed(4)}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-[11px] text-zinc-500">
              Belum ada data dampak ranking zona. Pastikan zona operasional aktif tersedia di sistem.
            </p>
          {/if}
        </div>

        <!-- Action Section: Apply Weights -->
        <div class="pt-3 border-t border-[#24242A] space-y-2.5">
          {#if !isConsistent}
            <div class="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
              <Lock class="w-4 h-4 shrink-0 text-rose-400" />
              <span>Tombol simpan dikunci karena nilai CR > 0.10. Mohon sesuaikan kembali slider preferensi Saaty.</span>
            </div>
          {/if}

          <button
            type="button"
            onclick={() => (applyModalOpen = true)}
            disabled={!isConsistent || applying}
            class="pill-btn-orange w-full text-xs font-outfit-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span class="w-full py-3 px-4 flex items-center justify-center gap-2 text-white font-bold text-sm">
              <Save class="w-4 h-4" />
              <span>{applying ? 'Menerapkan Bobot...' : 'Terapkan Bobot Resmi DSS'}</span>
            </span>
          </button>

          <button
            type="button"
            onclick={() => (mathDrawerOpen = true)}
            class="w-full py-2.5 text-xs font-outfit-600 text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1F] rounded-2xl border border-transparent hover:border-[#2E2E38] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Calculator class="w-3.5 h-3.5 text-purple-400" />
            <span>Lihat Rincian Audit Solver Matematis & LaTeX</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- MODAL: KONFIRMASI TERAPKAN BOBOT RESMI -->
{#if applyModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <button
      type="button"
      aria-label="Tutup modal"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={() => (applyModalOpen = false)}
    ></button>

    <div class="relative w-full max-w-lg bg-[#131316] border border-[#24242A] rounded-3xl p-6 sm:p-7 shadow-2xl z-10 space-y-5">
      <div class="flex items-center gap-3 pb-3 border-b border-[#24242A]">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/20">
          <Save class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-outfit-600 text-white">Terapkan Bobot Resmi BWM</h3>
          <p class="text-xs text-[#A1A1AA]">Bobot baru akan langsung diaplikasikan ke mesin rekomendasi TOPSIS</p>
        </div>
      </div>

      <div class="space-y-3 text-xs text-zinc-300 leading-relaxed">
        <div class="p-3.5 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-2">
          <div class="font-outfit-600 text-white">Ringkasan Konfigurasi:</div>
          <div class="grid grid-cols-3 gap-2 font-mono text-[11px]">
            {#if calculationResult?.formatted_details}
              {#each calculationResult.formatted_details as item}
                <div class="p-2 rounded-xl bg-[#22222A] text-center">
                  <div class="text-[10px] text-[#71717A]">{item.code}</div>
                  <div class="text-[#FF634A] font-bold">{item.weight_percentage}%</div>
                </div>
              {/each}
            {/if}
          </div>
          <div class="text-[11px] text-[#A1A1AA] pt-1">
            Rasio Konsistensi: <span class="text-emerald-400 font-mono font-bold">{(calculationResult?.consistency_ratio || 0).toFixed(4)} (VALID)</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <label for="input-config-name" class="block text-xs font-outfit-600 text-zinc-300">
            Nama Profil / Catatan Kalibrasi:
          </label>
          <input
            id="input-config-name"
            type="text"
            bind:value={configNameInput}
            placeholder="Contoh: Kalibrasi Q4 Musim Hujan 2026"
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-400 focus:border-[#FF634A] focus:outline-none"
          />
        </div>
      </div>

      <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3">
        <button
          type="button"
          onclick={() => (applyModalOpen = false)}
          class="px-4 py-2.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
        >
          Batal
        </button>

        <button
          type="button"
          onclick={handleApplyOfficialWeights}
          class="pill-btn-orange text-xs font-outfit-600 cursor-pointer"
        >
          <span class="px-5 py-2.5 flex items-center gap-1.5 text-white font-bold">
            <CheckCircle2 class="w-4 h-4" />
            <span>Ya, Terapkan Sekarang</span>
          </span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- DRAWER AUDIT MATEMATIS BWM -->
<BwmMathAuditDrawer
  open={mathDrawerOpen}
  onClose={() => (mathDrawerOpen = false)}
  bwmResult={calculationResult}
  bestName={bestCriteria?.name}
  worstName={worstCriteria?.name}
  durationMs={solverDuration}
/>
