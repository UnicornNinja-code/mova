<script lang="ts">
  import { Button } from "$components/ui/button";
  import { Badge } from "$components/ui/badge";
  import { Skeleton } from "$components/ui/skeleton";
  import { Input } from "$components/ui/input";
  import { Checkbox } from "$components/ui/checkbox";
  import { Switch } from "$components/ui/switch";
  import { Spinner } from "$components/ui/spinner";
  import { MovaLogo } from "$components/ui/brand";
  import { FAQAccordion, type FAQItem } from "$components/ui/faq";
  import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    ConfirmationModal,
    OnboardingDialog,
  } from "$components/ui/dialog";
  import {
    Popover,
    PopoverTrigger,
    PopoverContent,
  } from "$components/ui/popover";
  import { DotPattern } from "$components/ui/dot-pattern";
  import { AppSidebar } from "$components/layout";

  // Views for sub-page preview
  import LoginPage from "$components/../pages/auth/LoginPage.svelte";
  import RegisterPage from "$components/../pages/auth/RegisterPage.svelte";
  import NotFoundPage from "$components/../pages/NotFoundPage.svelte";
  import { authStore, getRoleLandingPath } from "$lib/stores/auth.svelte";
  import { router } from "$lib/stores/router.svelte";

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

  const handleGetStarted = () => {
    if (authStore.token && authStore.user) {
      navigateTo(getRoleLandingPath(authStore.user.role));
    } else {
      navigateTo("/login");
    }
  };

  type ActiveTab = "bento" | "sidebar" | "primitives" | "dss-table" | "faq" | "login" | "register" | "notfound";
  let activeTab = $state<ActiveTab>("sidebar");

  // Sidebar interactive state
  let sidebarCollapsed = $state(false);
  let activeSidebarId = $state("dashboard");

  // Bento Interactive Customizer State
  let customizerColor = $state("#FF634A");
  let customizerSize = $state(48);
  let customizerRotated = $state(0);
  let customizerFlipped = $state(false);
  let customizerAnimated = $state(false);
  let customizerIcon = $state("bxs-hot");
  let customizerCategory = $state<"filled" | "solid" | "basic" | "logos">("filled");

  // Form & Modal interactive demo states
  let searchInput = $state("");
  let demoCheckbox = $state(true);
  let demoSwitch = $state(true);
  let isDialogOpen = $state(false);
  let isConfirmOpen = $state(false);
  let isOnboardingOpen = $state(false);
  let toastMessage = $state<string | null>(null);

  function triggerToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => {
      toastMessage = null;
    }, 3000);
  }

  const faqList: FAQItem[] = [
    {
      id: "faq-1",
      category: "Armada Hold",
      badgeVariant: "hold",
      question: "Bagaimana cara kerja 3-Minute View-Triggered Armada Hold?",
      answer: "Saat rider membuka kartu armada di aplikasi mobile, Redis distributed lock mengunci armada dalam status HOLD selama 180 detik. Jika rider keluar atau waktu habis tanpa konfirmasi fisik, BullMQ worker otomatis melepaskan kunci secara atomik."
    },
    {
      id: "faq-2",
      category: "BWM-TOPSIS",
      badgeVariant: "in-review",
      question: "Bagaimana algoritma BWM dan TOPSIS menentukan rekomendasi zona?",
      answer: "Best-Worst Method (BWM) mengalibrasi bobot 4 kriteria inti (Kepadatan POI C1, Kepadatan Kompetitor C2, Jarak Tempuh C3, Risiko Cuaca C4). TOPSIS kemudian menghitung skor kedekatan relatif (0–1) terhadap solusi ideal positif dan negatif."
    },
    {
      id: "faq-3",
      category: "PostGIS Geofence",
      badgeVariant: "active",
      question: "Apakah sistem mendeteksi rider yang berjualan di luar area penugasan?",
      answer: "Ya. Data LBS dari rider dikirim setiap interval dan diverifikasi melalui PostGIS ST_Contains / ST_DWithin. Jika rider berada di luar centroid geofence > 100m, sistem memicu notifikasi peringatan deviasi zona."
    },
    {
      id: "faq-4",
      category: "ETL Cuaca",
      badgeVariant: "progress",
      question: "Seberapa sering telemetri cuaca diperbarui dari Open-Meteo?",
      answer: "Pipeline ETL cuaca menyinkronkan data per hub setiap 30 menit (1800s TTL cache). Data non-destruktif disimpan ke database observasi untuk analisis historis dampak cuaca terhadap penjualan."
    },
    {
      id: "faq-5",
      category: "RBAC Security",
      badgeVariant: "submitted",
      question: "Siapa saja yang berhak mengubah matriks kalibrasi kriteria DSS?",
      answer: "Hanya role SUPERADMIN yang memiliki wewenang mengkalibrasi matriks perbandingan BWM. Seluruh modifikasi dicatat secara permanen di tabel audit logs dengan IP address dan timestamp."
    }
  ];
</script>

<div class="relative min-h-screen bg-[#09090B] text-[#FAFAFA] font-sans antialiased selection:bg-[#FF634A]/30 selection:text-white">
  <!-- Global Ambient Dot Background Across All Views -->
  <DotPattern
    class="[mask-image:radial-gradient(1200px_circle_at_center,white,transparent)] opacity-35 fill-zinc-500 pointer-events-none fixed inset-0 h-full w-full"
    width={22}
    height={22}
    cr={1.2}
  />

  <!-- Toast Notification Popup -->
  {#if toastMessage}
    <div class="fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#131316]/95 px-5 py-3 text-sm text-white shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
      <div class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <i class="bx bx-check text-lg"></i>
      </div>
      <span>{toastMessage}</span>
    </div>
  {/if}

  <!-- Floating Glass Pill Header Island with Mova. Text Logo -->
  <div class="sticky top-2 md:top-3 z-50 px-3 w-full flex justify-center pointer-events-none">
    <header class="pointer-events-auto max-w-[860px] w-full mx-auto rounded-full border border-white/15 bg-[#131316]/80 px-3.5 md:px-5 py-2 shadow-2xl shadow-black/80 backdrop-blur-2xl flex items-center justify-between transition-all duration-300">
      <!-- Pure Text Logo: Mova. in Outfit font -->
      <div class="flex items-center gap-2 pl-1">
        <MovaLogo size="sm" />
      </div>

      <!-- Center Floating Nav Links -->
      <nav class="hidden md:flex items-center gap-1">
        <button
          type="button"
          onclick={() => (activeTab = "sidebar")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'sidebar' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          Sidebar
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "bento")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'bento' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          Bento
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "primitives")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'primitives' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          Primitives
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "dss-table")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'dss-table' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          DSS Tables
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "faq")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'faq' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          FAQ
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "login")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'login' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          Login
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "register")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'register' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          Sign Up
        </button>
        <button
          type="button"
          onclick={() => (activeTab = "notfound")}
          class="rounded-full px-3 py-1 text-xs font-medium transition-all {activeTab === 'notfound' ? 'bg-white text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}"
        >
          404
        </button>
      </nav>

      <!-- Right Signature Action Button with Gradient & Shine -->
      <div class="flex items-center gap-2">
        <Button variant="pill-primary" size="sm" onclick={handleGetStarted} class="cursor-pointer">
          <span>{authStore.token ? 'Buka Dashboard' : 'Get Started'}</span>
          <i class="bx bx-right-arrow-alt text-base"></i>
        </Button>
      </div>
    </header>
  </div>

  <!-- =========================================================================
       VIEW 1: BENTO SHOWCASE (BOXICONS INSPIRED)
       ========================================================================= -->
  {#if activeTab === "bento"}
    <div class="relative z-10">
      <!-- Hero Section -->
      <section class="mx-auto max-w-[1368px] px-6 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <!-- New Feature Pill -->
        <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] p-1.5 pr-4 text-xs shadow-xl backdrop-blur-md">
          <Badge variant="default" class="h-5 px-2 text-[10px]">NEW</Badge>
          <span class="text-zinc-300">
            MOVA Decision Intelligence Platform v2.0 Released 🎉
          </span>
        </div>

        <!-- 84px Outfit Heading from Boxicons Inspiration -->
        <h1 class="text-display-hero mt-6 text-white max-w-4xl mx-auto font-heading">
          High Precision <br />
          <span class="bg-gradient-to-r from-[#FF634A] via-[#FF8570] to-[#FFA899] bg-clip-text text-transparent">
            Decision System
          </span>
        </h1>

        <p class="mt-5 text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed font-sans">
          Platform analitik cerdas & distribusi armada berbasis algoritma <strong>BWM-TOPSIS</strong>, telemetri cuaca real-time, dan geofence PostGIS.
        </p>

        <!-- CTA Buttons -->
        <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button variant="pill-primary" size="lg" onclick={handleGetStarted} class="h-12 px-7 text-base font-semibold shadow-xl shadow-[#FF634A]/25 cursor-pointer">
            <span>{authStore.token ? 'Buka Dashboard Sistem' : 'Masuk ke Sistem Operasional'}</span>
            <i class="bx bx-right-arrow-alt text-xl"></i>
          </Button>

          <Button variant="pill-outline" size="lg" onclick={() => (activeTab = "sidebar")} class="h-12 px-7 text-base font-semibold cursor-pointer">
            <i class="bx bx-layout text-xl text-[#FF634A]"></i>
            <span>Preview Dashboard & Map</span>
          </Button>
        </div>
      </section>

      <!-- Main Bento Grid (Boxicons Refined) -->
      <section class="mx-auto max-w-[1368px] px-6 pb-24">
        <!-- Explorer Header Card -->
        <div class="mb-12 rounded-[36px] border border-white/10 bg-[#121215] p-8 shadow-2xl shadow-black/80 md:p-12">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <!-- Left Controls & Search -->
            <div class="lg:col-span-5 space-y-6">
              <div class="flex items-center gap-2 text-xs font-heading text-zinc-400 uppercase tracking-wider">
                <i class="bx bxs-compass text-base text-[#FF634A]"></i>
                <span>Live Interactive Telemetry Customizer</span>
              </div>

              <h2 class="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Inspect, modify, and simulate DSS states live
              </h2>
              <p class="text-sm text-zinc-400 leading-relaxed">
                Uji interaktivitas komponen Boxicons secara dinamis: rotasi, perbesaran skala, ganti warna status aksen, dan eksekusi payload state.
              </p>

              <!-- Category Pills -->
              <div class="inline-flex rounded-2xl border border-white/10 bg-[#18181b] p-1.5 gap-1">
                {#each ["filled", "solid", "basic", "logos"] as cat}
                  <button
                    type="button"
                    onclick={() => (customizerCategory = cat as any)}
                    class="rounded-xl px-3 py-1 text-xs font-medium capitalize transition-colors {customizerCategory === cat ? 'bg-[#FF634A] text-white' : 'text-zinc-400 hover:text-white'}"
                  >
                    {cat}
                  </button>
                {/each}
              </div>

              <!-- Icon Selector Grid -->
              <div class="grid grid-cols-6 gap-2 pt-2">
                {#each ["bxs-hot", "bx-map", "bx-shield-quarter", "bx-cloud-rain", "bx-trending-up", "bx-coffee", "bxs-badge-check", "bx-navigation", "bx-car", "bx-broadcast", "bx-layer", "bx-tachometer"] as ic}
                  <button
                    type="button"
                    aria-label="Pilih ikon {ic}"
                    onclick={() => (customizerIcon = ic)}
                    class="flex h-11 w-11 items-center justify-center rounded-xl border transition-all {customizerIcon === ic ? 'border-[#FF634A] bg-[#FF634A]/20 text-[#FF634A] scale-105' : 'border-white/10 bg-[#18181b] text-zinc-400 hover:border-white/20 hover:text-white'}"
                  >
                    <i class="bx {ic} text-xl"></i>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Right Live Preview Canvas & Tooling -->
            <div class="lg:col-span-7 rounded-3xl border border-white/10 bg-[#18181b] p-6 sm:p-8 space-y-6">
              <!-- Canvas Display Box -->
              <div class="relative flex h-64 w-full items-center justify-center rounded-2xl border border-white/10 bg-[#09090B] overflow-hidden">
                <DotPattern class="opacity-20 fill-zinc-600" width={16} height={16} />
                
                <!-- Main Dynamic Icon -->
                <div
                  style="transform: rotate({customizerRotated}deg) scaleX({customizerFlipped ? -1 : 1}); font-size: {customizerSize}px; color: {customizerColor};"
                  class="transition-all duration-200 {customizerAnimated ? 'animate-bounce' : ''}"
                >
                  <i class="bx {customizerIcon}"></i>
                </div>

                <div class="absolute bottom-3 left-4 text-xs font-heading text-zinc-500">
                  Preview: &lt;BoxIcon name="{customizerIcon}" size={customizerSize} /&gt;
                </div>
              </div>

              <!-- Modifier Controls -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/10 pt-6">
                <!-- Color Selector -->
                <div>
                  <span class="block text-xs font-heading uppercase text-zinc-400 mb-2">Accent Color</span>
                  <div class="flex items-center gap-1.5">
                    {#each ["#FF634A", "#10B981", "#3B82F6", "#F59E0B", "#FAFAFA", "#A855F7"] as clr}
                      <button
                        type="button"
                        onclick={() => (customizerColor = clr)}
                        style="background-color: {clr};"
                        class="h-6 w-6 rounded-full border-2 transition-transform {customizerColor === clr ? 'border-white scale-110' : 'border-transparent'}"
                        aria-label="Select color {clr}"
                      ></button>
                    {/each}
                  </div>
                </div>

                <!-- Size Step -->
                <div>
                  <span class="block text-xs font-heading uppercase text-zinc-400 mb-2">Size ({customizerSize}px)</span>
                  <div class="inline-flex h-8 rounded-lg border border-white/10 bg-[#121215]">
                    <button
                      type="button"
                      onclick={() => (customizerSize = Math.max(20, customizerSize - 8))}
                      class="px-2.5 text-zinc-400 hover:text-white"
                    >-</button>
                    <span class="flex items-center px-2 font-heading text-xs">{customizerSize}</span>
                    <button
                      type="button"
                      onclick={() => (customizerSize = Math.min(96, customizerSize + 8))}
                      class="px-2.5 text-zinc-400 hover:text-white"
                    >+</button>
                  </div>
                </div>

                <!-- Rotate Step -->
                <div>
                  <span class="block text-xs font-heading uppercase text-zinc-400 mb-2">Rotate</span>
                  <button
                    type="button"
                    onclick={() => (customizerRotated = (customizerRotated + 90) % 360)}
                    class="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#121215] px-3 text-xs text-zinc-300 hover:text-white"
                  >
                    <i class="bx bx-rotate-right text-base"></i>
                    <span>{customizerRotated}°</span>
                  </button>
                </div>

                <!-- Flip & Animation -->
                <div>
                  <span class="block text-xs font-heading uppercase text-zinc-400 mb-2">Flip / Animate</span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick={() => (customizerFlipped = !customizerFlipped)}
                      class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {customizerFlipped ? 'border-[#FF634A] bg-[#FF634A]/20 text-[#FF634A]' : 'border-white/10 bg-[#121215] text-zinc-400 hover:text-white'}"
                      title="Flip Horizontal"
                    >
                      <i class="bx bx-reflect-vertical text-base"></i>
                    </button>
                    <button
                      type="button"
                      onclick={() => (customizerAnimated = !customizerAnimated)}
                      class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {customizerAnimated ? 'border-[#FF634A] bg-[#FF634A]/20 text-[#FF634A]' : 'border-white/10 bg-[#121215] text-zinc-400 hover:text-white'}"
                      title="Toggle Animation"
                    >
                      <i class="bx bx-pulse text-base"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bento Multi-Card Feature Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="rounded-3xl border border-white/10 bg-[#131316] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/20">
                <i class="bx bxs-brain text-xl"></i>
              </div>
              <h3 class="font-heading text-xl font-bold text-white">4-Pilar Decision Intelligence</h3>
              <p class="text-xs text-zinc-400 leading-relaxed">
                Menghitung ranking zona prioritas secara obyektif berdasarkan kepadatan POI, kompetitor, jarak tempuh, dan risiko cuaca lokal.
              </p>
            </div>
            <div class="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-heading text-zinc-400">
              <span>Consistency Ratio</span>
              <span class="text-emerald-400 font-bold">&lt; 0.10 (Valid)</span>
            </div>
          </div>

          <div class="rounded-3xl border border-white/10 bg-[#131316] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <i class="bx bx-time-five text-xl"></i>
              </div>
              <h3 class="font-heading text-xl font-bold text-white">3-Minute Armada Lock</h3>
              <p class="text-xs text-zinc-400 leading-relaxed">
                Reservasi otomatis tanpa konflik ras. BullMQ worker dan Redis mutex lock melepaskan kunci jika rider membatalkan verifikasi.
              </p>
            </div>
            <div class="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-heading text-zinc-400">
              <span>Lock Key</span>
              <span class="text-amber-400 font-bold">armada:hold:180s</span>
            </div>
          </div>

          <div class="rounded-3xl border border-white/10 bg-[#131316] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <i class="bx bx-map-pin text-xl"></i>
              </div>
              <h3 class="font-heading text-xl font-bold text-white">PostGIS Spatial Geofence</h3>
              <p class="text-xs text-zinc-400 leading-relaxed">
                Pemetaan polygon zona dan centroid tracking akurat dengan GiST spatial indexing & clustering ST_ClusterDBSCAN.
              </p>
            </div>
            <div class="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-heading text-zinc-400">
              <span>Coordinate System</span>
              <span class="text-sky-400 font-bold">EPSG:4326 (WGS 84)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  {/if}

  <!-- =========================================================================
       VIEW 2: UI PRIMITIVES & FORM CONTROLS
       ========================================================================= -->
  {#if activeTab === "primitives"}
    <main class="relative z-10 mx-auto max-w-7xl px-6 py-12 space-y-12">
      <!-- Section Header -->
      <div class="border-b border-white/10 pb-6">
        <h1 class="font-heading text-3xl font-bold text-white">Design System Primitives</h1>
        <p class="mt-1 text-sm text-zinc-400 font-sans">
          Koleksi komponen dasar berkarakter gelap dengan token warna presisi dan tipografi Outfit.
        </p>
      </div>

      <!-- 1. Buttons Showcase -->
      <section class="rounded-3xl border border-white/10 bg-[#131316] p-8 space-y-6">
        <h2 class="font-heading text-xl font-semibold text-white">Signature Buttons</h2>
        
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <Button variant="default">
              <i class="bx bxs-hot text-base"></i>
              <span>Primary Orange (Shine)</span>
            </Button>

            <Button variant="pill-primary">
              <span>Pill Gradient</span>
              <i class="bx bx-right-arrow-alt text-base"></i>
            </Button>

            <Button variant="pill-outline">
              <span>Pill Glass</span>
            </Button>

            <Button variant="secondary">
              <i class="bx bx-layer text-base"></i>
              <span>Secondary</span>
            </Button>

            <Button variant="outline">
              <i class="bx bx-navigation text-base"></i>
              <span>Outline Glass</span>
            </Button>

            <Button variant="ghost">
              <span>Ghost Button</span>
            </Button>

            <Button variant="destructive">
              <i class="bx bx-trash text-base"></i>
              <span>Destructive</span>
            </Button>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-2">
            <Button size="sm">Small (36px)</Button>
            <Button size="default">Default (40px)</Button>
            <Button size="lg">Large (48px)</Button>
            <Button size="icon" variant="outline">
              <i class="bx bx-cog text-base"></i>
            </Button>
          </div>
        </div>
      </section>

      <!-- 2. Form Inputs & Controls -->
      <section class="rounded-3xl border border-white/10 bg-[#131316] p-8 space-y-6">
        <h2 class="font-heading text-xl font-semibold text-white">Form Inputs & Selection Controls</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="demo-search-input" class="block text-xs font-medium text-zinc-400 mb-1.5">Search Input with Hotkey</label>
            <Input id="demo-search-input" placeholder="Cari armada atau zona..." icon="bx-search" hotkey="Ctrl K" bind:value={searchInput} />
          </div>

          <div>
            <label for="demo-standard-input" class="block text-xs font-medium text-zinc-400 mb-1.5">Standard Text Input</label>
            <Input id="demo-standard-input" placeholder="Masukkan nama petugas..." icon="bx-user" />
          </div>

          <div class="flex items-center gap-6 pt-2">
            <label class="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
              <Checkbox bind:checked={demoCheckbox} />
              <span>Checkbox ({demoCheckbox ? "Checked" : "Unchecked"})</span>
            </label>

            <label class="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
              <Switch bind:checked={demoSwitch} />
              <span>Toggle Switch ({demoSwitch ? "Active" : "Inactive"})</span>
            </label>
          </div>

          <div class="flex items-center gap-4 pt-2">
            <div class="flex items-center gap-2">
              <Spinner size="sm" />
              <span class="text-xs text-zinc-400">Loading sm</span>
            </div>
            <div class="flex items-center gap-2">
              <Spinner size="md" />
              <span class="text-xs text-zinc-400">Loading md</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Status Badges (Outfit Pill Badges) -->
      <section class="rounded-3xl border border-white/10 bg-[#131316] p-8 space-y-6">
        <div>
          <h2 class="font-heading text-xl font-semibold text-white">Canonical Status Badges (Outfit Pill Style)</h2>
          <p class="text-xs text-zinc-400 mt-1">Pill badges dengan font Outfit, ikon terpadu, dan palet warna status kanonikal.</p>
        </div>

        <div class="space-y-4">
          <!-- Direct Matching with User Reference -->
          <div class="flex flex-wrap items-center gap-3">
            <Badge variant="pending">Pending</Badge>
            <Badge variant="progress">Progress</Badge>
            <Badge variant="expire">Expire</Badge>
            <Badge variant="submitted">Submitted</Badge>
            <Badge variant="failed">Failed</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="in-review">In Review</Badge>
          </div>

          <!-- MOVA Operational DSS Statuses -->
          <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.06]">
            <Badge variant="active">Active (In Use)</Badge>
            <Badge variant="waiting">Waiting (Antrean)</Badge>
            <Badge variant="hold">Hold (3-Min Lock)</Badge>
            <Badge variant="plotted">Plotted (Siap)</Badge>
            <Badge variant="maintenance">Maintenance</Badge>
            <Badge variant="default">Top Rank #1</Badge>
          </div>
        </div>
      </section>

      <!-- 4. Modals & Dialogs Showcase (Standard, Confirmation, Onboarding, Popover) -->
      <section class="rounded-3xl border border-white/10 bg-[#131316] p-8 space-y-6">
        <div>
          <h2 class="font-heading text-xl font-semibold text-white">Modals, Dialogs & Popovers</h2>
          <p class="text-xs text-zinc-400 mt-1">Komponen modal interaktif terstandar untuk alur konfirmasi, onboarding, dan checklist.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Standard Modal Trigger -->
          <div class="rounded-2xl border border-white/10 bg-[#18181b] p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 class="font-heading text-sm font-bold text-white">Standard Dialog</h4>
              <p class="text-xs text-zinc-400 mt-1">Modal verifikasi armada dengan checklist.</p>
            </div>
            
            <Dialog bind:open={isDialogOpen}>
              <DialogTrigger>
                <Button variant="default" size="sm" class="w-full">
                  <i class="bx bx-window-open text-base"></i>
                  <span>Buka Dialog</span>
                </Button>
              </DialogTrigger>

              <DialogContent class="sm:max-w-md bg-[#131316] border-white/10">
                <DialogHeader>
                  <DialogTitle class="font-heading text-lg text-white">Checklist Armada ARM-001</DialogTitle>
                  <DialogDescription class="text-xs text-zinc-400">
                    Armada dalam status HOLD 3 menit. Silakan cek kelayakan fisik.
                  </DialogDescription>
                </DialogHeader>

                <div class="space-y-2 py-2 text-xs text-zinc-300">
                  <div class="flex items-center gap-2 rounded-lg border border-white/10 bg-[#18181b] p-2.5">
                    <i class="bx bx-check text-emerald-400 text-base"></i>
                    <span>Tekanan ban dan rem depan/belakang siap</span>
                  </div>
                  <div class="flex items-center gap-2 rounded-lg border border-white/10 bg-[#18181b] p-2.5">
                    <i class="bx bx-check text-emerald-400 text-base"></i>
                    <span>Kapasitas baterai: 88%</span>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose>
                    <Button variant="outline" size="sm">Batal</Button>
                  </DialogClose>
                  <Button variant="default" size="sm" onclick={() => (isDialogOpen = false)}>Konfirmasi</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <!-- Confirmation Modal Trigger -->
          <div class="rounded-2xl border border-white/10 bg-[#18181b] p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 class="font-heading text-sm font-bold text-white">Confirmation Modal</h4>
              <p class="text-xs text-zinc-400 mt-1">Dialog konfirmasi aksi destruktif atau pelepasan kunci.</p>
            </div>

            <Button variant="destructive" size="sm" onclick={() => (isConfirmOpen = true)} class="w-full">
              <i class="bx bx-error text-base"></i>
              <span>Pelepasan Kunci</span>
            </Button>

            <ConfirmationModal
              bind:open={isConfirmOpen}
              title="Lepaskan Kunci Reservasi Armada?"
              description="Armada ARM-004 akan dikembalikan ke status AVAILABLE dan dapat diambil oleh rider lain."
              confirmText="Ya, Lepaskan"
              variant="destructive"
              onconfirm={() => triggerToast("Kunci armada berhasil dilepaskan.")}
            />
          </div>

          <!-- Onboarding Dialog Trigger -->
          <div class="rounded-2xl border border-white/10 bg-[#18181b] p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 class="font-heading text-sm font-bold text-white">Onboarding Dialog</h4>
              <p class="text-xs text-zinc-400 mt-1">Panduan interaktif 3-langkah untuk rider baru.</p>
            </div>

            <Button variant="outline" size="sm" onclick={() => (isOnboardingOpen = true)} class="w-full">
              <i class="bx bx-id-card text-base"></i>
              <span>Buka Onboarding</span>
            </Button>

            <OnboardingDialog
              bind:open={isOnboardingOpen}
              onfinish={() => triggerToast("Tutorial onboarding selesai!")}
            />
          </div>

          <!-- Floating Popover Trigger -->
          <div class="rounded-2xl border border-white/10 bg-[#18181b] p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 class="font-heading text-sm font-bold text-white">Floating Popover</h4>
              <p class="text-xs text-zinc-400 mt-1">Tooltip metrik ringkas zona DSS.</p>
            </div>

            <Popover>
              <PopoverTrigger>
                <Button variant="secondary" size="sm" class="w-full">
                  <i class="bx bx-info-circle text-base"></i>
                  <span>Lihat Telemetri</span>
                </Button>
              </PopoverTrigger>

              <PopoverContent class="w-72 bg-[#131316] border-white/10 text-white space-y-2">
                <h5 class="font-heading text-sm font-bold">Zona Central Core</h5>
                <p class="text-xs text-zinc-400">Skor TOPSIS: <strong class="text-[#FF634A]">0.892 (Rank #1)</strong></p>
                <p class="text-xs text-zinc-400">Kuota: 10/12 Rider</p>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </section>
    </main>
  {/if}

  <!-- =========================================================================
       VIEW 3: DSS TABLES & KPI METRICS (UNIFIED OUTFIT FONT)
       ========================================================================= -->
  {#if activeTab === "dss-table"}
    <main class="relative z-10 mx-auto max-w-7xl px-6 py-12 space-y-8">
      <div class="border-b border-white/10 pb-6">
        <h1 class="font-heading text-3xl font-bold text-white">DSS Analytics & Armada Registry</h1>
        <p class="mt-1 text-sm text-zinc-400 font-sans">
          Tampilan kartu KPI makro dan tabel ranking zona multi-kriteria TOPSIS dengan font Outfit.
        </p>
      </div>

      <!-- KPI Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="rounded-2xl border border-white/10 bg-[#131316] p-5 shadow-lg">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
            <span>TOTAL ARMADA AKTIF</span>
            <span class="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <i class="bx bx-trending-up"></i> +12.5%
            </span>
          </div>
          <div class="mt-3 font-heading text-3xl font-bold text-white">28 / 32</div>
          <p class="mt-1 text-xs text-zinc-500 font-sans">87.5% utilisasi armada hari ini</p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-[#131316] p-5 shadow-lg">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
            <span>OMZET PROYEKSI</span>
            <span class="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <i class="bx bx-trending-up"></i> +18.4%
            </span>
          </div>
          <div class="mt-3 font-heading text-3xl font-bold text-[#FF634A]">Rp 14.850.000</div>
          <p class="mt-1 text-xs text-zinc-500 font-sans">Berdasarkan data 4 hub operasional</p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-[#131316] p-5 shadow-lg">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
            <span>KONSISTENSI BWM (CR)</span>
            <span class="text-sky-400 font-heading text-xs bg-sky-500/10 px-2 py-0.5 rounded-full">
              CR = 0.024
            </span>
          </div>
          <div class="mt-3 font-heading text-3xl font-bold text-white">0.024</div>
          <p class="mt-1 text-xs text-emerald-400 font-sans">Kalibrasi sangat konsisten (&lt;0.10)</p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-[#131316] p-5 shadow-lg">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
            <span>DEVIASI GEOFENCE</span>
            <span class="flex items-center gap-1 text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full">
              <i class="bx bx-trending-down"></i> -3.2%
            </span>
          </div>
          <div class="mt-3 font-heading text-3xl font-bold text-white">0 Rider</div>
          <p class="mt-1 text-xs text-zinc-500 font-sans">100% rider dalam batas polygon</p>
        </div>
      </div>

      <!-- Data Table in Outfit Font -->
      <div class="rounded-3xl border border-white/10 bg-[#131316] overflow-hidden shadow-2xl">
        <div class="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 class="font-heading text-lg font-bold text-white">Ranking Rekomendasi Zona TOPSIS (Live)</h3>
            <p class="text-xs text-zinc-400 font-sans">Diperbarui setiap 30 menit melalui pipeline ETL spasial & cuaca</p>
          </div>
          <Button variant="outline" size="sm">
            <i class="bx bx-refresh text-base"></i>
            <span>Refresh Perhitungan</span>
          </Button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm font-sans">
            <thead class="bg-white/[0.03] text-xs font-heading uppercase text-zinc-400 border-b border-white/10">
              <tr>
                <th class="px-6 py-4">Rank</th>
                <th class="px-6 py-4">Nama Zona</th>
                <th class="px-6 py-4">Skor TOPSIS</th>
                <th class="px-6 py-4">POI (C1)</th>
                <th class="px-6 py-4">Cuaca (C4)</th>
                <th class="px-6 py-4">Kuota Rider</th>
                <th class="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.06] text-zinc-300">
              <tr class="hover:bg-white/[0.02]">
                <td class="px-6 py-4 font-bold text-[#FF634A]">#1</td>
                <td class="px-6 py-4 font-semibold text-white">Zona Central Core (Pusat)</td>
                <td class="px-6 py-4 font-bold text-white">0.892</td>
                <td class="px-6 py-4">142 POI</td>
                <td class="px-6 py-4 text-emerald-400">12.0 (Cerah)</td>
                <td class="px-6 py-4">10 / 12 Aktif</td>
                <td class="px-6 py-4"><Badge variant="success">High Demand</Badge></td>
              </tr>
              <tr class="hover:bg-white/[0.02]">
                <td class="px-6 py-4 font-bold text-white">#2</td>
                <td class="px-6 py-4 font-semibold text-white">Zona Koridor Barat (Bisnis)</td>
                <td class="px-6 py-4 font-bold text-white">0.745</td>
                <td class="px-6 py-4">98 POI</td>
                <td class="px-6 py-4 text-emerald-400">14.0 (Berawan)</td>
                <td class="px-6 py-4">8 / 8 Penuh</td>
                <td class="px-6 py-4"><Badge variant="pending">Full Capacity</Badge></td>
              </tr>
              <tr class="hover:bg-white/[0.02]">
                <td class="px-6 py-4 font-bold text-white">#3</td>
                <td class="px-6 py-4 font-semibold text-white">Zona Boulevard Timur (Residensial)</td>
                <td class="px-6 py-4 font-bold text-white">0.618</td>
                <td class="px-6 py-4">64 POI</td>
                <td class="px-6 py-4 text-amber-400">28.0 (Hujan Ringan)</td>
                <td class="px-6 py-4">4 / 10 Aktif</td>
                <td class="px-6 py-4"><Badge variant="progress">Available</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  {/if}

  <!-- =========================================================================
       VIEW 4: FAQ ACCORDION PREVIEW
       ========================================================================= -->
  {#if activeTab === "faq"}
    <main class="relative z-10 mx-auto max-w-4xl px-6 py-12 space-y-8">
      <div class="text-center space-y-3">
        <h1 class="font-heading text-4xl font-bold text-white">Frequently Asked Questions</h1>
        <p class="text-sm text-zinc-400 max-w-lg mx-auto font-sans">
          Panduan teknis dan operasional mengenai arsitektur MOVA DSS, antrean BullMQ, dan hak akses RBAC.
        </p>
      </div>

      <FAQAccordion items={faqList} />
    </main>
  {/if}

  <!-- =========================================================================
       VIEW 5: LOGIN PAGE PREVIEW
       ========================================================================= -->
  {#if activeTab === "login"}
    <div class="relative z-10">
      <LoginPage />
    </div>
  {/if}

  <!-- =========================================================================
       VIEW 6: REGISTER PAGE PREVIEW
       ========================================================================= -->
  {#if activeTab === "register"}
    <div class="relative z-10">
      <RegisterPage />
    </div>
  {/if}

  <!-- =========================================================================
       VIEW: DASHBOARD SHELL & SIDEBAR PREVIEW
       ========================================================================= -->
  {#if activeTab === "sidebar"}
    <div class="relative z-10 mx-auto max-w-[1440px] px-4 py-6">
      <div class="rounded-3xl border border-white/10 bg-[#121215] overflow-hidden shadow-2xl flex min-h-[780px]">
        <!-- 1. Collapsible Dashboard Sidebar -->
        <AppSidebar
          bind:collapsed={sidebarCollapsed}
          bind:activeId={activeSidebarId}
          onselect={(id) => triggerToast(`Navigasi aktif: ${id}`)}
        />

        <!-- 2. Main Dashboard Content Shell -->
        <div class="flex-1 flex flex-col bg-[#09090B] overflow-hidden">
          <!-- Top Dashboard Bar -->
          <div class="h-16 border-b border-white/10 bg-[#121215]/80 px-6 flex items-center justify-between backdrop-blur-md">
            <!-- Left Breadcrumbs -->
            <div class="flex items-center gap-2 text-xs font-heading">
              <span class="text-zinc-500">MOVA COMMAND</span>
              <span class="text-zinc-600">/</span>
              <span class="text-[#FF634A] font-bold uppercase">{activeSidebarId}</span>
            </div>

            <!-- Right Controls -->
            <div class="flex items-center gap-3">
              <div class="relative hidden sm:block w-64">
                <Input placeholder="Cari armada / zona..." icon="bx-search" hotkey="Ctrl K" class="h-9 text-xs" />
              </div>

              <Button variant="pill-primary" size="sm" onclick={() => triggerToast("Simulasi Klaim Armada Dijalankan")}>
                <i class="bx bx-plus-circle text-base"></i>
                <span class="hidden sm:inline">Klaim Armada</span>
              </Button>
            </div>
          </div>

          <!-- Dashboard Body Area -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Header Title -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 class="font-heading text-2xl font-bold text-white">
                  Dashboard Operasional & DSS
                </h2>
                <p class="text-xs text-zinc-400 font-sans mt-0.5">
                  Pemantauan alokasi armada, telemetri cuaca per hub, dan skor rekomendasi TOPSIS.
                </p>
              </div>

              <div class="flex items-center gap-2">
                <Badge variant="progress">ETL Cuaca: 30m TTL</Badge>
                <Badge variant="hold">Hold Lock: 180s</Badge>
              </div>
            </div>

            <!-- 4 Macro KPI Cards in Outfit -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="rounded-2xl border border-white/10 bg-[#131316] p-4 shadow-md">
                <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
                  <span>ARMADA AKTIF</span>
                  <Badge variant="success" class="h-5 px-2 text-[10px]">+12.5%</Badge>
                </div>
                <div class="mt-2 font-heading text-2xl font-bold text-white">28 / 32</div>
                <p class="mt-0.5 text-[11px] text-zinc-500">87.5% utilisasi shift pagi</p>
              </div>

              <div class="rounded-2xl border border-white/10 bg-[#131316] p-4 shadow-md">
                <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
                  <span>OMZET PROYEKSI</span>
                  <Badge variant="success" class="h-5 px-2 text-[10px]">+18.4%</Badge>
                </div>
                <div class="mt-2 font-heading text-2xl font-bold text-[#FF634A]">Rp 14.850.000</div>
                <p class="mt-0.5 text-[11px] text-zinc-500">Estimasi pendapatan harian</p>
              </div>

              <div class="rounded-2xl border border-white/10 bg-[#131316] p-4 shadow-md">
                <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
                  <span>KONSISTENSI BWM</span>
                  <Badge variant="in-review" class="h-5 px-2 text-[10px]">CR &lt; 0.10</Badge>
                </div>
                <div class="mt-2 font-heading text-2xl font-bold text-white">0.024</div>
                <p class="mt-0.5 text-[11px] text-emerald-400">Status kalibrasi valid</p>
              </div>

              <div class="rounded-2xl border border-white/10 bg-[#131316] p-4 shadow-md">
                <div class="flex items-center justify-between text-xs text-zinc-400 font-heading">
                  <span>GEOFENCE STATUS</span>
                  <Badge variant="active" class="h-5 px-2 text-[10px]">0 Deviasi</Badge>
                </div>
                <div class="mt-2 font-heading text-2xl font-bold text-white">100% In-Zone</div>
                <p class="mt-0.5 text-[11px] text-zinc-500">Seluruh rider dalam radius</p>
              </div>
            </div>

            <!-- TOPSIS Realtime Table Inside Dashboard Shell -->
            <div class="rounded-2xl border border-white/10 bg-[#131316] overflow-hidden shadow-lg">
              <div class="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h4 class="font-heading text-sm font-bold text-white">Ranking Rekomendasi Zona TOPSIS</h4>
                  <p class="text-[11px] text-zinc-400">Hasil kalkulasi multi-kriteria berbasis bobot BWM</p>
                </div>
                <Button variant="outline" size="sm" class="h-8 text-xs">
                  <i class="bx bx-refresh text-sm"></i>
                  <span>Refresh</span>
                </Button>
              </div>

              <table class="w-full text-left text-xs font-sans">
                <thead class="bg-white/[0.03] font-heading uppercase text-zinc-400 border-b border-white/10">
                  <tr>
                    <th class="px-5 py-3">Rank</th>
                    <th class="px-5 py-3">Nama Zona</th>
                    <th class="px-5 py-3">Skor TOPSIS</th>
                    <th class="px-5 py-3">POI (C1)</th>
                    <th class="px-5 py-3">Cuaca (C4)</th>
                    <th class="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/[0.06] text-zinc-300">
                  <tr class="hover:bg-white/[0.02]">
                    <td class="px-5 py-3 font-bold text-[#FF634A]">#1</td>
                    <td class="px-5 py-3 font-semibold text-white">Zona Central Core (Pusat)</td>
                    <td class="px-5 py-3 font-bold text-white">0.892</td>
                    <td class="px-5 py-3">142 POI</td>
                    <td class="px-5 py-3 text-emerald-400">12.0 (Cerah)</td>
                    <td class="px-5 py-3"><Badge variant="success">High Demand</Badge></td>
                  </tr>
                  <tr class="hover:bg-white/[0.02]">
                    <td class="px-5 py-3 font-bold text-white">#2</td>
                    <td class="px-5 py-3 font-semibold text-white">Zona Koridor Barat (Bisnis)</td>
                    <td class="px-5 py-3 font-bold text-white">0.745</td>
                    <td class="px-5 py-3">98 POI</td>
                    <td class="px-5 py-3 text-emerald-400">14.0 (Berawan)</td>
                    <td class="px-5 py-3"><Badge variant="pending">Full Capacity</Badge></td>
                  </tr>
                  <tr class="hover:bg-white/[0.02]">
                    <td class="px-5 py-3 font-bold text-white">#3</td>
                    <td class="px-5 py-3 font-semibold text-white">Zona Boulevard Timur (Residensial)</td>
                    <td class="px-5 py-3 font-bold text-white">0.618</td>
                    <td class="px-5 py-3">64 POI</td>
                    <td class="px-5 py-3 text-amber-400">28.0 (Hujan)</td>
                    <td class="px-5 py-3"><Badge variant="progress">Available</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- =========================================================================
       VIEW 7: 404 NOT FOUND PAGE PREVIEW
       ========================================================================= -->
  {#if activeTab === "notfound"}
    <div class="relative z-10">
      <NotFoundPage onHome={() => (activeTab = "bento")} />
    </div>
  {/if}
</div>

