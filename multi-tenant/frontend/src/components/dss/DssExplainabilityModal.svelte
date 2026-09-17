<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    explainTopsisZone, 
    type ZoneExplainabilityReport, 
    type CriterionExplanation 
  } from '../../lib/utils/dssExplainability.js';
  import { 
    Sparkles, 
    X, 
    TrendingUp, 
    AlertTriangle, 
    ShieldCheck, 
    Calculator, 
    Layers, 
    HelpCircle,
    Info
  } from 'lucide-svelte';

  interface Props {
    zoneItem: any;
    topsisSummary: {
      ideal_positive?: Record<string, number>;
      ideal_negative?: Record<string, number>;
    };
    criteriaSpecs?: Array<{ code: string; name: string; type: string; weight: number }>;
    timeSlot?: string;
    onClose: () => void;
  }

  let { zoneItem, topsisSummary, criteriaSpecs = [], timeSlot = 'sore', onClose }: Props = $props();

  let closeBtnEl = $state<HTMLButtonElement | null>(null);
  let activeTab = $state<'rationale' | 'math'>('rationale');

  let report = $derived.by<ZoneExplainabilityReport>(() => {
    return explainTopsisZone(zoneItem, topsisSummary, criteriaSpecs, timeSlot);
  });

  onMount(() => {
    closeBtnEl?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-outfit-400"
  role="dialog"
  aria-modal="true"
  aria-labelledby="dss-explain-title"
>
  <!-- Backdrop click -->
  <button
    type="button"
    aria-label="Tutup modal eksplanasi"
    class="fixed inset-0 bg-transparent border-0 p-0 m-0 cursor-default"
    onclick={onClose}
  ></button>

  <div class="relative w-full max-w-2xl bg-[#131316] border border-[#272730] rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-[#24242A]">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center font-bold text-lg">
          #{report.rank}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 id="dss-explain-title" class="text-base sm:text-lg font-outfit-600 text-white tracking-tight">
              Eksplanasi DSS: Mengapa Zona Ini Direkomendasikan?
            </h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/20">
              S7-04 Non-Black-Box
            </span>
          </div>
          <p class="text-xs text-zinc-400 mt-0.5">
            {report.zoneName} • Skor TOPSIS C* = <span class="font-mono text-amber-400 font-bold">{report.preferenceScore.toFixed(4)}</span> (Slot: {timeSlot.toUpperCase()})
          </p>
        </div>
      </div>

      <button
        bind:this={closeBtnEl}
        type="button"
        onclick={onClose}
        class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="Tutup"
      >
        <X class="w-5 h-5" />
      </button>
    </div>

    <!-- Mode Selector Tabs: Human Rationale vs Pure Math -->
    <div class="flex items-center gap-2 p-1 bg-[#18181C] rounded-2xl border border-[#272730] text-xs font-outfit-600">
      <button
        type="button"
        onclick={() => (activeTab = 'rationale')}
        class="flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer
        {activeTab === 'rationale' ? 'bg-[#FF634A] text-zinc-950 font-bold shadow-md' : 'text-zinc-400 hover:text-white'}"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>1. Rationale Rekomendasi (Drivers vs Risks)</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = 'math')}
        class="flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer
        {activeTab === 'math' ? 'bg-zinc-100 text-zinc-950 font-bold shadow-md' : 'text-zinc-400 hover:text-white'}"
      >
        <Calculator class="w-3.5 h-3.5" />
        <span>2. Bukti Matematis & Jarak Ideal (A+ / A-)</span>
      </button>
    </div>

    {#if activeTab === 'rationale'}
      <!-- TAB 1: HUMAN RATIONALE (DRIVERS VS RISKS) -->
      <div class="space-y-4 text-xs">
        <!-- Headline -->
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 leading-relaxed">
          <p class="font-semibold text-white text-xs sm:text-sm">{report.narrativeSummary.headline}</p>
        </div>

        <!-- 1. Key Drivers (+) -->
        <div class="space-y-2">
          <div class="flex items-center gap-1.5 text-emerald-400 font-outfit-600">
            <TrendingUp class="w-4 h-4" />
            <h4 class="text-xs uppercase tracking-wider">Faktor Pendorong Utama (Drivers / Keunggulan):</h4>
          </div>
          <div class="space-y-2">
            {#each report.narrativeSummary.whyRecommended as driver}
              <div class="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 text-zinc-200 flex items-start gap-2.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                <span>{driver}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- 2. Risk / Bottleneck Factors (-) -->
        {#if report.narrativeSummary.riskFactors.length > 0}
          <div class="space-y-2">
            <div class="flex items-center gap-1.5 text-rose-400 font-outfit-600">
              <AlertTriangle class="w-4 h-4" />
              <h4 class="text-xs uppercase tracking-wider">Faktor Risiko & Penalti (Trade-Offs):</h4>
            </div>
            <div class="space-y-2">
              {#each report.narrativeSummary.riskFactors as risk}
                <div class="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 text-zinc-200 flex items-start gap-2.5">
                  <span class="w-2 h-2 rounded-full bg-rose-400 mt-1.5 shrink-0"></span>
                  <span>{risk}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 3. Complete 6-Criteria Matrix Breakdown -->
        <div class="space-y-2 pt-2">
          <h4 class="font-outfit-600 text-zinc-400 uppercase text-[11px] tracking-wider">
            Evaluasi Relatif Tiap Kriteria (Jarak terhadap Benchmark Ideal):
          </h4>

          <div class="space-y-2">
            {#each report.criteriaBreakdown as c}
              <div class="p-3 bg-[#18181C] rounded-2xl border border-[#272730] space-y-2">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-outfit-600 text-white block">
                      {c.code}. {c.name}
                      <span class="text-[10px] ml-1.5 px-1.5 py-0.5 rounded font-mono font-normal
                      {c.type === 'BENEFIT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
                        {c.type} (Bobot BWM {c.weightPercentage}%)
                      </span>
                    </span>
                    <span class="text-[10px] text-zinc-400 block mt-0.5">
                      Nilai Aktual: <strong class="text-zinc-200">{c.rawValue} {c.rawUnit}</strong> • {c.assessmentText}
                    </span>
                  </div>

                  <div class="text-right">
                    <span class="font-mono font-bold text-xs {c.proximityPercent >= 60 ? 'text-emerald-400' : c.proximityPercent <= 40 ? 'text-rose-400' : 'text-amber-400'}">
                      {c.proximityPercent.toFixed(1)}%
                    </span>
                    <span class="text-[9px] text-zinc-500 block">Indeks Kedekatan Ideal</span>
                  </div>
                </div>

                <!-- Proximity Bar -->
                <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    class="h-full transition-all rounded-full {c.proximityPercent >= 60 ? 'bg-emerald-400' : c.proximityPercent <= 40 ? 'bg-rose-400' : 'bg-amber-400'}"
                    style="width: {c.proximityPercent}%;"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

    {:else}
      <!-- TAB 2: PURE MATHEMATICAL DEFENSE & EUCLIDEAN INVARIANTS -->
      <div class="space-y-4 text-xs">
        <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2 text-zinc-300">
          <div class="flex items-center gap-2 text-zinc-100 font-outfit-600">
            <Calculator class="w-4 h-4 text-amber-400" />
            <span>Formulasi Closeness Coefficient (TOPSIS Safe Kernel)</span>
          </div>
          <div class="p-3 bg-black/40 rounded-xl font-mono text-[11px] text-amber-300 border border-zinc-800">
            C_i = D_i^- / (D_i^+ + D_i^-) = {report.dNeg.toFixed(4)} / ({report.dPos.toFixed(4)} + {report.dNeg.toFixed(4)}) = <strong class="text-white">{report.preferenceScore.toFixed(4)}</strong>
          </div>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            {report.narrativeSummary.mathematicalVerdict}
          </p>
        </div>

        <!-- Euclidean Distance Cards -->
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
            <span class="text-[11px] text-zinc-400 block">Jarak ke Solusi Ideal Positif (D+)</span>
            <span class="text-lg font-mono font-bold text-rose-400 mt-1 block">{report.dPos.toFixed(4)}</span>
            <span class="text-[10px] text-zinc-500 block mt-0.5">Semakin kecil semakin baik (jarak ke A+)</span>
          </div>

          <div class="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
            <span class="text-[11px] text-zinc-400 block">Jarak ke Solusi Ideal Negatif (D-)</span>
            <span class="text-lg font-mono font-bold text-emerald-400 mt-1 block">{report.dNeg.toFixed(4)}</span>
            <span class="text-[10px] text-zinc-500 block mt-0.5">Semakin besar semakin baik (jarak dari A-)</span>
          </div>
        </div>

        <!-- Table of Exact Vectors -->
        <div class="space-y-2 pt-2">
          <h4 class="font-outfit-600 text-zinc-400 uppercase text-[11px] tracking-wider">
            Matriks Berbobot (v_ij) vs Solusi Ideal (A+ & A-):
          </h4>

          <div class="overflow-x-auto">
            <table class="w-full text-left font-mono text-[11px] border-collapse">
              <thead>
                <tr class="border-b border-zinc-800 text-zinc-400 text-[10px]">
                  <th class="py-2 px-2">Kriteria</th>
                  <th class="py-2 px-2">Tipe</th>
                  <th class="py-2 px-2">Bobot w_j</th>
                  <th class="py-2 px-2 text-right">v_ij</th>
                  <th class="py-2 px-2 text-right text-emerald-400">A+ (Ideal)</th>
                  <th class="py-2 px-2 text-right text-rose-400">A- (Nadir)</th>
                  <th class="py-2 px-2 text-right">(v_ij - A+)^2</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/60">
                {#each report.criteriaBreakdown as c}
                  <tr class="hover:bg-zinc-900/50">
                    <td class="py-2 px-2 font-sans font-semibold text-zinc-200">{c.code}</td>
                    <td class="py-2 px-2 text-[10px]">{c.type}</td>
                    <td class="py-2 px-2">{c.weight.toFixed(4)}</td>
                    <td class="py-2 px-2 text-right text-white font-bold">{c.weightedV.toFixed(4)}</td>
                    <td class="py-2 px-2 text-right text-emerald-400">{c.idealPositiveV.toFixed(4)}</td>
                    <td class="py-2 px-2 text-right text-rose-400">{c.idealNegativeV.toFixed(4)}</td>
                    <td class="py-2 px-2 text-right text-zinc-400">{c.deltaPosSq.toFixed(6)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Footer -->
    <div class="pt-3 border-t border-[#24242A] flex justify-end">
      <button
        type="button"
        onclick={onClose}
        class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-outfit-600 transition-colors cursor-pointer"
      >
        Tutup Rincian Eksplanasi
      </button>
    </div>
  </div>
</div>
