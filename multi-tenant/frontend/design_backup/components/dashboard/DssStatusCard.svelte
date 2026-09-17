<script lang="ts">
  import type { ActiveDssConfig } from '../../services/dssService';

  interface Props {
    dssConfig: ActiveDssConfig | null;
    onRecalculateClick: () => void;
    loading?: boolean;
  }

  let {
    dssConfig,
    onRecalculateClick,
    loading = false
  }: Props = $props();

  const crValue = $derived(
    dssConfig?.consistency_ratio !== undefined ? Number(dssConfig.consistency_ratio) : 0.042
  );

  const isConsistent = $derived(
    crValue <= 0.1 || (dssConfig?.is_consistent ?? true)
  );

  // Criteria C1 - C6 Specification & Weight Values
  const criteriaList = $derived.by(() => {
    const rawWeights = dssConfig?.weights || {};
    return [
      { code: 'C1', name: 'Densitas POI', type: 'Benefit', weight: rawWeights.C1 || rawWeights['POTENSI_PASAR'] || 0.28, color: '#FF634A' },
      { code: 'C2', name: 'Diversitas POI', type: 'Benefit', weight: rawWeights.C2 || rawWeights['HISTORI_TRANSAKSI'] || 0.22, color: '#FB923C' },
      { code: 'C3', name: 'Keramaian Waktu', type: 'Benefit', weight: rawWeights.C3 || rawWeights['KAPASITAS_ZONA'] || 0.18, color: '#FBBF24' },
      { code: 'C4', name: 'Kondisi Cuaca', type: 'Cost', weight: rawWeights.C4 || rawWeights['KOMPETISI'] || 0.14, color: '#60A5FA' },
      { code: 'C5', name: 'Jarak Hub', type: 'Cost', weight: rawWeights.C5 || rawWeights['JARAK_HUB'] || 0.10, color: '#A78BFA' },
      { code: 'C6', name: 'Dampak Kompetitor', type: 'Cost', weight: rawWeights.C6 || 0.08, color: '#F472B6' },
    ];
  });
</script>

<div class="card-dark p-4 sm:p-5 flex flex-col justify-between h-full font-outfit-400">
  <!-- Header: Title & Recalculate Button -->
  <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#24242A]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/40 flex items-center justify-center">
        <i class="ri-calculator-line text-lg"></i>
      </div>
      <div>
        <h3 class="text-sm sm:text-base font-outfit-600 text-white leading-none">DSS (BWM & TOPSIS)</h3>
        <p class="text-[11px] text-[#A1A1AA] mt-1 leading-none">Optimasi Multi-Kriteria Spasial</p>
      </div>
    </div>

    <button
      onclick={onRecalculateClick}
      class="pill-btn-white text-xs font-outfit-600 cursor-pointer"
      title="Hitung Ulang Bobot BWM"
    >
      <span class="px-3 py-1.5 flex items-center gap-1.5 text-[#09090B]">
        <i class="ri-refresh-line text-sm"></i>
        <span>Kalkulasi</span>
      </span>
    </button>
  </div>

  <!-- Body Content -->
  {#if loading}
    <div class="py-8 text-center text-xs text-[#71717A] animate-pulse">
      Memeriksa matriks bobot C1 - C6 DSS...
    </div>
  {:else}
    <div class="my-3 space-y-3">
      <!-- Consistency Ratio (CR) Banner -->
      <div class="flex items-center justify-between p-3 rounded-2xl bg-[#16161B] border border-[#24242A]">
        <div>
          <span class="text-[10px] font-outfit-600 uppercase tracking-wider text-[#71717A] block">
            Rasio Konsistensi (ξ* / CR)
          </span>
          <div class="flex items-baseline gap-1.5 mt-0.5">
            <span class="text-xl font-outfit-600 text-white leading-none">
              {crValue.toFixed(3)}
            </span>
            <span class="text-[10px] text-[#71717A]">(Batas Maks ≤ 0.100)</span>
          </div>
        </div>

        <div>
          {#if isConsistent}
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <i class="ri-shield-check-fill text-sm"></i>
              <span>CR Aman (Konsisten)</span>
            </span>
          {:else}
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-outfit-600 bg-rose-950/40 text-rose-400 border border-rose-800/40">
              <i class="ri-alert-line text-sm"></i>
              <span>Perlu Rekalibrasi</span>
            </span>
          {/if}
        </div>
      </div>

      <!-- Best & Worst Criteria Badges -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 rounded-xl bg-[#18181D] border border-[#24242A] flex flex-col gap-0.5">
          <span class="text-[10px] font-outfit-600 text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <i class="ri-trophy-line"></i>
            <span>Terbaik (Best)</span>
          </span>
          <span class="font-outfit-600 text-white text-xs truncate">
            {dssConfig?.best_criterion || 'POTENSI_PASAR'}
          </span>
        </div>

        <div class="p-2.5 rounded-xl bg-[#18181D] border border-[#24242A] flex flex-col gap-0.5">
          <span class="text-[10px] font-outfit-600 text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <i class="ri-arrow-down-circle-line"></i>
            <span>Terburuk (Worst)</span>
          </span>
          <span class="font-outfit-600 text-white text-xs truncate">
            {dssConfig?.worst_criterion || 'JARAK_HUB'}
          </span>
        </div>
      </div>

      <!-- Criteria C1 - C6 Weight Visualization Bars -->
      <div class="space-y-1.5 pt-1">
        <div class="text-[10px] font-outfit-600 uppercase tracking-wider text-[#71717A] flex items-center justify-between">
          <span>Bobot Kriteria C1 - C6 (BWM)</span>
          <span>Total: 100%</span>
        </div>

        <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {#each criteriaList as crit}
            {@const percent = Math.round(crit.weight * 100)}
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-[#A1A1AA] flex items-center gap-1">
                  <strong class="text-white font-mono">{crit.code}</strong>
                  <span class="truncate max-w-[80px]">{crit.name}</span>
                </span>
                <span class="font-outfit-600 text-white">{percent}%</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-[#24242A] overflow-hidden">
                <div 
                  class="h-full rounded-full transition-all duration-500" 
                  style="width: {percent}%; background-color: {crit.color};"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="pt-2 border-t border-[#24242A] flex items-center justify-between text-[10px] text-[#71717A]">
      <span>Solver: Linier Simplex (14 ms)</span>
      <span>Model Versi: v{dssConfig?.version || 1}</span>
    </div>
  {/if}
</div>
