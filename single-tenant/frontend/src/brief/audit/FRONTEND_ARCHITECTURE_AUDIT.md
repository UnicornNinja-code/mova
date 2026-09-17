# MOVA Frontend Architecture Audit (Step 02)

> **Document Type:** Step 02 Architecture & Component Hierarchy Audit  
> **Source Baseline:** `src/design_old/` (Archived Component Architecture)  
> **Target Standard:** Token-Driven Enterprise Architecture (Carbon Principles $\rightarrow$ MOVA Design Tokens $\rightarrow$ Tailwind $\rightarrow$ Primitives $\rightarrow$ Pages)  
> **Status:** AUDIT COMPLETED

---

## 1. Architectural Readiness Evaluation

Audit ini mengevaluasi apakah struktur komponen lama dapat bermigrasi ke paradigma desain baru berbasis **IBM Carbon Productive DNA** tanpa merusak *integration layer* atau memerlukan perombakan arsitektur backend/services.

```text
[ TARGET ENTERPRISE ARCHITECTURE ]
┌────────────────────────────────────────────────────────┐
│  Carbon Productive Principles (Quiet, Dense, Meaning)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  MOVA Semantic Design Tokens (mova-tokens.css)         │
│  (Neutral Grays, Functional Status, 8px/4px Grid)      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tailwind CSS Token Mapping                            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  MOVA UI Primitives (Button, Input, Table, Modal, etc.)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Specialized Domain Components (GIS, DSS, Rider HUD)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  MOVA Productive Pages (MapOps, DSS, Reports, etc.)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Component Categorization Matrix

Setiap artefak arsitektur diklasifikasikan ke dalam 5 kategori:
- **`KEEP`**: Struktur logika dan fungsionalitas sudah tepat, hanya membutuhkan pengkabelan token visual baru.
- **`REFACTOR`**: Komponen memiliki terlalu banyak dekorasi visual/card wrapping berlebihan yang harus disederhanakan (*flattening*).
- **`REPLACE`**: Komponen primitif lama yang dibuat ad-hoc dan perlu diganti dengan implementasi primitif standar.
- **`REMOVE`**: Komponen murni dekoratif (AI-generated visual embellishment) yang tidak memiliki nilai fungsional operasional.
- **`UNKNOWN`**: Memerlukan evaluasi khusus.

---

### 2.1 UI Primitives

| Component | Current File | Category | Architectural Finding & Action Plan |
|:---|:---|:---:|:---|
| `Button` | `ui/Button.jsx` | **REFACTOR** | Logika varian dan loading state solid. Perlu dihilangkan efek *glow/shadow* berlebihan; sesuaikan dengan Carbon button sizes (32px, 40px, 48px), flat borders, dan fokus ring kontras tinggi. |
| `Input` | `ui/Input.jsx` | **REFACTOR** | Hapus radius 12px besar menjadi radius terukur (4px/8px), standarisasi tinggi input (32px/40px) dan label helper. |
| `Select` | `ui/Select.jsx` | **REFACTOR** | Ganti select native bergaya pill dengan enterprise dropdown yang konsisten. |
| `Table` | `ui/Table.jsx` | **KEEP / REFACTOR** | Struktur table primitives sudah benar. Perlu disesuaikan menjadi *Carbon Data Table* (baris padat 32px/40px, header kontras neutral, border 1px neutral, zebra striping opsional). |
| `Card` | `ui/Card.jsx` | **REFACTOR** | Hapus *backdrop-blur*, glow borders, dan floating card assumptions. Ubah menjadi `Surface/Layer` container dengan border datar 1px neutral. |
| `Modal` | `ui/Modal.jsx` | **REFACTOR** | Hapus glassmorphism backdrop berlebihan. Terapkan Carbon modal layout (Header, Content, Footer dengan primary/secondary button split). |
| `Drawer` | `ui/Drawer.jsx` | **KEEP** | Sangat penting untuk inspeksi Zone dan POI Moderation. Hubungkan ke token layer surface baru. |
| `Badge` | `ui/Badge.jsx` | **REFACTOR** | Hapus animasi ping berlebihan pada status normal. Pertahankan pulsing dot hanya untuk status kritis/alert live. |
| `StatusBadge` | `ui/StatusBadge.jsx` | **KEEP** | Pemetaan domain status (`ACTIVE`, `HOLD`, `IN_USE`, `MAINTENANCE`) sudah tepat. Sesuaikan warna ke *functional status palette*. |
| `MetricCard` / `StatCard` | `ui/MetricCard.jsx`, `ui/StatCard.jsx` | **REPLACE / MERGE** | Terdapat duplikasi antara `MetricCard` dan `StatCard`. Gabungkan menjadi satu `StatWidget` / `MetricDisplay` yang tenang tanpa background icon mencolok. |
| `DonutChartWidget` | `ui/DonutChartWidget.jsx` | **REFACTOR** | Sederhanakan ketebalan stroke SVG dan legend label agar selaras dengan grafik operasional. |
| `CriteriaProgressBar` | `ui/CriteriaProgressBar.jsx` | **KEEP** | Penting untuk visualisasi BWM weights. Sesuaikan dengan neutral gray track dan single-accent progress fill. |
| `LoadingSkeleton` | `ui/LoadingSkeleton.jsx` | **KEEP** | Pertahankan shimmer lembut untuk indikator async query loading. |
| `EmptyState` | `ui/EmptyState.jsx` | **REFACTOR** | Hilangkan ilustrasi generik AI; ganti dengan pesan terstruktur yang tenang (Judul masalah, deskripsi singkat, tombol tindakan langsung). |

---

### 2.2 Layout & Navigation

| Component | Current File | Category | Architectural Finding & Action Plan |
|:---|:---|:---:|:---|
| `AppLayout` | `layout/AppLayout.jsx` | **KEEP** | Struktur pembagian sidebar + header + main content area sudah sangat baik. |
| `Sidebar` | `layout/Sidebar.jsx` | **REFACTOR** | Terapkan prinsip *Text First, Icon Second*. Hilangkan background pill ungu/biru mencolok; gunakan *Carbon SideNav* style (subtle 1px active indicator, font medium neutral). |
| `Header` | `layout/Header.jsx` | **REFACTOR** | Bersihkan ikon dekoratif. Pertahankan jam operasional live, status koneksi socket, dan dropdown profile. |
| `DssMapVisual` | `layout/hero-visuals/DssMapVisual.jsx` | **REMOVE** | Dihapus total (*AI Aesthetic Tax*). Software operasional tidak membutuhkan ilustrasi futuristik dekoratif di header halaman. |

---

### 2.3 GIS & Domain Components

| Component | Current File | Category | Architectural Finding & Action Plan |
|:---|:---|:---:|:---|
| `MapView` & `MOVAInteractiveMap` | `components/map/` | **KEEP** | Inti GIS Leaflet bekerja dengan sangat baik. Integrasi PostGIS GeoJSON, cluster POI, dan live GPS marker dipertahankan 100%. |
| `MapLayerControlBox` | `components/map/MapLayerControlBox.jsx` | **REFACTOR** | Ubah dari floating pill widget menjadi *docked/structured map tool panel* dengan kontras tinggi. |
| `ZoneDetailDrawer` | `components/map/ZoneDetailDrawer.jsx` | **KEEP** | Sangat berguna untuk detail operasional zona tanpa meninggalkan peta. |

---

## 3. Kesimpulan Arsitektur

Struktur frontend MOVA **sangat memungkinkan** untuk mengadopsi sistem desain baru turunan Carbon tanpa perlu menulis ulang (*rewrite*) logika integrasi backend:
1. **Zero Logic Leak:** Logika server state (`services/`), WebSocket events (`sockets/`), dan helper PostGIS (`utils/geoJsonAdapter.js`) terisolasi sempurna dari UI.
2. **Action Item Utama:** Menyederhanakan hierarki container visual (mengurangi tumpukan card berlebih), menggabungkan komponen duplikat (`StatCard` + `MetricCard`), dan menghapus artefak visual dekoratif yang tidak fungsional.
