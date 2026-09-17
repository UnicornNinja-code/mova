<script lang="ts">
  import { onMount } from 'svelte';
  import { dssService, type HybridEvaluationResponse, type DssSnapshotItem } from '../../services/dssService';
  import { 
    Play, 
    Layers, 
    Clock, 
    MapPin, 
    Award, 
    History, 
    CheckCircle2, 
    Compass, 
    TrendingUp, 
    FileSpreadsheet, 
    ChevronRight,
    ArrowUpRight,
    Sparkles,
    X
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  let running = $state(false);
  let timeSlot = $state<'pagi' | 'siang' | 'sore' | 'malam'>('sore');
  let latInput = $state('-7.4478');
  let lonInput = $state('112.7183');
  let simulationResult = $state<HybridEvaluationResponse | null>(null);
  let snapshots = $state<DssSnapshotItem[]>([]);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  let activeMatrixStep = $state<number>(6); // Default show rankings (Step 6)
  let selectedSnapshot = $state<any | null>(null);
  let selectedExplainZone = $state<any | null>(null);

  const loadSnapshots = async () => {
    try {
      const list = await dssService.getSnapshots(10);
      snapshots = list;
    } catch (err) {
      console.warn('Gagal memuat snapshot:', err);
    }
  };

  const handleRunSimulation = async () => {
    running = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await dssService.evaluateHybridTopsis({
        time_slot: timeSlot,
        lat: latInput ? parseFloat(latInput) : null,
        lon: lonInput ? parseFloat(lonInput) : null,
      });

      simulationResult = res;
      successMsg = `Evaluasi Hybrid BWM-TOPSIS untuk slot ${timeSlot.toUpperCase()} berhasil dijalankan.`;
      await loadSnapshots();
      setTimeout(() => (successMsg = null), 3500);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menjalankan evaluasi TOPSIS.';
    } finally {
      running = false;
    }
  };

  const handleViewSnapshot = async (snap: DssSnapshotItem) => {
    try {
      const detail = await dssService.getSnapshotById(snap.id);
      selectedSnapshot = detail.snapshot_data || snap.details;
      if (selectedSnapshot) {
        simulationResult = selectedSnapshot;
        activeMatrixStep = 6;
      }
    } catch (err) {
      console.warn('Gagal membuka snapshot:', err);
    }
  };

  onMount(async () => {
    await loadSnapshots();
    // Run initial preview
    await handleRunSimulation();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Simulation Control Toolbar -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#24242A]">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/20">
          <Play class="w-5 h-5 fill-current" />
        </div>
        <div>
          <h3 class="text-sm sm:text-base font-outfit-600 text-white">
            Simulator Evaluasi Spasial Hybrid BWM-TOPSIS
          </h3>
          <p class="text-xs text-[#A1A1AA]">
            Jalankan uji coba perankingan zona operasional secara langsung dengan parameter waktu & koordinat asal.
          </p>
        </div>
      </div>

      <button
        type="button"
        onclick={handleRunSimulation}
        disabled={running}
        class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50"
      >
        <span class="px-5 py-2.5 flex items-center gap-2 text-white font-bold">
          <Play class="w-4 h-4 fill-current" />
          <span>{running ? 'Mengevaluasi Zona...' : 'Jalankan Evaluasi TOPSIS'}</span>
        </span>
      </button>
    </div>

    <!-- Parameter Inputs -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
      <!-- Time Slot Selector -->
      <div class="space-y-1.5">
        <label for="select-topsis-timeslot" class="block text-xs font-outfit-600 text-zinc-300 flex items-center gap-1.5">
          <Clock class="w-3.5 h-3.5 text-amber-400" /> Slot Waktu Evaluasi:
        </label>
        <select
          id="select-topsis-timeslot"
          bind:value={timeSlot}
          class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
        >
          <option value="pagi">PAGI (06:00 - 10:00 WIB)</option>
          <option value="siang">SIANG (10:00 - 14:00 WIB)</option>
          <option value="sore">SORE (14:00 - 18:00 WIB)</option>
          <option value="malam">MALAM (18:00 - 22:00 WIB)</option>
        </select>
      </div>

      <!-- Latitude -->
      <div class="space-y-1.5">
        <label for="input-topsis-lat" class="block text-xs font-outfit-600 text-zinc-300 flex items-center gap-1.5">
          <MapPin class="w-3.5 h-3.5 text-[#FF634A]" /> Latitude Asal (Simulasi):
        </label>
        <input
          id="input-topsis-lat"
          type="text"
          bind:value={latInput}
          placeholder="-7.4478 (Hub Sidoarjo)"
          class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-mono focus:border-[#FF634A] focus:outline-none"
        />
      </div>

      <!-- Longitude -->
      <div class="space-y-1.5">
        <label for="input-topsis-lon" class="block text-xs font-outfit-600 text-zinc-300 flex items-center gap-1.5">
          <MapPin class="w-3.5 h-3.5 text-[#FF634A]" /> Longitude Asal (Simulasi):
        </label>
        <input
          id="input-topsis-lon"
          type="text"
          bind:value={lonInput}
          placeholder="112.7183 (Hub Sidoarjo)"
          class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-mono focus:border-[#FF634A] focus:outline-none"
        />
      </div>
    </div>
  </div>

  <!-- Feedback Alerts -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala Evaluasi TOPSIS">
      {errorMsg}
    </Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Hasil Simulasi">
      {successMsg}
    </Alert>
  {/if}

  <!-- RESULTS & MATHEMATICAL TRACEABILITY SECTION -->
  {#if simulationResult}
    <!-- Top Ranking Podium Cards -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Award class="w-4 h-4 text-[#FF634A]" /> Hasil Rekomendasi Peringkat Zona Teratas:
        </h4>
        <span class="text-xs text-[#71717A]">
          {simulationResult.total_evaluated_zones} Zona Dievaluasi • Versi {simulationResult.evaluation_version}
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each simulationResult.topsis_summary.rankings as rk, idx}
          <div class="p-4 sm:p-5 rounded-3xl border transition-all relative overflow-hidden
          {idx === 0 
            ? 'bg-gradient-to-b from-[#1E1924] to-[#131316] border-[#FF634A]/50 shadow-xl shadow-[#FF634A]/10' 
            : 'bg-[#131316] border-[#24242A] shadow-md'}">
            
            {#if idx === 0}
              <div class="absolute top-0 right-0 px-3 py-1 rounded-bl-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] text-[#09090B] text-[10px] font-outfit-600 font-bold uppercase tracking-wider">
                ★ Best Zone
              </div>
            {/if}

            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs
                {idx === 0 ? 'bg-[#FF634A] text-[#09090B]' : idx === 1 ? 'bg-zinc-200 text-[#09090B]' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-[#24242C] text-[#71717A]'}">
                  #{rk.rank}
                </span>
                <span class="text-xs font-outfit-600 text-white truncate max-w-[140px]">{rk.zone_name}</span>
              </div>

              <div class="pt-2 border-t border-[#24242A]">
                <div class="text-[10px] text-[#71717A] uppercase font-outfit-600">Skor Preferensi (C_i)</div>
                <div class="text-xl font-mono font-bold {idx === 0 ? 'text-[#FF634A]' : 'text-zinc-200'}">
                  {rk.preference_score.toFixed(4)}
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 text-[10px] text-[#A1A1AA] pt-1 font-mono">
                <div>D+: {(rk.d_pos || 0).toFixed(4)}</div>
                <div>D-: {(rk.d_neg || 0).toFixed(4)}</div>
              </div>

              <button
                type="button"
                onclick={() => (selectedExplainZone = rk)}
                class="w-full mt-2 py-1.5 px-2 rounded-xl bg-[#1F1F26] hover:bg-[#2B2B36] text-[10px] text-zinc-300 hover:text-white font-outfit-600 flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#2B2B36]"
              >
                <Sparkles class="w-3 h-3 text-[#FF634A]" />
                <span>Mengapa Zona Ini?</span>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- 6-STEP MATHEMATICAL TOPSIS TRACEABILITY TABS -->
    <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24242A]">
        <div>
          <h4 class="text-sm font-outfit-600 text-white">Traceability Matematis 6-Langkah TOPSIS</h4>
          <p class="text-xs text-[#A1A1AA]">Rincian matriks kalkulasi dari raw PostGIS hingga perankingan preferensi</p>
        </div>

        <!-- Step Selector Tabs -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onclick={() => (activeMatrixStep = 1)}
            class="px-2.5 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
            {activeMatrixStep === 1 ? 'bg-white text-[#09090B] font-bold' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
          >
            1. Matriks Raw (X)
          </button>

          <button
            type="button"
            onclick={() => (activeMatrixStep = 2)}
            class="px-2.5 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
            {activeMatrixStep === 2 ? 'bg-white text-[#09090B] font-bold' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
          >
            2. Ternormalisasi (R)
          </button>

          <button
            type="button"
            onclick={() => (activeMatrixStep = 3)}
            class="px-2.5 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
            {activeMatrixStep === 3 ? 'bg-white text-[#09090B] font-bold' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
          >
            3. Terbobot (V)
          </button>

          <button
            type="button"
            onclick={() => (activeMatrixStep = 4)}
            class="px-2.5 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
            {activeMatrixStep === 4 ? 'bg-white text-[#09090B] font-bold' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
          >
            4. Ideal (A+/A-)
          </button>

          <button
            type="button"
            onclick={() => (activeMatrixStep = 5)}
            class="px-2.5 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
            {activeMatrixStep === 5 ? 'bg-white text-[#09090B] font-bold' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
          >
            5. Separasi (D+/D-)
          </button>

          <button
            type="button"
            onclick={() => (activeMatrixStep = 6)}
            class="px-2.5 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
            {activeMatrixStep === 6 ? 'bg-white text-[#09090B] font-bold' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
          >
            6. Ranking (C_i)
          </button>
        </div>
      </div>

      <!-- Matrix Table Output based on activeMatrixStep -->
      <div class="rounded-2xl border border-[#24242A] overflow-x-auto bg-[#16161A]">
        <table class="w-full text-xs text-left min-w-[640px]">
          <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
            <tr>
              <th class="py-3 px-4">Zona Alternatif</th>
              {#if activeMatrixStep === 1}
                <th class="py-3 px-3 text-right">C1 (Densitas)</th>
                <th class="py-3 px-3 text-right">C2 (Diversitas)</th>
                <th class="py-3 px-3 text-right">C3 (Keramaian)</th>
                <th class="py-3 px-3 text-right">C4 (Cuaca)</th>
                <th class="py-3 px-3 text-right">C5 (Jarak KM)</th>
                <th class="py-3 px-3 text-right">C6 (Kompetitor)</th>
              {:else if activeMatrixStep === 2}
                <th class="py-3 px-3 text-right font-mono">r_1</th>
                <th class="py-3 px-3 text-right font-mono">r_2</th>
                <th class="py-3 px-3 text-right font-mono">r_3</th>
                <th class="py-3 px-3 text-right font-mono">r_4</th>
                <th class="py-3 px-3 text-right font-mono">r_5</th>
                <th class="py-3 px-3 text-right font-mono">r_6</th>
              {:else if activeMatrixStep === 3}
                <th class="py-3 px-3 text-right font-mono">v_1 (w1*r1)</th>
                <th class="py-3 px-3 text-right font-mono">v_2 (w2*r2)</th>
                <th class="py-3 px-3 text-right font-mono">v_3 (w3*r3)</th>
                <th class="py-3 px-3 text-right font-mono">v_4 (w4*r4)</th>
                <th class="py-3 px-3 text-right font-mono">v_5 (w5*r5)</th>
                <th class="py-3 px-3 text-right font-mono">v_6 (w6*r6)</th>
              {:else if activeMatrixStep === 4}
                <th class="py-3 px-3 text-right">Tipe Solusi</th>
                <th class="py-3 px-3 text-right font-mono">C1 (Ben)</th>
                <th class="py-3 px-3 text-right font-mono">C2 (Ben)</th>
                <th class="py-3 px-3 text-right font-mono">C3 (Ben)</th>
                <th class="py-3 px-3 text-right font-mono">C4 (Cost)</th>
                <th class="py-3 px-3 text-right font-mono">C5 (Cost)</th>
                <th class="py-3 px-3 text-right font-mono">C6 (Cost)</th>
              {:else if activeMatrixStep === 5}
                <th class="py-3 px-4 text-right">Separasi Positif (D+)</th>
                <th class="py-3 px-4 text-right">Separasi Negatif (D-)</th>
                <th class="py-3 px-4 text-right font-mono">Total (D+ + D-)</th>
              {:else}
                <th class="py-3 px-4 text-center">Peringkat</th>
                <th class="py-3 px-4 text-right">Skor Preferensi (C_i)</th>
                <th class="py-3 px-4 text-right font-mono">D+ Positif</th>
                <th class="py-3 px-4 text-right font-mono">D- Negatif</th>
              {/if}
            </tr>
          </thead>
          <tbody class="divide-y divide-[#24242A]">
            {#if activeMatrixStep === 4}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-outfit-600 text-emerald-400">Solusi Ideal Positif (A+)</td>
                <td class="py-3 px-3 text-right text-emerald-300 font-mono">Maks / Min</td>
                {#each ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as code}
                  <td class="py-3 px-3 text-right font-mono text-emerald-400 font-bold">
                    {(simulationResult.topsis_summary.ideal_positive[code] || 0).toFixed(4)}
                  </td>
                {/each}
              </tr>
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-outfit-600 text-rose-400">Solusi Ideal Negatif (A-)</td>
                <td class="py-3 px-3 text-right text-rose-300 font-mono">Min / Maks</td>
                {#each ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as code}
                  <td class="py-3 px-3 text-right font-mono text-rose-400 font-bold">
                    {(simulationResult.topsis_summary.ideal_negative[code] || 0).toFixed(4)}
                  </td>
                {/each}
              </tr>
            {:else}
              {#each simulationResult.topsis_summary.rankings as rk}
                {@const trace = rk.traceability || { raw_criteria: {}, normalized_r: {}, weighted_v: {} }}
                <tr class="hover:bg-[#1D1D24] transition-colors">
                  <td class="py-3 px-4 font-outfit-600 text-white flex items-center gap-2">
                    <span class="w-5 h-5 rounded-md bg-[#24242C] text-[10px] font-mono flex items-center justify-center text-[#FF634A]">
                      #{rk.rank}
                    </span>
                    <span>{rk.zone_name}</span>
                  </td>

                  {#if activeMatrixStep === 1}
                    <td class="py-3 px-3 text-right font-mono text-zinc-300">{trace.raw_criteria?.C1?.raw_value ?? 0} POI</td>
                    <td class="py-3 px-3 text-right font-mono text-zinc-300">{trace.raw_criteria?.C2?.raw_value ?? 0} Kat</td>
                    <td class="py-3 px-3 text-right font-mono text-zinc-300">{(trace.raw_criteria?.C3?.raw_value ?? 0).toFixed(1)}</td>
                    <td class="py-3 px-3 text-right font-mono text-zinc-300">{trace.raw_criteria?.C4?.raw_value ?? 0}%</td>
                    <td class="py-3 px-3 text-right font-mono text-zinc-300">{(trace.raw_criteria?.C5?.raw_value ?? 0).toFixed(2)} km</td>
                    <td class="py-3 px-3 text-right font-mono text-zinc-300">{trace.raw_criteria?.C6?.raw_value ?? 0}</td>
                  {:else if activeMatrixStep === 2}
                    {#each ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as code}
                      <td class="py-3 px-3 text-right font-mono text-blue-300">
                        {(trace.normalized_r?.[code] ?? 0).toFixed(4)}
                      </td>
                    {/each}
                  {:else if activeMatrixStep === 3}
                    {#each ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as code}
                      <td class="py-3 px-3 text-right font-mono text-purple-300">
                        {(trace.weighted_v?.[code] ?? 0).toFixed(4)}
                      </td>
                    {/each}
                  {:else if activeMatrixStep === 5}
                    <td class="py-3 px-4 text-right font-mono text-zinc-300 font-bold">{(rk.d_pos || 0).toFixed(4)}</td>
                    <td class="py-3 px-4 text-right font-mono text-zinc-300 font-bold">{(rk.d_neg || 0).toFixed(4)}</td>
                    <td class="py-3 px-4 text-right font-mono text-zinc-400">{((rk.d_pos || 0) + (rk.d_neg || 0)).toFixed(4)}</td>
                  {:else}
                    <td class="py-3 px-4 text-center">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 font-bold
                      {rk.rank === 1 ? 'bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30' : 'bg-zinc-800 text-zinc-300'}">
                        Peringkat #{rk.rank}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-sm text-[#FF634A]">
                      {rk.preference_score.toFixed(4)}
                    </td>
                    <td class="py-3 px-4 text-right font-mono text-[#A1A1AA]">{(rk.d_pos || 0).toFixed(4)}</td>
                    <td class="py-3 px-4 text-right font-mono text-[#A1A1AA]">{(rk.d_neg || 0).toFixed(4)}</td>
                  {/if}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- HISTORICAL SNAPSHOTS LOG TABLE -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-4">
    <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
      <div class="flex items-center gap-2">
        <History class="w-4 h-4 text-purple-400" />
        <h4 class="text-sm font-outfit-600 text-white">Riwayat Snapshot Eksekusi DSS (Audit Log)</h4>
      </div>
      <span class="text-xs text-[#71717A]">{snapshots.length} Snapshot Tersimpan</span>
    </div>

    {#if snapshots.length === 0}
      <div class="p-6 text-center text-xs text-[#71717A]">
        Belum ada riwayat snapshot evaluasi. Jalankan simulasi untuk merekam snapshot pertama.
      </div>
    {:else}
      <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
        <table class="w-full text-xs text-left">
          <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
            <tr>
              <th class="py-3 px-4">Waktu Eksekusi</th>
              <th class="py-3 px-3 text-center">Slot Waktu</th>
              <th class="py-3 px-4">Profil Bobot</th>
              <th class="py-3 px-3 text-center">Rasio CR</th>
              <th class="py-3 px-4">Zona Juara (#1)</th>
              <th class="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#24242A]">
            {#each snapshots as snap}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-mono text-zinc-300">
                  {new Date(snap.created_at).toLocaleString('id-ID')}
                </td>

                <td class="py-3 px-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 uppercase bg-[#24242C] text-amber-300">
                    {snap.time_slot}
                  </span>
                </td>

                <td class="py-3 px-4 text-zinc-300 truncate max-w-[160px]">
                  {snap.bwm_config_name}
                </td>

                <td class="py-3 px-3 text-center font-mono text-emerald-400">
                  {(snap.consistency_ratio || 0).toFixed(4)}
                </td>

                <td class="py-3 px-4 font-outfit-600 text-white">
                  <span class="text-[#FF634A] mr-1">★</span> {snap.top_ranking_zone}
                </td>

                <td class="py-3 px-4 text-center">
                  <button
                    type="button"
                    onclick={() => handleViewSnapshot(snap)}
                    class="px-3 py-1 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-200 hover:text-white border border-[#2E2E38] text-[11px] font-outfit-600 transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Buka Detail</span>
                    <ArrowUpRight class="w-3 h-3" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- MODAL: EXPLAINABILITY ("WHY THIS ZONE?") -->
{#if selectedExplainZone}
  {@const raw = selectedExplainZone.traceability?.raw_criteria || {}}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-outfit-400">
    <button
      type="button"
      aria-label="Tutup modal"
      class="fixed inset-0 bg-black/50 border-0 p-0 m-0 cursor-default"
      onclick={() => (selectedExplainZone = null)}
    ></button>

    <div class="relative w-full max-w-lg bg-[#131316] border border-[#2E2E38] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center font-bold">
            #{selectedExplainZone.rank}
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Mengapa Zona Ini Direkomendasikan?</h3>
            <p class="text-xs text-[#A1A1AA]">{selectedExplainZone.zone_name} • Skor C* = {selectedExplainZone.preference_score.toFixed(4)}</p>
          </div>
        </div>

        <button
          onclick={() => (selectedExplainZone = null)}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Breakdown Bars for 6 Criteria -->
      <div class="space-y-3 text-xs">
        <h4 class="font-outfit-600 text-zinc-300 uppercase text-[11px] tracking-wider">Kekuatan & Evaluasi Kriteria:</h4>

        <div class="space-y-2">
          <!-- C1 Densitas -->
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex items-center justify-between">
            <div>
              <span class="font-outfit-600 text-white block">C1. Densitas POI (Benefit)</span>
              <span class="text-[10px] text-zinc-400">Total entitas keramaian di zona</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-emerald-400 font-bold">{raw.C1?.raw_value ?? 0} POI</span>
              <span class="text-[10px] text-zinc-500 block">Sangat Baik</span>
            </div>
          </div>

          <!-- C2 Diversitas -->
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex items-center justify-between">
            <div>
              <span class="font-outfit-600 text-white block">C2. Diversitas POI (Benefit)</span>
              <span class="text-[10px] text-zinc-400">Variasi kategori magnet aktivitas</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-blue-400 font-bold">{raw.C2?.raw_value ?? 0} Kategori</span>
              <span class="text-[10px] text-zinc-500 block">Tinggi</span>
            </div>
          </div>

          <!-- C3 Keramaian Waktu -->
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex items-center justify-between">
            <div>
              <span class="font-outfit-600 text-white block">C3. Keramaian Waktu (Benefit)</span>
              <span class="text-[10px] text-zinc-400">Peluang traffic jam operasional {timeSlot.toUpperCase()}</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-amber-400 font-bold">{(raw.C3?.raw_value ?? 0).toFixed(1)} / 10</span>
              <span class="text-[10px] text-zinc-500 block">Potensial</span>
            </div>
          </div>

          <!-- C4 Risiko Cuaca -->
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex items-center justify-between">
            <div>
              <span class="font-outfit-600 text-white block">C4. Risiko Cuaca / Presipitasi (Cost)</span>
              <span class="text-[10px] text-zinc-400">Prakiraan curah hujan Open-Meteo</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-cyan-400 font-bold">{raw.C4?.raw_value ?? 0}%</span>
              <span class="text-[10px] text-zinc-500 block">Risiko Rendah</span>
            </div>
          </div>

          <!-- C5 Jarak Aksesibilitas -->
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex items-center justify-between">
            <div>
              <span class="font-outfit-600 text-white block">C5. Jarak Aksesibilitas Hub (Cost)</span>
              <span class="text-[10px] text-zinc-400">Jarak tempuh geodetik dari markas</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-purple-400 font-bold">{(raw.C5?.raw_value ?? 0).toFixed(2)} KM</span>
              <span class="text-[10px] text-zinc-500 block">Dalam Jangkauan</span>
            </div>
          </div>

          <!-- C6 Kompetitor -->
          <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex items-center justify-between">
            <div>
              <span class="font-outfit-600 text-white block">C6. Kepadatan Kompetitor (Cost)</span>
              <span class="text-[10px] text-zinc-400">Jumlah kedai kopi / pesaing terdekat</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-rose-400 font-bold">{raw.C6?.raw_value ?? 0} Pesaing</span>
              <span class="text-[10px] text-zinc-500 block">Terkendali</span>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-[#24242A] flex justify-end">
        <button
          type="button"
          onclick={() => (selectedExplainZone = null)}
          class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-white text-xs font-outfit-600 transition-colors cursor-pointer"
        >
          Tutup Rincian
        </button>
      </div>
    </div>
  </div>
{/if}
