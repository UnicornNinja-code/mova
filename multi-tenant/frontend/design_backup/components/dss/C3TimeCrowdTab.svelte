<script lang="ts">
  import { onMount } from 'svelte';
  import { poiCategoryService, type PoiCategory, type PoiTimeScores } from '../../services/poiCategoryService';
  import { 
    Clock, 
    Save, 
    Sparkles, 
    Layers, 
    ShieldCheck, 
    Info, 
    Check, 
    Sun, 
    Moon, 
    Sunset, 
    Sunrise, 
    RotateCcw,
    Zap,
    Tag
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  let loading = $state(true);
  let saving = $state(false);
  let categories = $state<PoiCategory[]>([]);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let searchQuery = $state('');
  let activeFilter = $state<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const loadCategories = async () => {
    loading = true;
    errorMsg = null;
    try {
      const data = await poiCategoryService.getAllCategories();
      // Ensure time_scores defaults exist
      categories = data.map((c) => ({
        ...c,
        time_scores: c.time_scores || { pagi: 1, siang: 1, sore: 1, malam: 1 },
      }));
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat kategori POI.';
    } finally {
      loading = false;
    }
  };

  const handleScoreChange = (catId: number | string, slot: keyof PoiTimeScores, value: number) => {
    const clamped = Math.max(0, Math.min(5, parseFloat(value.toFixed(1)) || 0));
    categories = categories.map((c) => {
      if (c.id === catId) {
        return {
          ...c,
          time_scores: {
            ...c.time_scores,
            [slot]: clamped,
          },
        };
      }
      return c;
    });
  };

  const handleToggleStatus = async (cat: PoiCategory) => {
    try {
      await poiCategoryService.toggleCategoryStatus(cat.id);
      categories = categories.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
      successMsg = `Status kategori "${cat.name}" berhasil diubah.`;
      setTimeout(() => (successMsg = null), 2500);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal mengubah status kategori.';
    }
  };

  const applyPreset = (presetName: string) => {
    categories = categories.map((c) => {
      let scores: PoiTimeScores = { pagi: 1, siang: 1, sore: 1, malam: 1 };
      const name = c.name.toLowerCase();

      if (presetName === 'OFFICE_PEAK') {
        if (name.includes('kantor') || name.includes('gedung') || name.includes('perbankan') || name.includes('stasiun')) {
          scores = { pagi: 4.5, siang: 4.0, sore: 3.0, malam: 1.0 };
        } else if (name.includes('kafe') || name.includes('kuliner') || name.includes('restoran')) {
          scores = { pagi: 1.5, siang: 4.0, sore: 3.5, malam: 4.0 };
        } else {
          scores = { pagi: 2.0, siang: 2.5, sore: 2.0, malam: 1.5 };
        }
      } else if (presetName === 'NIGHT_CULINARY') {
        if (name.includes('kafe') || name.includes('kuliner') || name.includes('taman') || name.includes('belanja') || name.includes('hiburan')) {
          scores = { pagi: 1.0, siang: 2.0, sore: 4.0, malam: 5.0 };
        } else if (name.includes('kantor') || name.includes('sekolah') || name.includes('kampus')) {
          scores = { pagi: 3.5, siang: 3.0, sore: 1.5, malam: 0.5 };
        } else {
          scores = { pagi: 1.5, siang: 2.0, sore: 3.0, malam: 3.5 };
        }
      } else {
        // BALANCED DEFAULT
        scores = { pagi: 2.5, siang: 2.5, sore: 2.5, malam: 2.5 };
      }

      return { ...c, time_scores: scores };
    });

    successMsg = `Preset pola keramaian "${presetName}" berhasil diaplikasikan ke tabel. Klik Simpan untuk memperbarui database.`;
    setTimeout(() => (successMsg = null), 3500);
  };

  const handleSaveAll = async () => {
    saving = true;
    errorMsg = null;
    successMsg = null;
    try {
      const payload = categories.map((c) => ({
        id: c.id,
        time_scores: c.time_scores,
      }));
      await poiCategoryService.bulkUpdateTimeScores(payload);
      successMsg = '✅ Seluruh matriks skor keramaian waktu C3 berhasil disimpan ke database!';
      setTimeout(() => (successMsg = null), 4000);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan matriks keramaian C3.';
    } finally {
      saving = false;
    }
  };

  const filteredCategories = $derived(
    categories.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = activeFilter === 'ALL' || (activeFilter === 'ACTIVE' && c.is_active) || (activeFilter === 'INACTIVE' && !c.is_active);
      return matchSearch && matchFilter;
    })
  );

  onMount(() => {
    loadCategories();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- 1. EXPLICIT AUTOMATION BANNER FOR C1 & C2 (NO MANUAL INPUT REQUIRED) -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-3 relative overflow-hidden">
    <div class="absolute -top-12 -right-12 w-48 h-48 bg-blue-950/30 rounded-full blur-2xl pointer-events-none"></div>

    <div class="flex items-start gap-4 relative z-10">
      <div class="w-12 h-12 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-blue-400 flex items-center justify-center shrink-0 shadow-md">
        <ShieldCheck class="w-6 h-6" />
      </div>

      <div class="space-y-1.5 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-sm sm:text-base font-outfit-600 text-white">
            Otomatisasi Kriteria Spasial C1 (Densitas) & C2 (Diversitas)
          </h3>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-blue-950/40 text-blue-300 border border-blue-800/40">
            PostGIS Automated Layer
          </span>
        </div>
        <p class="text-xs text-[#A1A1AA] leading-relaxed">
          Kriteria <strong class="text-white">C1 (Densitas POI)</strong> dan <strong class="text-white">C2 (Diversitas POI)</strong> dievaluasi <strong class="text-blue-300">100% secara otomatis oleh database spasial PostGIS</strong> melalui irisan poligon zona operasional terhadap seluruh titik POI terverifikasi. Anda tidak perlu memasukkan nilai C1 dan C2 secara manual.
        </p>
      </div>
    </div>
  </div>

  <!-- Feedback Alerts -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala Konfigurasi C3">
      {errorMsg}
    </Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Berhasil">
      {successMsg}
    </Alert>
  {/if}

  <!-- 2. C3 TIME-CROWD MATRIX CONFIGURATION PANEL -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-400 flex items-center justify-center shadow-md">
          <Clock class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm sm:text-base font-outfit-600 text-white">
            Konfigurasi Kriteria C3: Matriks Keramaian Berbasis Waktu
          </h3>
          <p class="text-xs text-[#A1A1AA]">
            Tentukan multiplier potensi keramaian (skala 0.0 - 5.0) untuk tiap kategori POI pada 4 slot waktu operasional.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={handleSaveAll}
          disabled={saving || loading}
          class="pill-btn-orange text-xs font-outfit-600 disabled:opacity-50 cursor-pointer"
        >
          <span class="px-4 py-2 flex items-center gap-1.5 text-white font-bold">
            <Save class="w-3.5 h-3.5" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Seluruh Matriks C3'}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Quick Presets Bar -->
    <div class="p-4 bg-[#1A1A1F] rounded-2xl border border-[#272730] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#D4D4D8]">
        <Zap class="w-4 h-4 text-amber-400" />
        <span>Pola Keramaian Standar (Preset Cepat):</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onclick={() => applyPreset('OFFICE_PEAK')}
          class="px-3 py-1.5 rounded-xl bg-[#24242C] hover:bg-[#2F2F3A] text-zinc-200 hover:text-white border border-[#33333E] text-xs font-outfit-600 transition-all cursor-pointer"
        >
          🏢 Dominan Perkantoran (Pagi/Siang)
        </button>

        <button
          type="button"
          onclick={() => applyPreset('NIGHT_CULINARY')}
          class="px-3 py-1.5 rounded-xl bg-[#24242C] hover:bg-[#2F2F3A] text-zinc-200 hover:text-white border border-[#33333E] text-xs font-outfit-600 transition-all cursor-pointer"
        >
          🌙 Wisata Kuliner (Sore/Malam)
        </button>

        <button
          type="button"
          onclick={() => applyPreset('BALANCED')}
          class="px-3 py-1.5 rounded-xl bg-[#24242C] hover:bg-[#2F2F3A] text-zinc-200 hover:text-white border border-[#33333E] text-xs font-outfit-600 transition-all cursor-pointer"
        >
          ⚖️ Standar Rata-Rata (2.5)
        </button>
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="relative flex-1 max-w-sm">
        <input
          type="text"
          placeholder="Cari kategori POI (misal: Kafe, Kampus, Stasiun)..."
          bind:value={searchQuery}
          class="w-full pl-3.5 pr-4 py-2 text-xs bg-[#1A1A1F] border border-[#2E2E38] rounded-2xl text-white placeholder-[#71717A] focus:border-[#FF634A] focus:outline-none"
        />
      </div>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onclick={() => (activeFilter = 'ALL')}
          class="px-3 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
          {activeFilter === 'ALL' ? 'bg-white text-[#09090B] font-bold shadow-xs' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
        >
          Semua ({categories.length})
        </button>

        <button
          type="button"
          onclick={() => (activeFilter = 'ACTIVE')}
          class="px-3 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
          {activeFilter === 'ACTIVE' ? 'bg-white text-[#09090B] font-bold shadow-xs' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
        >
          Aktif ({categories.filter((c) => c.is_active).length})
        </button>

        <button
          type="button"
          onclick={() => (activeFilter = 'INACTIVE')}
          class="px-3 py-1 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer
          {activeFilter === 'INACTIVE' ? 'bg-white text-[#09090B] font-bold shadow-xs' : 'bg-[#1A1A1F] text-[#A1A1AA] hover:text-white border border-[#2E2E38]'}"
        >
          Nonaktif ({categories.filter((c) => !c.is_active).length})
        </button>
      </div>
    </div>

    <!-- 17+ POI Categories Matrix Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Kategori POI</th>
            <th class="py-3 px-4 text-center">Status</th>
            <th class="py-3 px-3 text-center">
              <span class="inline-flex items-center gap-1 text-amber-400">
                <Sunrise class="w-3.5 h-3.5" /> Pagi (06-10)
              </span>
            </th>
            <th class="py-3 px-3 text-center">
              <span class="inline-flex items-center gap-1 text-orange-400">
                <Sun class="w-3.5 h-3.5" /> Siang (10-14)
              </span>
            </th>
            <th class="py-3 px-3 text-center">
              <span class="inline-flex items-center gap-1 text-rose-400">
                <Sunset class="w-3.5 h-3.5" /> Sore (14-18)
              </span>
            </th>
            <th class="py-3 px-3 text-center">
              <span class="inline-flex items-center gap-1 text-indigo-400">
                <Moon class="w-3.5 h-3.5" /> Malam (18-22)
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="6" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat daftar kategori POI...</div>
              </td>
            </tr>
          {:else if filteredCategories.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-xs text-[#71717A]">
                Tidak ada kategori POI yang sesuai kriteria pencarian.
              </td>
            </tr>
          {:else}
            {#each filteredCategories as cat}
              <tr class="hover:bg-[#1D1D24] transition-colors {cat.is_active ? '' : 'opacity-50'}">
                <td class="py-3 px-4 font-outfit-600 text-white">
                  <div class="flex items-center gap-2">
                    <Tag class="w-3.5 h-3.5 text-[#FF634A]" />
                    <span>{cat.name}</span>
                  </div>
                </td>

                <td class="py-3 px-4 text-center">
                  <button
                    type="button"
                    onclick={() => handleToggleStatus(cat)}
                    class="px-2.5 py-1 rounded-full text-[10px] font-outfit-600 border transition-all cursor-pointer
                    {cat.is_active ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}"
                  >
                    {cat.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>

                <!-- Pagi Input -->
                <td class="py-3 px-3 text-center">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={cat.time_scores.pagi}
                    onchange={(e) => handleScoreChange(cat.id, 'pagi', parseFloat(e.currentTarget.value))}
                    class="w-16 py-1 px-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-center font-mono text-amber-300 font-bold text-xs focus:border-[#FF634A] focus:outline-none"
                  />
                </td>

                <!-- Siang Input -->
                <td class="py-3 px-3 text-center">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={cat.time_scores.siang}
                    onchange={(e) => handleScoreChange(cat.id, 'siang', parseFloat(e.currentTarget.value))}
                    class="w-16 py-1 px-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-center font-mono text-orange-300 font-bold text-xs focus:border-[#FF634A] focus:outline-none"
                  />
                </td>

                <!-- Sore Input -->
                <td class="py-3 px-3 text-center">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={cat.time_scores.sore}
                    onchange={(e) => handleScoreChange(cat.id, 'sore', parseFloat(e.currentTarget.value))}
                    class="w-16 py-1 px-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-center font-mono text-rose-300 font-bold text-xs focus:border-[#FF634A] focus:outline-none"
                  />
                </td>

                <!-- Malam Input -->
                <td class="py-3 px-3 text-center">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={cat.time_scores.malam}
                    onchange={(e) => handleScoreChange(cat.id, 'malam', parseFloat(e.currentTarget.value))}
                    class="w-16 py-1 px-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-center font-mono text-indigo-300 font-bold text-xs focus:border-[#FF634A] focus:outline-none"
                  />
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
