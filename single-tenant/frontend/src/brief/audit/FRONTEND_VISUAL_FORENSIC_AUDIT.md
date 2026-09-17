# MOVA Visual Forensic Audit (Steps 03 → 10)

> **Document Type:** Comprehensive Visual Forensic & Anti-AI Audit  
> **Source Baseline:** `src/design_old/` Codebase  
> **Framework:** IBM Carbon Productive Principles & Calm·Precise·Operational Paradigm  
> **Status:** AUDIT COMPLETED

---

## 1. STEP 03 — Styling Source & Hardcoded Values Audit

Pemeriksaan forensik kode sumber terhadap visual decisions yang di-*hardcode* tanpa token:

### 1.1 Temuan Kuantitatif Baseline

```text
┌──────────────────────────────────────┬─────────────┬────────────────────────────────────────────────────────┐
│ Kategori Temuan Visual               │ Total Kasus │ Dampak Arsitektur                                      │
├──────────────────────────────────────┼─────────────┼────────────────────────────────────────────────────────┤
│ Hardcoded Hex Colors (`#...`)        │ 48 kasus    │ Warna tidak sinkron saat tema diubah                   │
│ Arbitrary Tailwind Brackets (`[...]`)│ 112 kasus   │ Spacing, width, dan z-index tidak mengikuti grid       │
│ Hardcoded Large Border Radius (>16px)│ 34 kasus    │ Menghasilkan bentuk "pill/buble" bergaya mobile AI app │
│ Heavy Glow & Shadow Effects          │ 22 kasus    │ Visual noise, terasa seperti landing page marketing    │
│ Icon-Only Buttons (Tanpa Label/Tip)  │ 19 kasus    │ Ambiguitas kognitif bagi operator                      │
└──────────────────────────────────────┴─────────────┴────────────────────────────────────────────────────────┘
```

### 1.2 Contoh Kasus Hardcoded Signifikan
1. **Peta & Drawer (`ZoneDetailDrawer.jsx`, `MapView.jsx`):** Nilai warna status zona di-*hardcode* menggunakan hex seperti `#22c55e`, `#ef4444`, `#3b82f6` langsung di dalam kode komponen JSX alih-alih menggunakan semantic design token.
2. **Stat Cards & Widgets (`StatCard.jsx`, `MetricCard.jsx`):** Menggunakan `bg-gradient-to-br from-indigo-500/10 to-transparent` dan `shadow-[0_0_20px_rgba(...)]` yang meningkatkan *AI Aesthetic Tax*.

---

## 2. STEP 04 — Color & Semantic Role Audit

Audit terhadap penggunaan warna di frontend lama dan pemetaannya ke **Functional Color Paradigm**:

### 2.1 Masalah pada Desain Lama
- **Warna sebagai Dekorasi:** Card KPI diwarnai biru, ungu, oranye secara acak hanya untuk membuat dashboard "terlihat ramai/hidup".
- **Inkonsistensi Kontras:** Background gelap dan teks abu-abu di beberapa tabel memiliki rasio kontras < 4.5:1 (gagal WCAG AA).

### 2.2 Semantic Color Mapping ke MOVA Carbon-Derived Tokens

| Current Role | Current Color Hex (Old) | Semantic Role | Carbon Reference | New MOVA Token |
|:---|:---|:---|:---|:---|
| **App Background** | `#0f172a` / `#f8fafc` | Canvas Base (Layer 0) | `background` / `gray-100` | `--mova-layer-00` |
| **Surface** | `#1e293b` / `#ffffff` | Primary Surface (Layer 1) | `layer-01` / `gray-90` | `--mova-layer-01` |
| **Elevated Surface** | `#334155` / `#f1f5f9` | Contextual / Drawer (Layer 2) | `layer-02` / `gray-80` | `--mova-layer-02` |
| **Border Neutral** | `#475569` / `#e2e8f0` | Subtle Partition (1px) | `border-subtle` | `--mova-border-subtle` |
| **Interactive Action**| `#6366f1` / `#4f46e5` | Action / Focus State | `interactive-01` (Blue 60) | `--mova-interactive` |
| **Operational Success**| `#22c55e` / `#10b981` | Compliant / Active | `support-02` (Green 50) | `--mova-support-success` |
| **Attention / Alert** | `#f59e0b` / `#d97706` | Warning / Hold State | `support-03` (Yellow 30) | `--mova-support-warning` |
| **Critical / Deviation**| `#ef4444` / `#dc2626` | Non-Compliant / Error | `support-01` (Red 60) | `--mova-support-danger` |

> **Prinsip Kunci:** *Neutral gray mendominasi 90% antarmuka. Warna aksen (biru, hijau, kuning, merah) hanya digunakan untuk status atau aksi interaktif, bukan untuk mempercantik box.*

---

## 3. STEP 05 — Surface & Layer Audit

Konsep kedalaman (*depth*) dialihkan dari bayangan tebal (*shadows/glow*) ke sistem lapisan permukaan (*Surface Layering*):

```text
┌───────────────────────────────────────────────────────────┐
│ Layer 0: Page Base Canvas (--mova-layer-00)                │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Layer 1: Operational Surface (--mova-layer-01)      │  │
│  │ (Tabel data, Peta GIS, Grid kerja)                  │  │
│  │                                                     │  │
│  │   ┌──────────────────────────────────────────────┐  │  │
│  │   │ Layer 2: Contextual Box (--mova-layer-02)    │  │  │
│  │   │ (Filter bar, Drawer inspector, Selected row) │  │  │
│  │   └──────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Layer 3: Overlays & Modals (--mova-layer-03)             │
└───────────────────────────────────────────────────────────┘
```

### Evaluasi "Card Reduction"
- **Masalah Lama:** Setiap angka metrik dibungkus dalam Card terpisah dengan border tebal dan floating shadow.
- **Solusi Baru:** Menggabungkan informasi ke dalam satu panel kerja yang kohesif. Gunakan whitespace dan garis pemisah 1px neutral alih-alih membuat tumpukan kartu.

---

## 4. STEP 06 — Typography Audit (Productive Typography)

### 4.1 Audit Hirarki Lama
- **Masalah:** Heading halaman sering kali berukuran terlalu besar (`text-3xl font-extrabold`) dengan subjudul deskriptif panjang yang memakan ruang vertikal (*vertical real estate*).
- **Font yang Digunakan:** `Inter` (bagus dan solid), namun hierarki berat font terlalu acak (campuran font-light, medium, bold, black).

### 4.2 Standardisasi Productive Type Scale

| Tingkat Hirarki | Font Family | Size / Line Height | Weight | Kegunaan dalam MOVA |
|:---|:---|:---|:---:|:---|
| **Page Title** | Plus Jakarta Sans / Inter | `20px / 28px` (`text-xl`) | `600` (SemiBold) | Judul halaman operasional |
| **Section Heading**| Plus Jakarta Sans / Inter | `16px / 24px` (`text-base`)| `600` (SemiBold) | Header tabel, judul panel filter |
| **Body Text** | Plus Jakarta Sans / Inter | `14px / 20px` (`text-sm`) | `400` (Regular) | Teks utama, deskripsi status |
| **Table / Data Cell**| Plus Jakarta Sans / Inter | `13px / 18px` (`text-xs`) | `400` (Regular) | Data baris tabel, log operasional |
| **Metric Value** | JetBrains Mono / Inter | `24px / 32px` (`text-2xl`)| `700` (Bold) | Angka KPI utama (Revenue, Active Riders) |
| **Label / Caption**| Plus Jakarta Sans / Inter | `11px / 16px` (`text-[11px]`)| `500` (Medium) | Label kolom, timestamp, badge |

---

## 5. STEP 07 — Spacing & 8px/4px Grid Audit

### 5.1 Audit Spacing Lama
- Ditemukan penggunaan padding/margin acak seperti `p-[13px]`, `gap-[18px]`, `m-[22px]`.

### 5.2 Standar 8px/4px Spatial System
Seluruh jarak antarelemen diwajibkan menggunakan kelipatan 4px dan 8px:

```text
Spacing-01:  4px  (--mova-space-01) -> Micro gap (icon ke teks, badge padding)
Spacing-02:  8px  (--mova-space-02) -> Tight element spacing (form field gap)
Spacing-03: 12px  (--mova-space-03) -> Compact padding
Spacing-04: 16px  (--mova-space-04) -> Standard panel / table cell padding
Spacing-05: 24px  (--mova-space-05) -> Section container gap
Spacing-06: 32px  (--mova-space-06) -> Major layout partition
Spacing-07: 48px  (--mova-space-07) -> Page outer gutters
```

---

## 6. STEP 08 — Iconography Audit

### 6.1 Audit Penggunaan Ikon Lama
- **Masalah:** Ditemukan kecenderungan menempelkan ikon di setiap teks label (misal: `🛵 Riders`, `📍 Zones`, `☁️ Weather`, `✨ DSS`), yang menyebabkan antarmuka terasa seperti dashboard mainan/demo AI.

### 6.2 Aturan Ikonografi Baru (*Restrained & Purposeful*)
1. **Ukuran Baku:** 16px (micro/inline), 20px (standard action/nav), 24px (major modal header).
2. **Warna Monokrom:** Ikon mengikuti warna teks (`currentColor`), bukan multi-warna dekoratif.
3. **No Decorative Icons:** Ikon dihilangkan dari header card atau teks statis yang maknanya sudah jelas.
4. **Text First:** Tombol aksi wajib memiliki label teks yang jelas; tombol icon-only hanya diizinkan untuk kontrol peta dengan `tooltip` eksplisit.

---

## 7. STEP 09 — Component Compatibility Matrix (A → E)

| Component | Status | Compatibility Classification | Tindakan Migrasi |
|:---|:---:|:---|:---|
| `Button` | **B** | *Needs styling* | Sesuaikan ke flat border, solid/ghost/danger states, tanpa glow. |
| `Input` / `Select` | **B** | *Needs styling* | Sesuaikan tinggi ke 32px/40px, border 1px neutral, label tajam. |
| `Table` | **B** | *Needs styling* | Desain ulang header & cell density ala Carbon Data Table. |
| `Card` | **C** | *Needs structural refactor* | Hilangkan floating cards; ubah menjadi surface/layer containers. |
| `StatCard` / `MetricCard` | **C** | *Needs structural refactor* | Sederhanakan menjadi baris metrik tenang (*Quiet KPI bar*). |
| `Modal` / `Drawer` | **B** | *Needs styling* | Standarisasi header, body, footer, dan backdrop neutral. |
| `Badge` / `StatusBadge` | **A** | *Already compatible* | Hubungkan langsung ke warna status fungsional. |
| `Leaflet Map Canvas` | **E** | *MOVA-specific* | Pertahankan logika GIS; bungkus dalam frame control room yang tenang. |
| `DSS Matrix Table` | **E** | *MOVA-specific* | Tampilkan dekomposisi C1-C6 dan BWM weights dalam tabel berdensitas tinggi. |
| `Rider POS Terminal` | **E** | *MOVA-specific* | Optimasi alur entri cepat kasir lapangan dengan kontras tinggi. |

---

## 8. STEP 10 — AI Aesthetic Tax & Anti-AI Severity Audit

Pemeriksaan khusus terhadap artefak visual bergaya "AI Generator":

| Artefak Visual | Lokasi Temuan di Kode Lama | Tingkat Keparahan | Tindakan Korektif |
|:---|:---|:---:|:---|
| **Sparkles & AI Emojis (`✨`, `🧠`)** | Header DSS & Dashboard | **P0 (Severe)** | **Hapus Total.** Gunakan terminologi profesional (*"Zone Recommendation Engine"*). |
| **Decorative Hero Visual (`DssMapVisual.jsx`)** | Header Dashboard | **P0 (Severe)** | **Hapus Total.** Ganti dengan ringkasan status operasional langsung. |
| **Glow & Radiant Shadows** | Stat Cards & Buttons | **P1 (High)** | **Hapus.** Ganti dengan border 1px neutral yang rapi. |
| **Heavy Glassmorphism (`backdrop-blur-md`)** | Floating Map Panels | **P1 (High)** | **Ganti.** Gunakan solid surface layer (`--mova-layer-01/02`). |
| **Pill / Excessive Rounded Corners (16–24px)** | Cards & Inputs | **P2 (Moderate)** | **Standardisasi.** Batasi radius sudut ke `4px` (input/button) dan `8px` (panel). |
| **Lucide Icon di Setiap Baris Navigasi** | Sidebar Navigation | **P3 (Minor)** | **Sederhanakan.** Jadikan teks sebagai identitas utama, ikon sebagai penunjuk visual sekunder. |

---

## 9. Kesimpulan & Rekomendasi Langkah Selanjutnya

Hasil audit forensik menunjukkan bahwa **fondasi logika, data lineage, dan arsitektur integrasi MOVA sudah sangat matang**. Masalah utama yang membuat stakeholder kurang menyukai desain sebelumnya adalah **penumpukan elemen dekoratif AI (*AI Aesthetic Tax*)** yang mengaburkan fungsi utama sebagai software operasional.

Dengan mengunci prinsip **Calm · Precise · Operational** dan mengadopsi struktur token **IBM Carbon Productive DNA**, kita siap melangkah ke tahap pembuatan token layer (`mova-tokens.css`) dan migrasi komponen secara terukur.
