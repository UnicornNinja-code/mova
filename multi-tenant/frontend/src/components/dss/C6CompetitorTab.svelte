<script lang="ts">
  import { onMount } from 'svelte';
  import { competitorService, type CompetitorItem, type ZoneC6ScoreResponse } from '../../services/competitorService';
  import { axiosInstance } from '../../lib/axios';
  import { 
    Users, 
    Plus, 
    Trash2, 
    ShieldAlert, 
    MapPin, 
    Coffee, 
    Filter, 
    CheckCircle2, 
    AlertCircle, 
    Sparkles, 
    Search,
    Store
  } from 'lucide-svelte';
  import Alert from '../ui/Alert.svelte';

  interface ZoneOption {
    id: number | string;
    name: string;
  }

  let loading = $state(true);
  let competitors = $state<CompetitorItem[]>([]);
  let zones = $state<ZoneOption[]>([]);
  let selectedZoneId = $state<string>(''); // empty string = ALL ZONES
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let searchQuery = $state('');

  let zoneScoreData = $state<ZoneC6ScoreResponse | null>(null);
  let addModalOpen = $state(false);
  let submitting = $state(false);

  // Form State
  let formZoneId = $state('');
  let formName = $state('');
  let formCategory = $state('DIRECT_STARLING');
  let formLat = $state('');
  let formLon = $state('');

  const loadZones = async () => {
    try {
      const res = await axiosInstance.get('/zones');
      const data = res.data?.zones || res.data?.data || res.data || [];
      zones = data.map((z: any) => ({ id: z.id, name: z.name }));
      if (zones.length > 0 && !formZoneId) {
        formZoneId = String(zones[0].id);
      }
    } catch (err) {
      console.warn('Gagal memuat zona:', err);
    }
  };

  const loadCompetitors = async () => {
    loading = true;
    errorMsg = null;
    try {
      const data = await competitorService.getAllCompetitors(selectedZoneId || undefined);
      competitors = data;

      if (selectedZoneId) {
        const score = await competitorService.getZoneC6Score(selectedZoneId);
        zoneScoreData = score;
      } else {
        zoneScoreData = null;
      }
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat data kompetitor.';
    } finally {
      loading = false;
    }
  };

  const handleZoneFilterChange = (newZoneId: string) => {
    selectedZoneId = newZoneId;
    loadCompetitors();
  };

  const handleDeleteCompetitor = async (id: number | string, name: string) => {
    if (!confirm(`Hapus data survei kompetitor "${name}"?`)) return;
    try {
      await competitorService.deleteCompetitor(id);
      competitors = competitors.filter((c) => c.id !== id);
      successMsg = `Data kompetitor "${name}" berhasil dihapus.`;
      setTimeout(() => (successMsg = null), 2500);
      if (selectedZoneId) {
        zoneScoreData = await competitorService.getZoneC6Score(selectedZoneId);
      }
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal menghapus kompetitor.';
    }
  };

  const handleCreateCompetitor = async (e: Event) => {
    e.preventDefault();
    if (!formName.trim() || !formZoneId) {
      errorMsg = 'Nama kompetitor dan Zona wajib diisi.';
      return;
    }

    submitting = true;
    errorMsg = null;

    try {
      await competitorService.createCompetitor({
        zone_id: formZoneId,
        name: formName.trim(),
        category: formCategory,
        latitude: formLat ? parseFloat(formLat) : null,
        longitude: formLon ? parseFloat(formLon) : null,
      });

      successMsg = `Kompetitor "${formName}" berhasil ditambahkan ke zona.`;
      addModalOpen = false;
      formName = '';
      formLat = '';
      formLon = '';
      await loadCompetitors();
      setTimeout(() => (successMsg = null), 3000);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menambahkan kompetitor.';
    } finally {
      submitting = false;
    }
  };

  const filteredCompetitors = $derived(
    competitors.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.zone_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    })
  );

  const totalScoreC6 = $derived(
    competitors.reduce((acc, curr) => acc + (curr.weight || 1), 0)
  );

  onMount(async () => {
    await loadZones();
    await loadCompetitors();
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- Top KPI Cards for C6 Metrics -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Total Entitas Kompetitor</span>
        <Store class="w-4 h-4 text-rose-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-white font-mono">
        {competitors.length} <span class="text-xs text-[#A1A1AA] font-normal">Titik</span>
      </div>
      <span class="text-[11px] text-[#A1A1AA] block">Survei Lapangan & POI Kopi</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Indeks Beban Biaya C6</span>
        <ShieldAlert class="w-4 h-4 text-amber-400" />
      </div>
      <div class="text-2xl font-outfit-600 text-amber-400 font-mono">
        {totalScoreC6} <span class="text-xs text-[#A1A1AA] font-normal">Poin Indeks</span>
      </div>
      <span class="text-[11px] text-[#A1A1AA] block">Kriteria Cost (Penalti Persaingan)</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Kopi Keliling (Starling)</span>
        <span class="px-2 py-0.5 rounded-md bg-rose-950/40 text-rose-300 text-[10px] font-mono border border-rose-800/40">Bobot 3</span>
      </div>
      <div class="text-2xl font-outfit-600 text-rose-400 font-mono">
        {competitors.filter((c) => c.category === 'DIRECT_STARLING').length}
      </div>
      <span class="text-[11px] text-rose-400/80 block">Kompetitor Langsung Terkuat</span>
    </div>

    <div class="p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs font-outfit-600 text-[#71717A] uppercase">
        <span>Kedai Takeaway / Kafe</span>
        <span class="px-2 py-0.5 rounded-md bg-blue-950/40 text-blue-300 text-[10px] font-mono border border-blue-800/40">Bobot 1-2</span>
      </div>
      <div class="text-2xl font-outfit-600 text-blue-400 font-mono">
        {competitors.filter((c) => c.category !== 'DIRECT_STARLING').length}
      </div>
      <span class="text-[11px] text-blue-400/80 block">Kompetitor Tidak Langsung</span>
    </div>
  </div>

  <!-- Feedback Alerts -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala Kompetitor C6">
      {errorMsg}
    </Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Berhasil">
      {successMsg}
    </Alert>
  {/if}

  <!-- MAIN TABLE CONTAINER -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
      <div>
        <h3 class="text-sm sm:text-base font-outfit-600 text-white">
          Konfigurasi Kriteria C6: Pemetaan & Survei Lapangan Kompetitor
        </h3>
        <p class="text-xs text-[#A1A1AA] mt-0.5">
          Kelola titik kompetitor kopi keliling dan kedai kopi untuk kalkulasi indeks ancaman zona.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => (addModalOpen = true)}
          class="pill-btn-orange text-xs font-outfit-600 cursor-pointer"
        >
          <span class="px-4 py-2 flex items-center gap-1.5 text-white font-bold">
            <Plus class="w-4 h-4" />
            <span>Tambah Data Kompetitor</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 flex-1">
        <!-- Zone Filter -->
        <div class="flex items-center gap-2">
          <label for="select-zone-filter" class="text-xs font-outfit-600 text-[#71717A] flex items-center gap-1">
            <Filter class="w-3.5 h-3.5" /> Zona:
          </label>
          <select
            id="select-zone-filter"
            value={selectedZoneId}
            onchange={(e) => handleZoneFilterChange(e.currentTarget.value)}
            class="px-3 py-1.5 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
          >
            <option value="">Semua Zona Operasional</option>
            {#each zones as z}
              <option value={String(z.id)}>{z.name}</option>
            {/each}
          </select>
        </div>

        <!-- Search Input -->
        <div class="relative max-w-xs flex-1">
          <input
            type="text"
            placeholder="Cari nama kompetitor..."
            bind:value={searchQuery}
            class="w-full pl-3.5 pr-4 py-1.5 text-xs bg-[#1A1A1F] border border-[#2E2E38] rounded-xl text-white placeholder-[#71717A] focus:border-[#FF634A] focus:outline-none"
          />
        </div>
      </div>

      {#if zoneScoreData}
        <div class="p-2 px-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-mono flex items-center gap-2">
          <span>Skor C6 Zona Terpilih:</span>
          <span class="text-white font-bold">{zoneScoreData.skor_c6} Poin</span>
        </div>
      {/if}
    </div>

    <!-- Competitors List Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Nama Kompetitor</th>
            <th class="py-3 px-4">Zona Wilayah</th>
            <th class="py-3 px-4">Kategori / Segmen</th>
            <th class="py-3 px-3 text-center">Bobot Ancaman</th>
            <th class="py-3 px-3">Koordinat</th>
            <th class="py-3 px-4 text-center">Sumber</th>
            <th class="py-3 px-4 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat data sebaran kompetitor...</div>
              </td>
            </tr>
          {:else if filteredCompetitors.length === 0}
            <tr>
              <td colspan="7" class="py-8 text-center text-xs text-[#71717A]">
                Belum ada data kompetitor pada zona ini. Klik "+ Tambah Data Kompetitor" untuk mendaftarkan survei baru.
              </td>
            </tr>
          {:else}
            {#each filteredCompetitors as comp}
              <tr class="hover:bg-[#1D1D24] transition-colors">
                <td class="py-3 px-4 font-outfit-600 text-white flex items-center gap-2">
                  <Coffee class="w-4 h-4 text-[#FF634A] shrink-0" />
                  <span>{comp.name}</span>
                </td>

                <td class="py-3 px-4 text-zinc-300">
                  {comp.zone_name || `Zona ID #${comp.zone_id}`}
                </td>

                <td class="py-3 px-4">
                  {#if comp.category === 'DIRECT_STARLING'}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-rose-950/40 text-rose-300 border border-rose-800/40">
                      Direct Starling
                    </span>
                  {:else if comp.category === 'LOW_PRICE_TAKEAWAY'}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-amber-950/40 text-amber-300 border border-amber-800/40">
                      Takeaway Kiosk
                    </span>
                  {:else}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-blue-950/40 text-blue-300 border border-blue-800/40">
                      Cafe / Premium
                    </span>
                  {/if}
                </td>

                <td class="py-3 px-3 text-center font-mono font-bold text-sm {comp.weight === 3 ? 'text-rose-400' : comp.weight === 2 ? 'text-amber-400' : 'text-blue-400'}">
                  {comp.weight}
                </td>

                <td class="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                  {#if comp.latitude && comp.longitude}
                    <div class="flex items-center gap-1">
                      <MapPin class="w-3 h-3 text-[#FF634A]" />
                      <span>{Number(comp.latitude).toFixed(4)}, {Number(comp.longitude).toFixed(4)}</span>
                    </div>
                  {:else}
                    <span>Centroid Zona</span>
                  {/if}
                </td>

                <td class="py-3 px-4 text-center">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-mono {comp.source === 'POI_AUTOMATED' ? 'bg-purple-950/40 text-purple-300 border border-purple-800/40' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}">
                    {comp.source || 'SURVEY'}
                  </span>
                </td>

                <td class="py-3 px-4 text-center">
                  {#if comp.source !== 'POI_AUTOMATED'}
                    <button
                      type="button"
                      onclick={() => handleDeleteCompetitor(comp.id, comp.name)}
                      class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Hapus data survei"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  {:else}
                    <span class="text-[10px] text-[#71717A]">POI Layer</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- MODAL: TAMBAH DATA KOMPETITOR LAPANGAN -->
{#if addModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <button
      type="button"
      aria-label="Tutup modal tambah kompetitor"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={() => (addModalOpen = false)}
    ></button>

    <div class="relative w-full max-w-md bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <div class="flex items-center gap-3 pb-3 border-b border-[#24242A]">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/20">
          <Plus class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-outfit-600 text-white">Tambah Data Kompetitor Lapangan</h3>
          <p class="text-xs text-[#A1A1AA]">Hasil survei gerobak / kedai kopi di zona</p>
        </div>
      </div>

      <form onsubmit={handleCreateCompetitor} class="space-y-4 text-xs">
        <!-- Zone Selection -->
        <div class="space-y-1.5">
          <label for="form-zone-id" class="block font-outfit-600 text-zinc-300">
            Zona Operasional <span class="text-[#FF634A]">*</span>
          </label>
          <select
            id="form-zone-id"
            bind:value={formZoneId}
            required
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
          >
            {#each zones as z}
              <option value={String(z.id)}>{z.name}</option>
            {/each}
          </select>
        </div>

        <!-- Competitor Name -->
        <div class="space-y-1.5">
          <label for="form-competitor-name" class="block font-outfit-600 text-zinc-300">
            Nama Kompetitor / Merek <span class="text-[#FF634A]">*</span>
          </label>
          <input
            id="form-competitor-name"
            type="text"
            placeholder="Contoh: Kopi Keliling Starling Bang Jack"
            bind:value={formName}
            required
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-400 focus:border-[#FF634A] focus:outline-none"
          />
        </div>

        <!-- Category & Threat Weight -->
        <div class="space-y-1.5">
          <label for="form-competitor-category" class="block font-outfit-600 text-zinc-300">
            Kategori & Tingkat Ancaman (Bobot C6) <span class="text-[#FF634A]">*</span>
          </label>
          <select
            id="form-competitor-category"
            bind:value={formCategory}
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
          >
            <option value="DIRECT_STARLING">Kopi Keliling Langsung (Starling) — Bobot 3 (Tinggi)</option>
            <option value="LOW_PRICE_TAKEAWAY">Kedai Takeaway Murah (Booth) — Bobot 2 (Sedang)</option>
            <option value="INDIRECT_PREMIUM">Kafe / Coffee Shop Premium — Bobot 1 (Rendah)</option>
          </select>
        </div>

        <!-- Coordinates (Optional) -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="form-competitor-lat" class="block font-outfit-600 text-zinc-300">Latitude (Opsional)</label>
            <input
              id="form-competitor-lat"
              type="text"
              placeholder="-7.4478"
              bind:value={formLat}
              class="w-full px-3.5 py-2 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-mono focus:border-[#FF634A] focus:outline-none"
            />
          </div>
          <div class="space-y-1.5">
            <label for="form-competitor-lon" class="block font-outfit-600 text-zinc-300">Longitude (Opsional)</label>
            <input
              id="form-competitor-lon"
              type="text"
              placeholder="112.7183"
              bind:value={formLon}
              class="w-full px-3.5 py-2 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-mono focus:border-[#FF634A] focus:outline-none"
            />
          </div>
        </div>

        <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3">
          <button
            type="button"
            onclick={() => (addModalOpen = false)}
            class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={submitting}
            class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50"
          >
            <span class="px-5 py-2 flex items-center gap-1.5 text-white font-bold">
              <CheckCircle2 class="w-4 h-4" />
              <span>{submitting ? 'Menyimpan...' : 'Simpan Data'}</span>
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
