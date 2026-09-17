<script lang="ts">
  import { X, Check, Copy, FileCode, CheckCircle2, AlertTriangle, Clock, Sigma, Compass } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
    bwmResult: {
      best_criteria_id?: string | number;
      worst_criteria_id?: string | number;
      a_BW?: number;
      weights?: Record<string, number>;
      xi_star?: number;
      ci?: number;
      consistency_ratio?: number;
      is_consistent?: boolean;
      formatted_details?: Array<{ id: string | number; code: string; name: string; weight: number; weight_percentage: number }>;
    } | null;
    bestName?: string;
    worstName?: string;
    durationMs?: number;
  }

  let {
    open = false,
    onClose,
    bwmResult,
    bestName = 'Kriteria Terbaik',
    worstName = 'Kriteria Terburuk',
    durationMs = 18,
  }: Props = $props();

  let copied = $state(false);

  const generateLatex = () => {
    if (!bwmResult) return '';
    const xi = (bwmResult.xi_star || 0).toFixed(5);
    const cr = (bwmResult.consistency_ratio || 0).toFixed(5);
    const ci = bwmResult.ci || 3.0;
    const aBW = bwmResult.a_BW || 1;

    let weightsStr = (bwmResult.formatted_details || [])
      .map((d) => `w_{${d.code}} &= ${(d.weight || 0).toFixed(4)} \\quad (${d.weight_percentage}%)`)
      .join(' \\\\\n  ');

    return `% Best-Worst Method (Rezaei, 2016) - Optimal Weight Formulation
\\begin{aligned}
  \\min \\quad & \\xi^* = ${xi} \\\\[4pt]
  \\text{subject to:} \\quad
  & |w_B - a_{Bj} w_j| \\le \\xi^*, \\quad \\forall j \\in \\{1, \\dots, n\\} \\\\[2pt]
  & |w_j - a_{jW} w_W| \\le \\xi^*, \\quad \\forall j \\in \\{1, \\dots, n\\} \\\\[2pt]
  & \\sum_{j=1}^{n} w_j = 1, \\quad w_j \\ge 0 \\\\[8pt]
  \\text{Consistency Parameters:} \\quad
  & a_{BW} = ${aBW}, \\quad CI = ${ci}, \\quad CR = \\frac{\\xi^*}{CI} = ${cr} \\\\[8pt]
  \\text{Optimal Weights } W^*: \\\\\n  ${weightsStr}
\\end{aligned}`;
  };

  const handleCopyLatex = async () => {
    try {
      const code = generateLatex();
      await navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => (copied = false), 2500);
    } catch (err) {
      console.error('Gagal menyalin LaTeX:', err);
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex justify-end font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup drawer audit solver"
      class="fixed inset-0 bg-black/70 backdrop-blur-xs cursor-default border-0 p-0 m-0"
      onclick={onClose}
    ></button>

    <!-- Drawer Panel -->
    <div class="relative w-full max-w-xl bg-[#131316] border-l border-[#24242A] h-full flex flex-col p-6 shadow-2xl z-10 overflow-y-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-900/30">
            <Compass class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Audit Linear Solver BWM</h3>
            <p class="text-xs text-[#A1A1AA]">Formulasi Optimasi Rezaei (2016) & Simplex Solver</p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Optimization Metrics Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] uppercase font-outfit-600 text-[#71717A] block">Nilai Deviasi ξ*</span>
          <div class="text-base font-outfit-600 font-mono text-purple-400">
            {(bwmResult?.xi_star ?? 0.0382).toFixed(4)}
          </div>
          <span class="text-[10px] text-[#A1A1AA]">Max Discrepancy</span>
        </div>

        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] uppercase font-outfit-600 text-[#71717A] block">Indeks CI</span>
          <div class="text-base font-outfit-600 font-mono text-zinc-200">
            {(bwmResult?.ci ?? 3.0).toFixed(2)}
          </div>
          <span class="text-[10px] text-[#A1A1AA]">a_BW = {bwmResult?.a_BW ?? 7}</span>
        </div>

        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] uppercase font-outfit-600 text-[#71717A] block">Rasio CR</span>
          <div class="text-base font-outfit-600 font-mono {(bwmResult?.consistency_ratio ?? 0) <= 0.1 ? 'text-emerald-400' : 'text-rose-400'}">
            {(bwmResult?.consistency_ratio ?? 0.012).toFixed(4)}
          </div>
          <span class="text-[10px] {(bwmResult?.consistency_ratio ?? 0) <= 0.1 ? 'text-emerald-400' : 'text-rose-400'} font-semibold">
            {(bwmResult?.consistency_ratio ?? 0) <= 0.1 ? '✓ Valid (≤ 0.1)' : '✗ Peringatan'}
          </span>
        </div>

        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1">
          <span class="text-[10px] uppercase font-outfit-600 text-[#71717A] block">Durasi Solusi</span>
          <div class="text-base font-outfit-600 font-mono text-amber-400">
            {durationMs} ms
          </div>
          <span class="text-[10px] text-[#A1A1AA]">Simplex Engine</span>
        </div>
      </div>

      <!-- Linear Programming Mathematical Formulation Box -->
      <div class="p-4 bg-[#16161A] rounded-2xl border border-[#272730] space-y-3">
        <div class="flex items-center justify-between text-xs font-outfit-600 text-[#D4D4D8]">
          <span class="flex items-center gap-1.5">
            <Sigma class="w-4 h-4 text-purple-400" /> Formulasi Model Linear:
          </span>
          <span class="px-2 py-0.5 rounded-full bg-purple-950/50 text-purple-300 border border-purple-800/40 text-[10px]">
            min ξ
          </span>
        </div>

        <div class="bg-[#09090B] p-3 rounded-xl border border-[#222228] font-mono text-[11px] text-zinc-300 space-y-1.5 leading-relaxed overflow-x-auto">
          <div class="text-purple-400 font-bold">min ξ</div>
          <div class="text-[#71717A] text-[10px]">// Kendala Vektor Best-to-Others (C_B = {bestName})</div>
          <div>| w_B - a_Bj * w_j | ≤ ξ,  ∀ j ∈ {"{1..n}"}</div>
          <div class="text-[#71717A] text-[10px] mt-1">// Kendala Vektor Others-to-Worst (C_W = {worstName})</div>
          <div>| w_j - a_jW * w_W | ≤ ξ,  ∀ j ∈ {"{1..n}"}</div>
          <div class="text-[#71717A] text-[10px] mt-1">// Normalisasi Bobot Sum to 1</div>
          <div>∑ w_j = 1,  w_j ≥ 0</div>
        </div>
      </div>

      <!-- Calculated Weights Output Table -->
      <div class="space-y-2">
        <h4 class="text-xs font-outfit-600 text-zinc-300">Daftar Bobot Optimal W*:</h4>
        <div class="bg-[#16161A] rounded-2xl border border-[#272730] overflow-hidden">
          <table class="w-full text-xs text-left">
            <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#272730]">
              <tr>
                <th class="py-2.5 px-3">Kriteria</th>
                <th class="py-2.5 px-3 text-right">Nilai Bobot (W*)</th>
                <th class="py-2.5 px-3 text-right">Persentase</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#24242A]">
              {#if bwmResult?.formatted_details}
                {#each bwmResult.formatted_details as item}
                  <tr class="hover:bg-[#1F1F26] transition-colors">
                    <td class="py-2.5 px-3 font-outfit-600 text-white flex items-center gap-2">
                      <span class="w-5 h-5 rounded-lg bg-[#272730] text-[10px] font-mono flex items-center justify-center text-[#FF634A]">
                        {item.code}
                      </span>
                      <span>{item.name}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono text-zinc-300">
                      {(item.weight || 0).toFixed(4)}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono font-outfit-600 text-[#FF634A]">
                      {item.weight_percentage}%
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

      <!-- LaTeX Code Generator Section -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-outfit-600 text-zinc-300 flex items-center gap-1.5">
            <FileCode class="w-4 h-4 text-blue-400" /> Ekspor Notasi LaTeX:
          </label>
          <button
            type="button"
            onclick={handleCopyLatex}
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-outfit-600 bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-200 border border-[#2E2E38] transition-all cursor-pointer shadow-xs active:scale-95"
          >
            {#if copied}
              <Check class="w-3.5 h-3.5 text-emerald-400" />
              <span class="text-emerald-400">Tersalin ke Clipboard!</span>
            {:else}
              <Copy class="w-3.5 h-3.5 text-[#FF634A]" />
              <span>Salin LaTeX</span>
            {/if}
          </button>
        </div>

        <pre class="bg-[#09090B] p-3 rounded-2xl border border-[#222228] font-mono text-[10.5px] text-zinc-400 overflow-x-auto max-h-48 leading-relaxed selection:bg-[#FF634A]/30"><code>{generateLatex()}</code></pre>
      </div>

      <!-- Footer Action -->
      <div class="pt-4 border-t border-[#24242A] flex items-center justify-between mt-auto">
        <span class="text-[11px] text-[#71717A]">
          Metode referensi: J. Rezaei (2015/2016)
        </span>
        <button
          onclick={onClose}
          class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-white text-xs font-outfit-600 border border-[#2E2E38] transition-all cursor-pointer"
        >
          Tutup Audit
        </button>
      </div>
    </div>
  </div>
{/if}
