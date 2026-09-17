Urutan auditnya harus dari **foundation → dependency → primitives → components → page composition → visual QA**.

Dan satu prinsip penting:

> **Jangan mulai dengan mengubah halaman. Audit dulu “bahasa visual” yang sekarang tersebar di frontend.**

## Roadmap besar

```text
CURRENT FRONTEND
       │
       ▼
01. Inventory Audit
       │
       ▼
02. Architecture Audit
       │
       ▼
03. Styling / Token Audit
       │
       ▼
04. Typography Audit
       │
       ▼
05. Color & Surface Audit
       │
       ▼
06. Spacing / Grid Audit
       │
       ▼
07. Iconography Audit
       │
       ▼
08. Component Audit
       │
       ▼
09. Interaction Audit
       │
       ▼
10. Page Composition Audit
       │
       ▼
11. Carbon Mapping
       │
       ▼
12. MOVA Design Token Layer
       │
       ▼
13. Component Migration
       │
       ▼
14. Page Migration
       │
       ▼
15. Visual Regression / QA
```

Saya akan menjadikan **Step 01–10 sebagai audit**, bukan coding.

---

# STEP 01 — Frontend Inventory Audit

Pertama, kita harus tahu **apa yang sebenarnya ada**.

Jangan percaya dokumentasi lama.

Audit folder:

```text
frontend/
├── src/
├── components/
├── pages/
├── routes/
├── layouts/
├── styles/
├── lib/
├── hooks/
├── assets/
└── ...
```

Cari seluruh:

* pages
* layouts
* components
* reusable components
* UI primitives
* CSS
* Tailwind config
* global styles
* icon imports
* fonts
* animations
* theme/dark mode
* third-party UI libraries

### Output

Buat:

```text
FRONTEND_INVENTORY.md
```

dengan tabel:

| Area   | File        | Responsibility | Reusable? | Visual dependency |
| ------ | ----------- | -------------- | --------- | ----------------- |
| Layout | Sidebar     | Navigation     | Yes       | Tailwind          |
| UI     | Button      | Action         | Yes       | shadcn            |
| Page   | Map Ops     | Operations     | No        | Map               |
| UI     | StatusBadge | Status         | Yes       | Custom            |
| UI     | KPI Card    | Metrics        | Yes       | Custom            |

**Jangan mengubah kode apapun pada tahap ini.**

---

# STEP 02 — Architecture Audit

Sekarang kita cari:

> **Apakah struktur frontend memungkinkan kita memasukkan Carbon-derived design system tanpa melakukan rewrite besar?**

Karena kamu sudah mengunci shadcn + Tailwind, target arsitekturnya sebaiknya:

```text
Carbon Design Principles
          ↓
MOVA Design Tokens
          ↓
Tailwind Tokens
          ↓
shadcn / Radix primitives
          ↓
MOVA Components
          ↓
MOVA Pages
```

Bukan:

```text
Carbon
 ↓
langsung replace semua component
```

Audit:

```text
components/ui
components/shared
components/features
pages
layouts
lib
styles
```

Cari juga apakah component memiliki dependency langsung terhadap:

```text
colors
spacing
radius
shadow
font
icon
```

### Output

Buat:

```text
FRONTEND_ARCHITECTURE_AUDIT.md
```

dengan kategori:

* KEEP
* REFACTOR
* REPLACE
* REMOVE
* UNKNOWN

---

# STEP 03 — Styling Source Audit

Ini **sangat penting**.

Kita harus mengetahui:

> Dari mana sebenarnya visual MOVA saat ini berasal?

Cari semua:

```text
className=
style=
css=
@apply
theme
tailwind.config
globals.css
*.module.css
```

Kemudian cari hardcoded values:

```text
bg-[#...]
text-[#...]
border-[#...]
rounded-[...]
p-[...]
m-[...]
gap-[...]
shadow-[...]
```

Juga:

```text
rgb(...)
rgba(...)
hsl(...)
```

Tujuannya menemukan:

> **berapa banyak visual decision yang belum memiliki token.**

### Output

Misalnya:

```text
COLOR HARDCODED
147 occurrences

RADIUS HARDCODED
63 occurrences

SPACING CUSTOM
91 occurrences

SHADOW
28 occurrences
```

Ini menjadi baseline.

---

# STEP 04 — Color Audit

Sekarang baru kita bedah warna.

Jangan langsung mengganti warna.

Inventarisasi dulu:

```text
Primary
Secondary
Background
Surface
Muted
Border
Text
Success
Warning
Danger
Info
Map colors
Weather colors
DSS colors
Rider status colors
```

Kemudian buat mapping:

```text
CURRENT MOVA
      ↓
SEMANTIC ROLE
      ↓
CARBON PRINCIPLE
      ↓
MOVA TOKEN
```

Contoh:

```text
#xxx
   ↓
danger
   ↓
Carbon destructive
   ↓
--mova-danger
```

Bukan:

```text
#xxx → #carbon-red-60
```

Karena kita **tidak ingin sekadar mengganti hex**.

---

# STEP 05 — Surface & Layer Audit

Ini salah satu perubahan terbesar dari UI AI-style ke enterprise UI.

Audit semua:

* background
* cards
* panels
* modals
* dropdown
* sidebar
* map overlay
* table
* form
* popover

Kemudian kategorikan:

```text
Layer 0
Page background

Layer 1
Primary surface

Layer 2
Elevated/contextual surface

Layer 3
Overlay
```

Tanyakan:

> "Apakah elemen ini benar-benar perlu card?"

Ini penting karena kemungkinan besar MOVA sekarang **terlalu banyak card**.

Target:

```text
information
    ↓
grouping
    ↓
surface
```

bukan:

```text
everything
    ↓
card
```

---

# STEP 06 — Typography Audit

Audit seluruh frontend:

* font family
* font weight
* font size
* line height
* letter spacing
* heading
* body
* label
* caption
* table
* metric

Buat hierarchy:

```text
Display
Heading
Title
Body
Label
Caption
Data
```

Kemudian mapping ke **productive typography** Carbon.

Untuk MOVA saya akan sangat berhati-hati terhadap:

```text
font-size terlalu kecil
font-weight terlalu banyak
heading terlalu besar
uppercase berlebihan
```

Targetnya:

> **dense tetapi readable.**

---

# STEP 07 — Spacing & Grid Audit

Sekarang audit semua:

```text
padding
margin
gap
width
height
layout spacing
section spacing
component spacing
```

Cari angka liar:

```text
13px
18px
22px
27px
31px
37px
```

Kemudian identifikasi apakah bisa masuk ke sistem:

```text
4
8
12
16
24
32
48
64
```

Carbon's 2x Grid menggunakan unit 8px sebagai fondasi spacing/layout.

Tetapi jangan memaksa semua angka menjadi 8.

Misalnya:

```text
4px
```

masih sangat berguna untuk micro-spacing.

---

# STEP 08 — Iconography Audit

**Ini harus menjadi audit khusus.**

Cari:

```text
lucide-react
@radix-ui/react-icons
react-icons
heroicons
font-awesome
emoji
SVG inline
custom SVG
```

Buat inventory:

| Icon     | Library | Usage         | Size | Color  | Keep?  |
| -------- | ------- | ------------- | ---: | ------ | ------ |
| Map      | Lucide  | Navigation    |   20 | muted  | Yes    |
| Sparkles | Lucide  | AI decoration |   24 | purple | ❌      |
| Truck    | custom  | Rider         |   32 | red    | Review |
| Alert    | Lucide  | Status        |   16 | red    | Yes    |

Target:

> **Satu primary icon language.**

Kalau kita memilih Lucide sebagai implementation layer, Carbon menjadi **reference philosophy**, bukan berarti kita harus mengganti semua icon menjadi Carbon icons.

Carbon sendiri memiliki aturan icon size yang konsisten dan menempatkan icon sebagai bagian dari sistem visual, bukan dekorasi.

---

# STEP 09 — Component Audit

Ini tahap terbesar.

Enumerasikan:

```text
Button
Input
Select
Checkbox
Radio
Switch
Dialog
Dropdown
Popover
Tooltip
Tabs
Table
Card
Badge
Alert
Toast
Pagination
Breadcrumb
Navigation
Sidebar
Modal
Sheet
...
```

Kemudian setiap component diberikan status:

```text
A — Already compatible
B — Needs styling
C — Needs structural refactor
D — Replace
E — MOVA-specific
```

Contoh:

```text
Button
→ A/B

Input
→ B

Card
→ C

KPI Card
→ C

Map Overlay
→ E

Rider Status
→ E

DSS Matrix
→ E
```

---

# STEP 10 — AI Aesthetic Audit

Ini audit khusus yang sebelumnya kita bahas.

Buat scanner manual/otomatis terhadap:

```text
gradient
glow
blur
glass
excessive radius
emoji
sparkles
decorative icons
floating cards
excessive shadow
animated numbers
excessive animation
AI labels
```

Kemudian beri severity:

```text
P0 = strongly AI-looking
P1 = questionable
P2 = acceptable
P3 = intentional
```

Contoh:

```text
✨ AI Recommendation
P0

Gradient KPI
P1

Rounded card 12px
P2

Lucide icon in action button
P3
```

Ini akan sangat berguna nanti untuk Agent.

---

# STEP 11 — Interaction Audit

Jangan hanya audit visual.

Carbon sangat memperhatikan predictable interaction.

Audit:

* hover
* focus
* active
* disabled
* loading
* error
* success
* keyboard navigation
* tooltip
* modal
* confirmation
* toast
* destructive action

Contoh:

```text
Button

default
hover
focus
active
disabled
loading
```

Harus konsisten di seluruh MOVA.

---

# STEP 12 — Page Composition Audit

Baru sekarang kita masuk halaman.

Urutkan:

### Tier 1 — Core operations

```text
Map Ops
Operational Riders
Distribution
Zones
```

### Tier 2 — Decision

```text
DSS
```

### Tier 3 — Management

```text
Reports
Dashboard
```

### Tier 4 — Administration

```text
Users
Settings
```

Untuk setiap page tanyakan:

```text
What is the user's goal?

What is primary information?

What is secondary?

What requires action?

What is decoration?

What can be removed?
```

---

# STEP 13 — Carbon Mapping Matrix

Setelah audit selesai, baru kita buat:

```text
MOVA CURRENT
      ↓
CARBON EQUIVALENT
      ↓
MOVA IMPLEMENTATION
```

Contoh:

| MOVA       | Carbon concept        | Implementation |
| ---------- | --------------------- | -------------- |
| Button     | Button                | shadcn         |
| Input      | Text input            | shadcn         |
| Modal      | Modal                 | shadcn         |
| Data table | Data table principles | custom         |
| Status     | Status indicator      | custom         |
| Sidebar    | Side navigation       | custom         |
| Map panel  | —                     | MOVA custom    |
| DSS matrix | —                     | MOVA custom    |
| Rider card | —                     | MOVA custom    |

Ini penting:

> **Tidak semua kebutuhan MOVA punya Carbon component.**

Dan itu normal.

---

# STEP 14 — Buat MOVA Token Layer

Setelah Carbon dipahami, kita buat:

```text
mova-tokens.css
```

Misalnya secara konseptual:

```text
--mova-color-background
--mova-color-surface
--mova-color-surface-hover
--mova-color-border
--mova-color-text
--mova-color-text-muted

--mova-color-primary
--mova-color-success
--mova-color-warning
--mova-color-danger

--mova-spacing-01
--mova-spacing-02
--mova-spacing-03
...

--mova-radius-sm
--mova-radius-md

--mova-shadow-sm
...
```

Kemudian Tailwind membaca token tersebut.

Jadi Agent tidak lagi boleh melakukan:

```text
bg-[#123456]
```

sembarangan.

---

# STEP 15 — Component Migration

Baru kita mulai coding.

Urutan:

```text
Tokens
 ↓
Typography
 ↓
Button
 ↓
Input
 ↓
Select
 ↓
Badge
 ↓
Alert
 ↓
Dialog
 ↓
Table
 ↓
Navigation
 ↓
Specialized MOVA components
```

Kenapa?

Karena page bergantung pada component.

---

# STEP 16 — Page Migration

Setelah component stabil:

```text
Map Ops
 ↓
Riders
 ↓
Distribution
 ↓
Zones
 ↓
DSS
 ↓
Reports
 ↓
Admin
```

**Jangan mengerjakan 8 halaman sekaligus.**

Ambil satu halaman sebagai:

> **Reference Implementation**

Saya sangat menyarankan:

# Map Ops

Karena Map Ops menguji hampir semua kebutuhan MOVA:

* layout
* navigation
* map
* overlay
* status
* rider
* zone
* weather
* alert
* filtering
* density
* responsive
* dark mode

Kalau Map Ops berhasil, kita punya blueprint untuk halaman lain.

---

# STEP 17 — Visual Regression

Setelah migration:

```text
CURRENT
   ↓
SCREENSHOT

NEW
   ↓
SCREENSHOT

COMPARE
```

Audit:

* alignment
* density
* hierarchy
* contrast
* spacing
* typography
* interaction
* responsive
* dark mode

Jangan hanya:

> "Kelihatannya bagus."

Gunakan checklist.

---

# STEP 18 — Agent Guardrails

Ini bagian yang **sangat penting mengingat frontend MOVA dibangun bersama AI Agent**.

Setelah design system selesai, kita harus membuat:

```text
MOVA_DESIGN_SYSTEM.md
MOVA_UI_RULES.md
MOVA_COMPONENT_RULES.md
MOVA_AGENT_DESIGN_GUARDRAILS.md
```

Agent harus mengikuti:

```text
DO NOT invent colors
DO NOT invent spacing
DO NOT invent radius
DO NOT introduce another icon library
DO NOT use emoji
DO NOT add gradients without explicit requirement
DO NOT create decorative cards
DO NOT introduce new UI library
DO NOT create new component if existing component works
```

Dengan demikian:

```text
AI Agent
   ↓
MOVA Design System
   ↓
Implementation
```

bukan:

```text
AI Agent
   ↓
"Menurut saya desain modernnya..."
   ↓
random UI
```

---

# Prioritas auditnya

Kalau kita sederhanakan menjadi **5 fase**, saya ingin kamu mengerjakannya seperti ini:

```text
PHASE 1
UNDERSTAND
│
├── Frontend inventory
├── Architecture
└── Dependency
       ↓
PHASE 2
DECONSTRUCT
│
├── Colors
├── Typography
├── Spacing
├── Radius
├── Shadow
├── Icons
└── Motion
       ↓
PHASE 3
SYSTEMIZE
│
├── Carbon principles
├── Tokens
├── Components
└── Patterns
       ↓
PHASE 4
MIGRATE
│
├── Primitives
├── Components
├── Map Ops
└── Other pages
       ↓
PHASE 5
LOCK
│
├── Visual QA
├── Accessibility
├── Regression
└── Agent guardrails
```

## Dan urutan kerja yang paling aman untuk kondisi MOVA sekarang

Karena **logic/backend dan feature parity sudah menjadi prioritas yang relatif matang**, saya tidak akan menyentuh business logic terlebih dahulu.

Saya akan membuat pekerjaan UI menjadi:

**Day 1 — Discovery**

> Inventory + architecture + dependencies

**Day 2 — Visual forensic**

> Color + typography + spacing + radius + shadow + icons + motion

**Day 3 — Carbon study**

> Grid + color + type + iconography + layers + component philosophy

**Day 4 — System design**

> MOVA tokens + component rules + Carbon mapping

**Day 5 — Primitive migration**

> Button/Input/Select/Badge/Dialog/Table/etc.

**Day 6 — Map Ops**

> jadikan sebagai reference implementation

**Day 7+ — Page migration**

> Riders → Distribution → Zones → DSS → Reports → Admin

Dan **baru setelah itu** kita melakukan polish.

Dengan pendekatan ini kita tidak sedang “mempercantik MOVA”. Kita sedang melakukan:

> **Visual Architecture Migration: AI-generated visual language → Carbon-derived, MOVA-native operational design system.**

Itu jauh lebih aman dan hasilnya kemungkinan besar akan terasa **enterprise, tenang, konsisten, dan manusiawi**, tanpa kehilangan karakter MOVA.
