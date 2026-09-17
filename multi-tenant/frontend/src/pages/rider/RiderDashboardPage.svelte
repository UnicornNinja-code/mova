<script lang="ts">
  import { onMount } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import FloatingDock from '../../components/ui/FloatingDock.svelte';
  import HeroVisualCard from '../../components/ui/HeroVisualCard.svelte';
  import MediaProductCard from '../../components/ui/MediaProductCard.svelte';
  import RiderTopBar from '../../components/rider/RiderTopBar.svelte';
  import RiderQuickActionModal from '../../components/rider/RiderQuickActionModal.svelte';
  import RiderDutyModal from '../../components/rider/RiderDutyModal.svelte';
  import RiderArmadaClaimModal from '../../components/rider/RiderArmadaClaimModal.svelte';
  import RiderCheckInModal from '../../components/rider/RiderCheckInModal.svelte';
  import RiderPosModal from '../../components/rider/RiderPosModal.svelte';
  import RiderCheckoutModal from '../../components/rider/RiderCheckoutModal.svelte';
  import { riderService, type RiderActiveSession } from '../../services/riderService';
  import { productService, type ProductItem } from '../../services/productService';
  import { dssService } from '../../services/dssService';
  import { authStore } from '../../lib/stores/auth.svelte';
  import { 
    Flame, 
    Compass, 
    TrendingUp, 
    ShieldCheck, 
    Clock, 
    Coffee, 
    CheckCircle2, 
    ChevronRight,
    Sparkles,
    ShieldAlert,
    ShoppingBag,
    MapPin,
    Bike
  } from 'lucide-svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  // Active Tab State: 'home' | 'catalog' | 'hotspots' | 'profile'
  let activeTab = $state('home');
  let isQuickModalOpen = $state(false);
  let isFavoriteHero = $state(false);

  // Dedicated Workflow Modals State
  let isDutyModalOpen = $state(false);
  let isArmadaModalOpen = $state(false);
  let isCheckInModalOpen = $state(false);
  let isPosModalOpen = $state(false);
  let isCheckoutModalOpen = $state(false);

  // Data States
  let sessionData = $state<RiderActiveSession | null>(null);
  let products = $state<ProductItem[]>([]);
  let recommendations = $state<any[]>([]);
  let loading = $state(true);
  let orderSuccessNotice = $state<string | null>(null);

  // Daily Quick Stats
  let totalSalesToday = $state(195000);
  let totalCupsSold = $state(13);
  let shiftTargetCups = $state(20);

  const loadRiderData = async () => {
    loading = true;
    try {
      const [sess, prodRes, dssRes] = await Promise.allSettled([
        riderService.getActiveSession(),
        productService.getProducts({ limit: 10 }),
        dssService.getRecommendations(),
      ]);

      if (sess.status === 'fulfilled') {
        sessionData = sess.value;
      }
      if (prodRes.status === 'fulfilled' && prodRes.value?.products) {
        products = prodRes.value.products;
      }
      if (dssRes.status === 'fulfilled' && dssRes.value?.rankings) {
        recommendations = dssRes.value.rankings;
      }
    } catch (err) {
      console.warn('Gagal memuat data rider:', err);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    loadRiderData();
  });

  const handleQuickOrder = (product: ProductItem) => {
    totalCupsSold += 1;
    totalSalesToday += product.price || 15000;
    orderSuccessNotice = `1x ${product.name} tercatat!`;
    setTimeout(() => {
      orderSuccessNotice = null;
    }, 2500);
  };

  const handleSaleSuccess = (saleResult: any) => {
    totalSalesToday += saleResult.totalAmount;
    totalCupsSold += saleResult.totalCups;
    orderSuccessNotice = `Penjualan ${saleResult.totalCups} cup (${saleResult.paymentMethod}) berhasil disimpan!`;
    setTimeout(() => {
      orderSuccessNotice = null;
    }, 3000);
  };

  const handleCheckInSuccess = (result: any) => {
    orderSuccessNotice = `Check-in Berhasil di ${result?.zone_name || 'Zona Tugas'}!`;
    loadRiderData();
    setTimeout(() => {
      orderSuccessNotice = null;
    }, 3000);
  };

  const handleClaimSuccess = (armada: any) => {
    orderSuccessNotice = `Armada ${armada?.code || ''} berhasil diklaim (Status: IN_USE)!`;
    loadRiderData();
    setTimeout(() => {
      orderSuccessNotice = null;
    }, 3000);
  };

  const handleCheckoutSuccess = (result: any) => {
    orderSuccessNotice = 'Sesi operasional berhasil ditutup & disetor!';
    setTimeout(() => {
      handleLogout();
    }, 2000);
  };

  const handleLogout = () => {
    authStore.logout();
    onNavigate('/login');
  };
</script>

<!-- Mobile Smartphone Frame Viewport (Responsive: Native App on Mobile, iPhone Bezel on Desktop) -->
<MobileFrame showStatusBar={true} showDynamicIsland={true}>
  <!-- Top Navigation & Rider Info Bar -->
  <RiderTopBar
    zoneName={sessionData?.duty?.zone_name || 'Zona Sidoarjo 3 - Pahlawan'}
    armadaCode={sessionData?.armada?.code || 'ARM-GB-001'}
    onLogout={handleLogout}
  />

  <!-- Toast Notice Banner if triggered -->
  {#if orderSuccessNotice}
    <div class="mb-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
      <span class="flex items-center gap-1.5 font-bold">
        <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
        {orderSuccessNotice}
      </span>
    </div>
  {/if}

  <!-- TAB CONTENT SWITCHER -->
  {#if activeTab === 'home'}
    <!-- ================================================================= -->
    <!-- 1. HOME TAB (Matching User's Visual Layout Attachment)             -->
    <!-- ================================================================= -->
    <div class="space-y-4">
      <!-- Top Large Visual Card (Hero Banner with Iridescent Mesh Gradient) -->
      <HeroVisualCard
        title={sessionData?.duty?.zone_name || "Zona Sidoarjo 3 - Pahlawan"}
        subtitle="Shift Siang Aktif • 11:00 - 15:00 WIB"
        badgeText="Tugas Aktif"
        badgeVariant="success"
        gradientType="aurora"
        actionActive={isFavoriteHero}
        onAction={() => isFavoriteHero = !isFavoriteHero}
      >
        <!-- Expanded Metrics Inside Hero Bottom Card -->
        <div class="grid grid-cols-3 gap-2 text-center text-white">
          <div class="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span class="text-[10px] text-zinc-400 font-medium">Status Armada</span>
            <span class="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
              <ShieldCheck class="w-3.5 h-3.5" /> SIAP
            </span>
          </div>

          <div class="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span class="text-[10px] text-zinc-400 font-medium">Cuaca Hub</span>
            <span class="text-xs font-bold text-sky-400 mt-0.5">
              28°C Cerah
            </span>
          </div>

          <div class="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span class="text-[10px] text-zinc-400 font-medium">Kapasitas Zona</span>
            <span class="text-xs font-bold text-amber-400 mt-0.5">
              3 / 4 Rider
            </span>
          </div>
        </div>
      </HeroVisualCard>

      <!-- Quick Metrics Summary Pills -->
      <div class="grid grid-cols-3 gap-2">
        <div class="p-2.5 rounded-2xl bg-[#18181D] border border-[#272730] flex flex-col">
          <span class="text-[10px] text-zinc-400 font-medium">Omzet Hari Ini</span>
          <span class="text-xs font-bold text-white font-mono mt-0.5">
            Rp {(totalSalesToday / 1000).toFixed(0)}k
          </span>
        </div>

        <div class="p-2.5 rounded-2xl bg-[#18181D] border border-[#272730] flex flex-col">
          <span class="text-[10px] text-zinc-400 font-medium">Cup Terjual</span>
          <span class="text-xs font-bold text-[#FF634A] font-mono mt-0.5">
            {totalCupsSold} Cup
          </span>
        </div>

        <div class="p-2.5 rounded-2xl bg-[#18181D] border border-[#272730] flex flex-col">
          <span class="text-[10px] text-zinc-400 font-medium">Target Shift</span>
          <span class="text-xs font-bold text-emerald-400 mt-0.5">
            {Math.round((totalCupsSold / shiftTargetCups) * 100)}%
          </span>
        </div>
      </div>

      <!-- Section: Menu Kopi Terlaris (2-Column Grid matching Screenshot) -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between px-0.5">
          <div class="flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-[#FF634A]" />
            <h3 class="text-xs font-outfit-600 font-bold text-white tracking-tight">
              Menu Terlaris Hari Ini
            </h3>
          </div>
          <button
            type="button"
            onclick={() => activeTab = 'catalog'}
            class="text-[11px] text-[#FF634A] hover:text-[#FF8573] font-outfit-600 flex items-center gap-0.5 cursor-pointer"
          >
            Lihat Semua <ChevronRight class="w-3 h-3" />
          </button>
        </div>

        <!-- 2-Column Responsive Card Grid matching the 2 cards in the screenshot -->
        <div class="grid grid-cols-2 gap-2.5">
          {#if products.length > 0}
            {#each products.slice(0, 4) as product, i}
              <MediaProductCard
                id={product.id}
                title={product.name}
                category={product.category || 'KOPI'}
                price={product.price || 15000}
                rating={4.8 + (i % 3) * 0.1}
                salesCount={24 + i * 11}
                gradientPreset={
                  i === 0 
                    ? 'from-rose-400/90 via-amber-300/80 to-purple-400/90' 
                    : i === 1 
                      ? 'from-sky-400/90 via-teal-300/80 to-indigo-400/90' 
                      : i === 2 
                        ? 'from-emerald-400/90 via-cyan-300/80 to-blue-500/90' 
                        : 'from-amber-400/90 via-orange-400/80 to-rose-500/90'
                }
                imageUrl={product.image_url}
                onOrder={() => handleQuickOrder(product)}
              />
            {/each}
          {:else}
            <div class="w-full py-8 text-center bg-[#131316] rounded-2xl border border-[#24242A] text-xs text-[#71717A]">
              {#if loading}
                <p>Memuat katalog produk...</p>
              {:else}
                <p>Belum ada produk aktif yang terdaftar di database.</p>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Section: Hotspot Rekomendasi TOPSIS Preview -->
      <div class="space-y-2">
        <div class="flex items-center justify-between px-0.5">
          <div class="flex items-center gap-1.5">
            <Flame class="w-3.5 h-3.5 text-amber-500" />
            <h3 class="text-xs font-outfit-600 font-bold text-white tracking-tight">
              Rekomendasi Zona DSS TOPSIS
            </h3>
          </div>
          <button
            type="button"
            onclick={() => activeTab = 'hotspots'}
            class="text-[11px] text-amber-400 hover:text-amber-300 font-outfit-600 flex items-center gap-0.5 cursor-pointer"
          >
            Peta <ChevronRight class="w-3 h-3" />
          </button>
        </div>

        {#if recommendations.length > 0}
          <div class="space-y-1.5">
            {#each recommendations.slice(0, 2) as rec}
              <div class="p-3 rounded-2xl bg-[#18181D] border border-[#272730] flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF634A] to-amber-500 flex items-center justify-center text-white font-bold text-xs">
                    #{rec.rank}
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-white">{rec.name}</h4>
                    <p class="text-[10px] text-zinc-400">Skor TOPSIS: {(rec.preference_score * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  Potensi Tinggi
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'catalog'}
    <!-- ================================================================= -->
    <!-- 2. CATALOG TAB (Full 2-Column Product Menu Grid)                  -->
    <!-- ================================================================= -->
    <div class="space-y-3">
      <div class="space-y-1">
        <h2 class="text-base font-outfit-600 font-bold text-white tracking-tight">Katalog Menu Minuman</h2>
        <p class="text-xs text-zinc-400">Pilih menu untuk mencatat transaksi penjualan</p>
      </div>

      <div class="grid grid-cols-2 gap-2.5 pt-1">
        {#each products as product, i}
          <MediaProductCard
            id={product.id}
            title={product.name}
            category={product.category || 'KOPI'}
            price={product.price || 15000}
            rating={4.8}
            salesCount={30 + i * 5}
            imageUrl={product.image_url}
            onOrder={() => handleQuickOrder(product)}
          />
        {/each}
      </div>
    </div>

  {:else if activeTab === 'hotspots'}
    <!-- ================================================================= -->
    <!-- 3. HOTSPOTS TAB (DSS TOPSIS Decision Recommendations)              -->
    <!-- ================================================================= -->
    <div class="space-y-3">
      <div class="space-y-1">
        <h2 class="text-base font-outfit-600 font-bold text-white tracking-tight">Zona Rekomendasi TOPSIS</h2>
        <p class="text-xs text-zinc-400">Peringkat zona terbaik berdasarkan kriteria kepadatan POI & cuaca</p>
      </div>

      <div class="space-y-2 pt-1">
        {#each recommendations as rec}
          <div class="p-3.5 rounded-2xl bg-[#18181D] border border-[#272730] hover:border-[#FF634A]/40 transition-all flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-[#FF634A]/20 border border-[#FF634A]/40 flex items-center justify-center text-[#FF634A] font-bold text-sm">
                #{rec.rank}
              </div>
              <div>
                <h4 class="text-xs font-bold text-white">{rec.name}</h4>
                <p class="text-[10px] text-zinc-400">Skor Preferensi: {rec.preference_score}</p>
              </div>
            </div>

            <button
              type="button"
              onclick={() => (isCheckInModalOpen = true)}
              class="px-2.5 py-1 rounded-lg bg-[#FF634A]/15 text-[#FF634A] hover:bg-[#FF634A] hover:text-white text-[11px] font-bold transition-all border border-[#FF634A]/30 cursor-pointer"
            >
              Check-in
            </button>
          </div>
        {/each}
      </div>
    </div>

  {:else if activeTab === 'profile'}
    <!-- ================================================================= -->
    <!-- 4. PROFILE & ARMADA TAB                                          -->
    <!-- ================================================================= -->
    <div class="space-y-4">
      <div class="p-4 rounded-2xl bg-[#18181D] border border-[#272730] flex items-center gap-3">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#FF634A] to-purple-600 p-0.5">
          <div class="w-full h-full rounded-full bg-[#131317] flex items-center justify-center text-white font-bold text-base">
            {authStore.user?.name?.charAt(0) || 'R'}
          </div>
        </div>
        <div>
          <h3 class="text-sm font-bold text-white">{authStore.user?.name || 'Rider Lapangan'}</h3>
          <p class="text-xs text-zinc-400">{authStore.user?.email}</p>
          <span class="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
            Role: RIDER AKTIF
          </span>
        </div>
      </div>

      <!-- Armada Details -->
      <div class="p-4 rounded-2xl bg-[#18181D] border border-[#272730] space-y-2">
        <h4 class="text-xs font-bold text-white uppercase tracking-wider">Unit Armada Terdaftar</h4>
        <div class="flex items-center justify-between text-xs text-zinc-300">
          <span>Kode Unit:</span>
          <span class="font-mono font-bold text-[#FF634A]">{sessionData?.armada?.code || 'ARM-GB-001'}</span>
        </div>
        <div class="flex items-center justify-between text-xs text-zinc-300">
          <span>Tipe Kendaraan:</span>
          <span>Sepeda Listrik Gerobak</span>
        </div>
        <div class="flex items-center justify-between text-xs text-zinc-300">
          <span>Kapasitas Baterai:</span>
          <span class="text-emerald-400 font-bold">92% Prima</span>
        </div>
      </div>

      <!-- Operational Flow Quick Action Shortcuts -->
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onclick={() => (isDutyModalOpen = true)}
          class="p-2.5 rounded-2xl bg-[#1A1A24] border border-[#2B2B3C] hover:border-[#FF634A]/50 flex items-center gap-2.5 text-left transition-all cursor-pointer active:scale-95"
        >
          <div class="w-8 h-8 rounded-xl bg-[#FF634A]/20 text-[#FF634A] flex items-center justify-center shrink-0">
            <Clock class="w-4 h-4" />
          </div>
          <div>
            <span class="text-xs font-bold text-white block">1. Presensi Hadir</span>
            <span class="text-[10px] text-zinc-400">Plotting Zona SPK</span>
          </div>
        </button>

        <button
          type="button"
          onclick={() => (isArmadaModalOpen = true)}
          class="p-2.5 rounded-2xl bg-[#1A1A24] border border-[#2B2B3C] hover:border-emerald-500/50 flex items-center gap-2.5 text-left transition-all cursor-pointer active:scale-95"
        >
          <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Bike class="w-4 h-4" />
          </div>
          <div>
            <span class="text-xs font-bold text-white block">2. Klaim Armada</span>
            <span class="text-[10px] text-zinc-400">Inspeksi & Lock 3m</span>
          </div>
        </button>
      </div>

      <button
        type="button"
        onclick={handleLogout}
        class="w-full py-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-bold transition-all cursor-pointer"
      >
        Selesaikan Shift & Keluar
      </button>
    </div>
  {/if}

  <!-- REUSABLE FLOATING PILL DOCK NAVIGATION BAR (FOOTER SLOT) -->
  {#snippet footer()}
    <FloatingDock
      {activeTab}
      onTabChange={(tabId) => {
        if (tabId === 'action') {
          isQuickModalOpen = true;
        } else {
          activeTab = tabId;
        }
      }}
    />
  {/snippet}

  <!-- Quick Action Center Modal (MODAL SLOT) -->
  {#snippet modal()}
    <RiderQuickActionModal
      isOpen={isQuickModalOpen}
      onClose={() => isQuickModalOpen = false}
      onRecordSale={() => { isQuickModalOpen = false; isPosModalOpen = true; }}
      onGpsCheckIn={() => { isQuickModalOpen = false; isCheckInModalOpen = true; }}
      onReportIssue={() => { isQuickModalOpen = false; activeTab = 'profile'; }}
      onCheckout={() => { isQuickModalOpen = false; isCheckoutModalOpen = true; }}
    />

    <!-- 1. Presensi & Queue Modal -->
    <RiderDutyModal
      open={isDutyModalOpen}
      onClose={() => isDutyModalOpen = false}
      currentDutyStatus={sessionData?.duty?.status}
      assignedZoneName={sessionData?.duty?.zone_name}
      onDutyConfirmed={loadRiderData}
      onProceedToArmada={() => (isArmadaModalOpen = true)}
    />

    <!-- 2. Armada Inspection & 180s Hold Modal -->
    <RiderArmadaClaimModal
      open={isArmadaModalOpen}
      onClose={() => isArmadaModalOpen = false}
      onClaimSuccess={handleClaimSuccess}
    />

    <!-- 3. GPS Geofence Check-in Modal -->
    <RiderCheckInModal
      open={isCheckInModalOpen}
      onClose={() => isCheckInModalOpen = false}
      zoneName={sessionData?.duty?.zone_name || 'Zona Tugas'}
      onCheckInSuccess={handleCheckInSuccess}
    />

    <!-- 4. Mobile POS & Dynamic QRIS Modal -->
    <RiderPosModal
      open={isPosModalOpen}
      onClose={() => isPosModalOpen = false}
      onSaleRecorded={handleSaleSuccess}
    />

    <!-- 5. Shift Settlement & Checkout Modal -->
    <RiderCheckoutModal
      open={isCheckoutModalOpen}
      onClose={() => isCheckoutModalOpen = false}
      totalRevenueToday={totalSalesToday}
      totalCupsSold={totalCupsSold}
      onCheckoutSuccess={handleCheckoutSuccess}
    />
  {/snippet}
</MobileFrame>
