import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Input,
  Badge,
  Button,
} from "@/components/primitives";
import {
  HelpCircle,
  Search,
  Shield,
  Briefcase,
  Sliders,
  Bike,
  Cpu,
  Layers,
  MapPin,
  Lock,
  DollarSign,
  Compass,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export function FaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL"); // "ALL" | "SUPERADMIN" | "MANAGEMENT" | "SUPERVISOR" | "RIDER"

  const roleFilters = [
    { id: "ALL", label: "Semua Kategori", icon: BookOpen, count: 12 },
    { id: "SUPERADMIN", label: "Super Admin", icon: Shield, count: 3 },
    { id: "MANAGEMENT", label: "Management", icon: Briefcase, count: 2 },
    { id: "SUPERVISOR", label: "Supervisor", icon: Sliders, count: 4 },
    { id: "RIDER", label: "Rider Lapangan", icon: Bike, count: 3 },
  ];

  const faqData = [
    // --- SUPERADMIN ---
    {
      id: "faq-bwm-calibration",
      role: "SUPERADMIN",
      roleLabel: "Super Admin",
      category: "DSS Engine",
      categoryIcon: Cpu,
      badgeColor: "brand",
      question: "Bagaimana kalibrasi bobot kriteria BWM (Best-Worst Method) memengaruhi mesin rekomendasi zona?",
      summary: "Penjelasan matematis perbandingan pasangan kriteria terhadap kriteria terbaik dan terburuk.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            MOVA DSS menggunakan metode <strong className="text-[var(--text-primary)]">Best-Worst Method (BWM)</strong> untuk menentukan bobot kepentingan kriteria evaluasi lokasi secara terstruktur dan konsisten (Consistency Ratio &le; 0.1).
          </p>
          <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
            <span className="font-semibold text-[var(--text-primary)] block">6 Kriteria Spasial Utama:</span>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
              <li><strong className="text-[var(--text-primary)]">C1 (Densitas POI)</strong>: Jumlah objek potensial di sekitar zona.</li>
              <li><strong className="text-[var(--text-primary)]">C2 (Diversitas POI)</strong>: Variasi kategori tempat keramaian (sekolah, kantor, pasar).</li>
              <li><strong className="text-[var(--text-primary)]">C3 (Keramaian Waktu)</strong>: Skor kesesuaian jam sibuk berdasarkan baseline Likert (1–5).</li>
              <li><strong className="text-[var(--text-primary)]">C4 (Risiko Cuaca)</strong>: Probabilitas presipitasi hujan real-time Open-Meteo.</li>
              <li><strong className="text-[var(--text-primary)]">C5 (Jarak Geografis)</strong>: Jarak geodesik Euclidean/Haversine dari armada ke titik evaluasi.</li>
              <li><strong className="text-[var(--text-primary)]">C6 (Tingkat Persaingan)</strong>: Kepadatan kompetitor kopi/minuman sejenis.</li>
            </ul>
          </div>
          <p>
            Jika belum ada kalibrasi BWM tersimpan yang aktif, sistem secara deterministik menggunakan bobot cadangan merata (<strong className="text-[var(--text-primary)]">Equal Fallback</strong> 1/6 &asymp; 16.67%).
          </p>
        </div>
      ),
    },
    {
      id: "faq-role-transition-security",
      role: "SUPERADMIN",
      roleLabel: "Super Admin",
      category: "Keamanan Sesi",
      categoryIcon: Lock,
      badgeColor: "danger",
      question: "Apa yang terjadi saat Superadmin melakukan perubahan role (Role Transition) pada pengguna online?",
      summary: "Penerapan standar OWASP & NIST SP 800-63B untuk pemutusan sesi seketika.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Perubahan jabatan pada MOVA diperlakukan sebagai <strong className="text-[var(--text-primary)]">Security State Change</strong> dalam satu transaksi PostgreSQL ACID:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
            <li>Memvalidasi status operasional target (contoh: Rider dilarang diubah role-nya jika sedang aktif bertugas).</li>
            <li>Memperbarui kolom <code className="px-1 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-primary)] font-mono">user.role</code> dan meng-increment nilai <code className="px-1 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-primary)] font-mono">auth_version</code> di database.</li>
            <li>Mencabut seluruh refresh session aktif pada server.</li>
            <li>Memancarkan event WebSocket <code className="px-1 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-primary)] font-mono">access:changed</code> langsung ke browser pengguna.</li>
          </ol>
          <p>
            Browser target seketika dialihkan ke layar khusus <strong className="text-[var(--text-primary)]">Access Changed Screen (/access-changed)</strong> untuk login ulang dengan konteks hak akses baru.
          </p>
        </div>
      ),
    },
    {
      id: "faq-overpass-osm-sync",
      role: "SUPERADMIN",
      roleLabel: "Super Admin",
      category: "Spasial & PostGIS",
      categoryIcon: MapPin,
      badgeColor: "warning",
      question: "Bagaimana mekanisme sinkronisasi data Jalan Tol & Protokol dari Overpass OSM?",
      summary: "Validasi pembatasan jalan dan proteksi overlap polygon zona.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Modul <strong className="text-[var(--text-primary)]">RoadOverpassSyncService</strong> menyinkronkan data geometri LineString (SRID 4326) dari OpenStreetMap API ke database PostGIS dengan boundary wilayah Sidoarjo:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">Tier 1 (Zona Polygon)</strong>: Menolak pembuatan zona baru yang beririsan langsung (<code className="font-mono">ST_Intersects</code>) dengan jalan tol terlarang (HTTP 409).</li>
            <li><strong className="text-[var(--text-primary)]">Tier 2 (Candidate Spot)</strong>: Menerapkan buffer proteksi radius 10 meter.</li>
            <li><strong className="text-[var(--text-primary)]">Tier 3 (Rider Telemetry)</strong>: Memicu peringatan <code className="font-mono text-amber-500">PROHIBITED_ROAD_ALERT</code> jika rider mendekati jalan tol dalam radius 50 meter.</li>
          </ul>
        </div>
      ),
    },

    // --- MANAGEMENT ---
    {
      id: "faq-financial-masking",
      role: "MANAGEMENT",
      roleLabel: "Management",
      category: "Keamanan Finansial",
      categoryIcon: DollarSign,
      badgeColor: "brand",
      question: "Bagaimana sistem menjamin kerahasiaan data omzet penjualan (Zero Financial Leakage)?",
      summary: "Field-level projection filter pada WebSocket dan REST API antar role.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            MOVA menerapkan <strong className="text-[var(--text-primary)]">Role-Based Field Projections</strong> yang ketat pada siaran langsung penjualan (<code className="font-mono">SALE_RECORDED</code>):
          </p>
          <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-emerald-400 font-semibold">Management &amp; Superadmin:</span>
              <span>unit_price, total_price, gross_revenue, profit_margin</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-[var(--border-subtle)]">
              <span className="text-amber-400 font-semibold">Supervisor &amp; Rider:</span>
              <span>product_name, qty (Data nominal rupiah di-sanitize 100%)</span>
            </div>
          </div>
          <p>
            Dengan arsitektur ini, supervisor di lapangan dapat memantau volume unit terjual tanpa mengekspos margin bisnis strategis perusahaan.
          </p>
        </div>
      ),
    },
    {
      id: "faq-kpi-aggregation",
      role: "MANAGEMENT",
      roleLabel: "Management",
      category: "Analitik Bisnis",
      categoryIcon: Briefcase,
      badgeColor: "brand",
      question: "Bagaimana metrik KPI Multi-Zona dan Trend Penjualan dihitung?",
      summary: "Agregasi time-series otomatis dengan invalidasi cache cerdas di Redis.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Dashboard Overview melakukan agregasi data operasional mencakup total pendapatan harian, okupansi kapasitas zona, armada aktif, serta analisis tren 7 hari / 30 hari.
          </p>
          <p>
            Untuk performa kilat (&lt;50ms), hasil kueri di-cache pada Redis dan secara otomatis di-invalidasi ketika transaksi baru dicatat oleh Rider di lapangan.
          </p>
        </div>
      ),
    },

    // --- SUPERVISOR ---
    {
      id: "faq-topsis-scoring",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "DSS Engine",
      categoryIcon: Cpu,
      badgeColor: "brand",
      question: "Bagaimana algoritma TOPSIS menyusun peringkat rekomendasi zona untuk rider?",
      summary: "Matriks keputusan ternormalisasi dan perhitungan jarak solusi ideal positif/negatif.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Metode <strong className="text-[var(--text-primary)]">TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution)</strong> mengevaluasi seluruh zona aktif melalui tahapan berikut:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">Matriks Keputusan (X_m x 6)</strong>: Mengambil nilai aktual C1 s.d. C6 dari database spasial.</li>
            <li><strong className="text-[var(--text-primary)]">Normalisasi Terbobot (R dan Y)</strong>: Mengalikan nilai normalisasi vektor dengan bobot kriteria BWM aktif.</li>
            <li><strong className="text-[var(--text-primary)]">Solusi Ideal (A+ dan A-)</strong>: Menentukan titik terbaik (benefit maksimum, cost minimum) dan titik terburuk.</li>
            <li><strong className="text-[var(--text-primary)]">Jarak Separasi (D+ dan D-)</strong>: Menghitung jarak Euclidean ke solusi ideal.</li>
            <li><strong className="text-[var(--text-primary)]">Skor Preferensi (Vi)</strong>: Vi = D- / (D+ + D-) di mana zona dengan skor tertinggi berada di Peringkat 1.</li>
          </ol>
        </div>
      ),
    },
    {
      id: "faq-geofence-alert",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "Armada & LBS",
      categoryIcon: MapPin,
      badgeColor: "danger",
      question: "Apa yang memicu status GEOFENCE_BREACH dan bagaimana supervisor menindaklanjutinya?",
      summary: "Peringatan otomatis saat koordinat telemetri GPS rider berada di luar polygon zona tugas.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Setiap kali aplikasi rider mengirim pembaruan koordinat GPS melalui WebSocket:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
            <li>Engine spasial menjalankan fungsi PostGIS <code className="font-mono">ST_Contains(zone.polygon, ST_SetSRID(ST_Point(lng, lat), 4326))</code>.</li>
            <li>Jika posisi terdeteksi di luar polygon zona tugas, event <code className="font-mono text-rose-500">GEOFENCE_BREACH</code> dipancarkan seketika ke radar Live MapOps Supervisor.</li>
            <li>HP Rider menerima peringatan getar/visual untuk segera kembali ke dalam batas wilayah operasional yang telah disetujui.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "faq-zone-capacity-overflow",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "Operasional Lapangan",
      categoryIcon: Sliders,
      badgeColor: "warning",
      question: "Mengapa sistem membatasi penugasan rider ke zona tertentu (Kapasitas Penuh)?",
      summary: "Menghindari kanibalisasi penjualan antar armada dalam satu area jangkauan.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Setiap zona memiliki konfigurasi <strong className="text-[var(--text-primary)]">Max Capacity</strong> (misal: 3 rider). Jika kuota rider bertugas telah mencapai kapasitas maksimal, sistem akan mencegah penugasan baru ke zona tersebut dan mesin DSS secara cerdas merekomendasikan zona alternatif terbaik berikutnya.
          </p>
        </div>
      ),
    },
    {
      id: "faq-supervisor-dispatch-flow",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "Operasional Lapangan",
      categoryIcon: Sliders,
      badgeColor: "brand",
      question: "Bagaimana urutan siklus penugasan tugas dari Supervisor ke Rider?",
      summary: "Flow end-to-end penugasan armada dan check-in lokasi.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Urutan formal penugasan harian di MOVA:
          </p>
          <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1 text-[11px] font-mono">
            <div>1. Supervisor memilih Rekomendasi TOPSIS &amp; Menugaskan Rider &rarr; Status: <span className="text-amber-400">ASSIGNED</span></div>
            <div>2. Rider melakukan Hold &amp; Claim Armada di Hub &rarr; Status Armada: <span className="text-blue-400">IN_USE</span></div>
            <div>3. Rider tiba di lokasi &amp; melakukan GPS Check-in &rarr; Status: <span className="text-emerald-400">CHECKED_IN</span></div>
            <div>4. Rider mencatat transaksi penjualan POS &amp; checkout akhir hari.</div>
          </div>
        </div>
      ),
    },

    // --- RIDER ---
    {
      id: "faq-armada-hold-lock",
      role: "RIDER",
      roleLabel: "Rider Lapangan",
      category: "Armada & LBS",
      categoryIcon: Bike,
      badgeColor: "brand",
      question: "Bagaimana cara kerja Hold Armada 5 Menit saat mengambil unit di Hub?",
      summary: "Ticket-booking lock untuk mencegah perebutan armada yang sama oleh dua rider sekaligus.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Saat Rider memilih armada motor/gerobak di katalog Hub:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
            <li>Armada masuk ke status <strong className="text-[var(--text-primary)]">HELD</strong> selama tepat 5 menit via Redis key lock.</li>
            <li>Rider lain pada saat bersamaan tidak dapat memilih unit tersebut (tombol klaim disabled / abu-abu).</li>
            <li>Jika Rider tidak mengonfirmasi klaim fisik dalam 5 menit, background worker <strong className="text-[var(--text-primary)]">BullMQ</strong> otomatis melepas lock dan mengembalikan status armada menjadi <code className="font-mono text-emerald-400">ACTIVE</code>.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "faq-rider-gps-checkin",
      role: "RIDER",
      roleLabel: "Rider Lapangan",
      category: "Operasional Lapangan",
      categoryIcon: MapPin,
      badgeColor: "brand",
      question: "Mengapa tombol Check-In tidak bisa ditekan saat berada di luar zona?",
      summary: "Validasi PostGIS Spatial Check-in memastikan kepatuhan lokasi jualan.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Untuk menjaga kepatuhan operasional, sistem mencocokkan koordinat GPS smartphone Rider dengan batas poligon zona penugasan:
          </p>
          <p>
            Tombol <strong className="text-[var(--text-primary)]">Check-In</strong> hanya akan aktif jika Anda sudah berada secara fisik di dalam perimeter zona yang ditentukan. Setelah check-in berhasil, status Anda berubah menjadi <strong className="text-emerald-400">CHECKED_IN</strong> dan Anda dapat mulai mencatat penjualan produk.
          </p>
        </div>
      ),
    },
    {
      id: "faq-rider-pos-checkout",
      role: "RIDER",
      roleLabel: "Rider Lapangan",
      category: "POS & Penjualan",
      categoryIcon: DollarSign,
      badgeColor: "brand",
      question: "Bagaimana alur pencatatan penjualan dan penutupan sesi tugas (Checkout)?",
      summary: "Pencatatan kasir produk, rekonsiliasi stok, dan pengembalian armada ke Hub.",
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Pada menu Rider Operasional:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
            <li>Pilih menu <strong className="text-[var(--text-primary)]">Catat Penjualan</strong> setiap kali ada transaksi minuman terjual (memilih produk & jumlah cup).</li>
            <li>Di akhir jam operasional, tekan tombol <strong className="text-[var(--text-primary)]">Tutup Sesi (Checkout)</strong>.</li>
            <li>Kembalikan armada fisik ke Hub. Status armada akan otomatis kembali menjadi <strong className="text-emerald-400">ACTIVE</strong> dan riwayat tugas Anda tersimpan permanen di profil pribadi.</li>
          </ol>
        </div>
      ),
    },
  ];

  // Filtered FAQ items based on Search & Selected Role Tab
  const filteredFaqs = useMemo(() => {
    return faqData.filter((item) => {
      const matchRole = selectedRole === "ALL" || item.role === selectedRole;
      if (!matchRole) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchQuestion = item.question.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchRoleLabel = item.roleLabel.toLowerCase().includes(q);

      return matchQuestion || matchSummary || matchCategory || matchRoleLabel;
    });
  }, [searchQuery, selectedRole]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Header Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-linear-to-l from-[var(--accent-primary)]/10 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent-primary)] font-mono text-xs font-semibold uppercase tracking-wider mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Knowledge Base & Panduan Teknis</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              FAQ & Panduan Operasional MOVA
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Dokumentasi teknis, aturan keamanan, serta panduan alur kerja sistem DSS armada Sidoarjo.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <strong>{faqData.length}</strong> Pertanyaan Teknis
            </span>
          </div>
        </div>

        {/* Real-time Search Box */}
        <div className="mt-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci (contoh: TOPSIS, BWM, Geofence, Sesi, Overpass, Hold Armada, POS)..."
            className="w-full h-10 pl-10 pr-4 text-xs bg-[var(--surface-muted)]/70 hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-raised)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[var(--radius-md)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Hapus
            </button>
          )}
        </div>

        {/* Role Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] mt-5 pt-4">
          {roleFilters.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedRole === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRole(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[var(--accent-primary)] text-white font-semibold shadow-xs"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-white/20 text-white" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                  }`}
                >
                  {tab.id === "ALL"
                    ? faqData.length
                    : faqData.filter((f) => f.role === tab.id).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion Questions List */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs">
        {filteredFaqs.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <HelpCircle className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Tidak Ada Pertanyaan yang Cocok
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Tidak ditemukan pertanyaan dengan kata kunci "{searchQuery}". Coba kata kunci lain atau pilih tab Semua Kategori.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedRole("ALL");
              }}
              className="mt-3 text-xs"
            >
              Reset Filter
            </Button>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {filteredFaqs.map((item) => {
              const CategoryIcon = item.categoryIcon;
              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border border-[var(--border-subtle)] rounded-[var(--radius-md)] px-4 bg-[var(--surface-raised)]/30 hover:bg-[var(--surface-raised)]/60 transition-colors"
                >
                  <AccordionTrigger className="py-3.5 hover:no-underline">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-left w-full pr-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                          <CategoryIcon className="w-3 h-3 text-[var(--accent-primary)]" />
                          {item.category}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                          [{item.roleLabel}]
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {item.question}
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2 pb-4 text-xs border-t border-[var(--border-subtle)]/60 mt-1">
                    <p className="text-[11px] text-[var(--text-muted)] italic mb-3 font-mono">
                      Ringkasan: {item.summary}
                    </p>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* Footer Support Notice */}
      <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span>
            Butuh bantuan teknis atau menemukan kendala operasional armada? Hubungi Super Admin sistem MOVA.
          </span>
        </div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-[var(--accent-primary)] font-semibold hover:underline shrink-0"
        >
          Lihat Profil Akun Saya
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
