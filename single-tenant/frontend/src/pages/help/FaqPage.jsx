import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Button,
} from "@/components/primitives";
import {
  HelpCircle,
  Search,
  Shield,
  Briefcase,
  Sliders,
  Bike,
  BookOpen,
  ArrowRight,
  Layers,
  MapPin,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export function FaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL"); // "ALL" | "SUPERADMIN" | "MANAGEMENT" | "SUPERVISOR" | "RIDER"

  const roleFilters = [
    { id: "ALL", label: "Semua", icon: BookOpen },
    { id: "SUPERADMIN", label: "Super Admin", icon: Shield },
    { id: "MANAGEMENT", label: "Management", icon: Briefcase },
    { id: "SUPERVISOR", label: "Supervisor", icon: Sliders },
    { id: "RIDER", label: "Rider Lapangan", icon: Bike },
  ];

  const faqData = [
    // --- UMUM / SISTEM ---
    {
      id: "faq-mova-overview",
      role: "ALL",
      roleLabel: "Umum",
      category: "Tentang Sistem",
      question: "Apa itu aplikasi MOVA dan bagaimana sistem ini membantu operasional harian?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            <strong className="text-[var(--text-primary)]">MOVA</strong> adalah platform manajemen dan pusat komando operasional untuk armada gerobak serta motor minuman keliling di wilayah Sidoarjo.
          </p>
          <p>
            Sistem ini membantu menghubungkan seluruh tim operasional: mulai dari <strong className="text-[var(--text-primary)]">Manajemen</strong> yang memantau total omzet harian, <strong className="text-[var(--text-primary)]">Supervisor</strong> yang menentukan titik jualan paling ramai dan menugaskan rider, hingga <strong className="text-[var(--text-primary)]">Rider Lapangan</strong> yang mengambil armada dan mencatat transaksi penjualan produk secara langsung.
          </p>
        </div>
      ),
    },
    {
      id: "faq-session-reauth",
      role: "ALL",
      roleLabel: "Umum",
      category: "Akun & Keamanan",
      question: "Mengapa akun saya otomatis keluar (logout) dan meminta login kembali?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Hal ini terjadi demi menjaga keamanan hak akses akun Anda dalam dua kondisi utama:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">Perubahan Jabatan</strong>: Administrator baru saja memperbarui peran akun Anda (misalnya dari Management menjadi Supervisor). Sistem secara otomatis mengakhiri sesi lama agar saat login kembali Anda langsung menerima menu kerja yang sesuai.</li>
            <li><strong className="text-[var(--text-primary)]">Masa Berlaku Sesi Berakhir</strong>: Akun tidak digunakan dalam jangka waktu tertentu sehingga membutuhkan autentikasi ulang.</li>
          </ul>
        </div>
      ),
    },

    // --- SUPERADMIN ---
    {
      id: "faq-role-change-process",
      role: "SUPERADMIN",
      roleLabel: "Super Admin",
      category: "Manajemen Pengguna",
      question: "Bagaimana alur pengubahan jabatan (role) pengguna yang aman?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Pengubahan jabatan dilakukan melalui menu <strong className="text-[var(--text-primary)]">Users</strong> &rarr; pilih pengguna &rarr; klik tombol <strong className="text-[var(--text-primary)]">Ganti Jabatan</strong>.
          </p>
          <p>
            Sistem secara otomatis memeriksa apakah pengguna tersebut sedang memiliki tugas aktif di lapangan (misalnya Rider yang sedang bertugas jualan). Jika masih aktif, transisi jabatan akan ditolak sampai sesi tugas diselesaikan terlebih dahulu. Setelah jabatan diubah, seluruh sesi aktif pengguna tersebut dicabut seketika demi keamanan.
          </p>
        </div>
      ),
    },
    {
      id: "faq-location-factors",
      role: "SUPERADMIN",
      roleLabel: "Super Admin",
      category: "Pengaturan Sistem",
      question: "Bagaimana cara mengatur prioritas faktor penentu lokasi jualan terbaik?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Sistem rekomendasi MOVA mengevaluasi lokasi berdasarkan 6 pertimbangan utama:
          </p>
          <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
            <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
              <li><strong className="text-[var(--text-primary)]">Kepadatan Titik Keramaian</strong>: Jumlah sarana publik di sekitar area jualan.</li>
              <li><strong className="text-[var(--text-primary)]">Variasi Tempat</strong>: Ragam lokasi seperti perkantoran, sekolah, dan pasar.</li>
              <li><strong className="text-[var(--text-primary)]">Jam Ramai</strong>: Kesesuaian waktu operasional (pagi, siang, atau sore).</li>
              <li><strong className="text-[var(--text-primary)]">Kondisi Cuaca</strong>: Peluang hujan saat jam bertugas.</li>
              <li><strong className="text-[var(--text-primary)]">Jarak Tempuh</strong>: Jarak perjalanan armada dari lokasi asal ke titik jualan.</li>
              <li><strong className="text-[var(--text-primary)]">Tingkat Persaingan</strong>: Banyaknya penjual minuman sejenis di lokasi tersebut.</li>
            </ol>
          </div>
          <p>
            Super Admin dapat mengkalibrasi tingkat kepentingan masing-masing faktor agar sesuai dengan prioritas bisnis perusahaan.
          </p>
        </div>
      ),
    },
    {
      id: "faq-prohibited-zones",
      role: "SUPERADMIN",
      roleLabel: "Super Admin",
      category: "Pengaturan Wilayah",
      question: "Mengapa sistem melarang pembuatan zona jualan di area tertentu?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Demi keselamatan armada dan kepatuhan hukum lalu lintas, sistem secara otomatis melarang pembuatan zona operasional yang melintasi <strong className="text-[var(--text-primary)]">Jalan Tol</strong> atau jalur cepat terlarang.
          </p>
          <p>
            Jika sebuah poligon wilayah digambar melewati jalur terlarang, sistem akan menampilkan peringatan dan menolak penyimpanan zona sampai batas wilayah disesuaikan.
          </p>
        </div>
      ),
    },

    // --- MANAGEMENT ---
    {
      id: "faq-financial-privacy",
      role: "MANAGEMENT",
      roleLabel: "Management",
      category: "Laporan & Privasi",
      question: "Siapa saja yang dapat melihat data nominal omzet dan laba penjualan?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Data finansial strategis seperti <strong className="text-[var(--text-primary)]">harga jual satuan, total pendapatan harian, dan margin keuntungan</strong> hanya dapat dilihat oleh level <strong className="text-[var(--text-primary)]">Management dan Super Admin</strong>.
          </p>
          <p>
            Pengguna di level Supervisor dan Rider hanya melihat informasi jumlah unit (cup) produk yang terjual untuk kebutuhan operasional dan pengelolaan stok, sehingga kerahasiaan performa keuangan perusahaan tetap terjaga.
          </p>
        </div>
      ),
    },
    {
      id: "faq-dashboard-kpi",
      role: "MANAGEMENT",
      roleLabel: "Management",
      category: "Analitik Bisnis",
      question: "Informasi apa saja yang dapat dipantau pada Dashboard Overview?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Dashboard Overview menyajikan ringkasan eksekutif secara real-time, meliputi:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">Total Omzet Harian</strong>: Akumulasi nilai transaksi penjualan seluruh armada yang sedang aktif.</li>
            <li><strong className="text-[var(--text-primary)]">Status Armada</strong>: Jumlah unit yang sedang beroperasi, bersiap di Hub, atau dalam pemeliharaan.</li>
            <li><strong className="text-[var(--text-primary)]">Peringkat Produk Terlaris</strong>: Minuman yang paling banyak dipesan hari ini.</li>
            <li><strong className="text-[var(--text-primary)]">Efektivitas Zona</strong>: Wilayah dengan tingkat penjualan tertinggi.</li>
          </ul>
        </div>
      ),
    },

    // --- SUPERVISOR ---
    {
      id: "faq-recommendation-dispatch",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "Penugasan Wilayah",
      question: "Bagaimana cara menentukan lokasi jualan terbaik untuk rider setiap harinya?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Supervisor dapat membuka menu <strong className="text-[var(--text-primary)]">Rekomendasi Lokasi</strong>. Sistem akan menghitung kondisi cuaca terkini, jam keramaian, dan tingkat persaingan untuk menampilkan daftar peringkat zona dari yang paling berpotensi menghasilkan penjualan tertinggi (Peringkat 1).
          </p>
          <p>
            Supervisor cukup memilih zona teratas dan menugaskan rider yang sedang bersiap di Hub.
          </p>
        </div>
      ),
    },
    {
      id: "faq-geofence-handling",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "Monitoring Lapangan",
      question: "Apa yang harus dilakukan jika muncul peringatan keluar wilayah (Geofence Alert)?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Peringatan ini menandakan bahwa posisi GPS armada rider terdeteksi berada di luar batas area jualan yang telah disetujui.
          </p>
          <p>
            Langkah penanganan:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
            <li>Buka menu <strong className="text-[var(--text-primary)]">Live MapOps</strong> untuk melihat titik lokasi rider di peta secara langsung.</li>
            <li>Hubungi rider bersangkutan untuk mengonfirmasi kondisi lapangan (misalnya ada pengalihan jalan atau acara keramaian dadakan).</li>
            <li>Arahkan rider untuk kembali ke dalam area operasional yang aman.</li>
          </ol>
        </div>
      ),
    },
    {
      id: "faq-zone-capacity",
      role: "SUPERVISOR",
      roleLabel: "Supervisor",
      category: "Kapasitas Armada",
      question: "Mengapa ada zona yang tidak dapat ditugaskan rider lagi (Kapasitas Penuh)?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Setiap zona memiliki kuota maksimal jumlah gerobak/motor (misal: 3 unit) untuk mencegah persaingan jualan antar sesama armada MOVA dalam satu radius yang sempit.
          </p>
          <p>
            Jika kuota suatu zona telah penuh, sistem akan mengunci penugasan ke zona tersebut dan menyarankan supervisor untuk menempatkan rider di zona alternatif terbaik berikutnya.
          </p>
        </div>
      ),
    },

    // --- RIDER LAPANGAN ---
    {
      id: "faq-rider-armada-claim",
      role: "RIDER",
      roleLabel: "Rider Lapangan",
      category: "Armada di Hub",
      question: "Bagaimana cara mengambil dan memesan unit armada di Hub operasional?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Pada halaman aplikasi Rider:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
            <li>Pilih armada motor atau gerobak yang tersedia di Hub.</li>
            <li>Tekan tombol <strong className="text-[var(--text-primary)]">Pesan Armada</strong>. Unit tersebut akan terkunci khusus untuk Anda selama <strong className="text-[var(--text-primary)]">5 menit</strong> agar tidak diambil rider lain selagi Anda melakukan pengecekan fisik unit.</li>
            <li>Setelah memeriksa kondisi armada dan stok awal, tekan <strong className="text-[var(--text-primary)]">Konfirmasi Klaim</strong> untuk memulai perjalanan menuju lokasi tugas.</li>
          </ol>
        </div>
      ),
    },
    {
      id: "faq-rider-checkin-rule",
      role: "RIDER",
      roleLabel: "Rider Lapangan",
      category: "Operasional Jualan",
      question: "Kapan dan bagaimana cara melakukan Check-In di lokasi jualan?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Tombol <strong className="text-[var(--text-primary)]">Check-In</strong> akan aktif secara otomatis ketika GPS smartphone mendeteksi bahwa Anda sudah tiba di dalam batas area jualan yang ditugaskan.
          </p>
          <p>
            Begitu Anda menekan Check-In, status tugas Anda resmi menjadi <strong className="text-emerald-500 font-semibold">Sedang Jualan</strong> dan menu pencatatan transaksi kasir dapat langsung digunakan.
          </p>
        </div>
      ),
    },
    {
      id: "faq-rider-sales-checkout",
      role: "RIDER",
      roleLabel: "Rider Lapangan",
      category: "Kasir & Selesai Tugas",
      question: "Bagaimana cara mencatat transaksi penjualan dan menyelesaikan tugas harian?",
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            Panduan alur kasir dan penutupan tugas:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
            <li><strong className="text-[var(--text-primary)]">Catat Penjualan</strong>: Setiap kali ada pembelian, pilih menu kasir, masukkan varian minuman dan jumlah cup yang dipesan pelanggan, lalu simpan transaksi.</li>
            <li><strong className="text-[var(--text-primary)]">Tutup Sesi (Checkout)</strong>: Di akhir jam kerja, tekan tombol <strong className="text-[var(--text-primary)]">Selesaikan Sesi Jualan</strong> dan bawa armada kembali ke Hub.</li>
            <li>Armada yang telah dikembalikan akan otomatis berstatus siap digunakan kembali untuk jadwal tugas berikutnya.</li>
          </ul>
        </div>
      ),
    },
  ];

  // Filtered FAQ items based on Search & Selected Role Tab
  const filteredFaqs = useMemo(() => {
    return faqData.filter((item) => {
      const matchRole =
        selectedRole === "ALL" ||
        item.role === "ALL" ||
        item.role === selectedRole;

      if (!matchRole) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchQuestion = item.question.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchRoleLabel = item.roleLabel.toLowerCase().includes(q);

      return matchQuestion || matchCategory || matchRoleLabel;
    });
  }, [searchQuery, selectedRole]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header Panel */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            FAQ & Panduan Operasional
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Panduan alur kerja dan jawaban atas pertanyaan umum seputar operasional harian sistem MOVA.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari panduan atau pertanyaan (contoh: lokasi jualan, omzet, check-in, armada)..."
            className="w-full h-9 pl-9 pr-4 text-xs bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-raised)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[var(--radius-md)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Hapus
            </button>
          )}
        </div>

        {/* Role Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-3">
          {roleFilters.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedRole === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRole(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[var(--accent-primary)] text-white font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion List */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs">
        {filteredFaqs.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <HelpCircle className="w-7 h-7 text-[var(--text-muted)] mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Tidak ada hasil ditemukan
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Tidak ditemukan panduan dengan kata kunci "{searchQuery}".
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedRole("ALL");
              }}
              className="mt-2 text-xs"
            >
              Tampilkan Semua Panduan
            </Button>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full divide-y divide-[var(--border-subtle)]">
            {filteredFaqs.map((item) => (
              <AccordionItem key={item.id} value={item.id} className="py-1">
                <AccordionTrigger className="py-3 hover:no-underline text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 pr-3 w-full">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {item.category}
                      </span>
                      {item.roleLabel !== "Umum" && (
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">
                          {item.roleLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {item.question}
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-1 pb-3 pl-1 pr-2">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Footer Support Notice */}
      <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span>
            Membutuhkan bantuan lebih lanjut terkait akun atau operasional? Hubungi Administrator sistem.
          </span>
        </div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-[var(--accent-primary)] font-medium hover:underline shrink-0"
        >
          Lihat Profil Akun
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
