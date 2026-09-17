
Saya telah membedah, mengapa IBM Carbon terlihat lebih mature berdasarkan analisis saya di bawah ini : 

Aku sudah melihat prinsip resmi Carbon, dan ada satu temuan besar:

> **Carbon bukan terutama kumpulan komponen. Carbon adalah sistem untuk mengendalikan kompleksitas.**

Itu sangat relevan dengan MOVA.

---

# 1. Mulai dari First Principles: masalah apa yang sebenarnya diselesaikan Carbon?

Bayangkan kita tidak tahu apa itu Carbon.

Kita mulai dari problem paling dasar:

MOVA punya:

* banyak data
* banyak status
* banyak halaman
* banyak role
* map
* tabel
* form
* DSS
* rider
* distribution
* operational monitoring

Kalau setiap halaman dirancang secara bebas:

```text
Page A
 ├─ radius 16
 ├─ icon 20
 ├─ spacing 24
 └─ blue #...

Page B
 ├─ radius 12
 ├─ icon 18
 ├─ spacing 20
 └─ blue lain

Page C
 ├─ radius 24
 ├─ icon 24
 └─ gradient
```

maka setelah beberapa bulan:

> **MOVA kehilangan bahasa visual.**

Jadi problem fundamentalnya:

### Complexity → inconsistency → cognitive load

Carbon mencoba memutus rantai itu dengan:

```text
Design principles
       ↓
Tokens
       ↓
Components
       ↓
Patterns
       ↓
Pages
       ↓
Consistent experience
```

Carbon sendiri menjelaskan bahwa design language IBM diterjemahkan ke code melalui color tokens, type tokens, spacing tokens, dan komponen. ([Carbon Design System][1])

**Ini jauh lebih penting daripada sekadar “pakai komponen Carbon”.**

---

# 2. First Principle #1 — UI harus membantu manusia membangun mental model

Carbon secara eksplisit mengatakan bahwa layout harus dimulai dari **content dan user goals**, dan layout yang baik membantu user membangun mental model, menemukan konten yang relevan, lalu mencapai objective. ([Carbon Design System][2])

Ini sebenarnya fundamental UX:

> Manusia tidak datang untuk melihat UI.
> Manusia datang untuk memahami keadaan dan melakukan sesuatu.

Maka:

```text
User goal
   ↓
Information
   ↓
Hierarchy
   ↓
Layout
   ↓
Component
   ↓
Decoration
```

Sedangkan AI-generated UI sering melakukan kebalikannya:

```text
Component
   ↓
Decoration
   ↓
Card
   ↓
Icon
   ↓
"Informasi apa yang bisa kita taruh di sini?"
```

**Inilah salah satu alasan MOVA terasa terlalu AI.**

---

# 3. First Principle #2 — Hierarchy lebih penting daripada beauty

Carbon menyebut hierarchy sebagai alat untuk membantu user menavigasi konsep kompleks tanpa tersesat. Mereka juga menekankan size, proximity, typography, dan components sebagai pembentuk hierarchy. ([Carbon Design System][2])

Artinya:

> **UI yang bagus bukan UI yang setiap elemennya menarik.**

Justru:

> **UI yang bagus tahu mana yang harus diabaikan.**

Misalnya Map Ops.

Yang paling penting:

```text
MAP
```

Kemudian:

```text
Rider status
Zone status
Alerts
Filters
```

Kemudian:

```text
Metadata
Last update
Weather
```

Jangan semuanya diberikan bobot visual sama.

---

# 4. First Principle #3 — Space adalah informasi

Ini salah satu bagian Carbon yang menurutku **harus kita adopsi ke MOVA**.

Carbon menjelaskan bahwa spacing bukan sekadar jarak estetis. Kedekatan elemen membentuk persepsi bahwa elemen tersebut berhubungan; semakin jauh jaraknya, semakin lemah hubungan tersebut. ([Carbon Design System][3])

Jadi:

```text
A
B
```

dengan:

```text
A


B
```

bukan sekadar beda `margin`.

Maknanya berbeda.

### A dan B dekat

> “Mereka satu kelompok.”

### A dan B jauh

> “Mereka berbeda konteks.”

Ini sangat powerful untuk dashboard MOVA.

---

# 5. Carbon punya satu keputusan fundamental: 8px grid

Carbon menggunakan **2x Grid** dengan mini unit 8px sebagai fondasi geometris untuk typography, columns, boxes, icons, margin, dan padding. ([Carbon Design System][4])

Ini bukan:

> "8px karena design system suka angka 8."

Alasannya adalah:

```text
consistent unit
      ↓
predictable rhythm
      ↓
repeated relationships
      ↓
lower cognitive load
```

Untuk MOVA kita bisa mengambil prinsipnya:

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

bukan:

```text
13
17
21
27
31
37
```

di setiap komponen.

---

# 6. First Principle #4 — Jangan gunakan warna untuk dekorasi

Ini menurutku salah satu **obat paling kuat untuk UI MOVA yang terlalu AI**.

Carbon menjadikan neutral gray sebagai dominan. Warna primary digunakan untuk action, sedangkan warna tambahan digunakan secara terbatas dan purposeful. ([Carbon Design System][5])

Secara fundamental:

```text
Color ≠ decoration

Color = information
```

Misalnya MOVA:

```text
Neutral
   ↓
normal

Blue
   ↓
action / interactive

Green
   ↓
compliant / success

Amber
   ↓
attention

Red
   ↓
critical
```

Bukan:

```text
Blue card
Purple card
Green card
Orange card
Gradient card
```

hanya supaya dashboard terlihat hidup.

---

# 7. Dan ini langsung menjawab masalah icon kamu

Carbon punya aturan icon yang sangat ketat.

Icon biasanya:

* 16px
* 20px
* 24px
* 32px

dan harus konsisten dengan typography. Icon juga menggunakan **solid monochromatic color**, bukan berbagai warna dekoratif. ([Carbon Design System][6])

Perhatikan filosofinya:

> **Icon adalah bagian dari bahasa informasi, bukan dekorasi.**

Misalnya:

```text
Riders
124
```

Tidak harus:

```text
🛵 Riders
124
```

Tetapi ketika ada action:

```text
[ ↻ Refresh ]
```

icon memiliki fungsi.

Ini cocok sekali untuk MOVA.

---

# 8. Bahkan Carbon membatasi icon-only UI

Carbon mengatakan icon-only controls sebaiknya digunakan pada ruang kecil yang sudah terdefinisi, harus recognizable, dan membutuhkan tooltip untuk memberikan kejelasan saat hover/focus. ([Carbon Design System][7])

Ini berarti:

> **Icon bukan bahasa universal.**

Text masih penting.

Ini adalah anti-pattern yang sering dilakukan AI:

```text
🔍
⚙
⋮
↗
◉
◎
✦
```

lalu user harus menebak:

> "Ini tombol apa?"

Carbon berpikir:

> **Jika action penting, jangan sembunyikan maknanya hanya demi estetika.**

---

# 9. First Principle #5 — Typography adalah struktur, bukan styling

Carbon menggunakan typography untuk menciptakan hierarchy dan mengorganisasi informasi. Untuk product UI mereka bahkan memiliki **productive type set**, yang berbeda dari expressive/editorial typography. ([Carbon Design System][8])

Ini sangat relevan.

MOVA bukan website marketing.

MOVA adalah:

> **productive software.**

Jadi typography harus bertugas:

```text
Page title
     ↓
Section
     ↓
Label
     ↓
Value
     ↓
Metadata
```

Bukan:

```text
BIG BEAUTIFUL HEADING
+
subtitle
+
gradient text
```

---

# 10. Carbon punya konsep yang sangat cocok dengan MOVA: Productive vs Expressive

Ini menurutku perlu kita adopsi secara eksplisit.

Carbon membedakan:

### Expressive

Untuk:

* marketing
* editorial
* storytelling
* brand moments

### Productive

Untuk:

* cloud console
* enterprise software
* task completion
* operational work

Carbon bahkan menjelaskan bahwa Carbon awalnya berkembang sebagai design system untuk Cloud console dan productive use cases. ([Carbon Design System][8])

MOVA jelas masuk:

# **Productive UI**

Jadi jangan desain MOVA seperti:

> SaaS landing page.

Desain seperti:

> **operations console.**

---

# 11. First Principle #6 — Layer lebih penting daripada shadow

Ini bagian Carbon yang menarik.

Carbon menggunakan neutral gray layers untuk membentuk depth dan spatial association. ([Carbon Design System][9])

Jadi depth tidak harus:

```text
box-shadow:
0 20px 50px rgba(...)
```

AI sangat suka:

```text
floating card
+
huge shadow
+
blur
+
glass
```

Carbon lebih dekat ke:

```text
background
    ↓
layer
    ↓
layer-02
    ↓
border
    ↓
content
```

Artinya hierarchy dibangun melalui:

> **surface + contrast + border + spacing**

bukan efek visual.

---

# 12. First Principle #7 — Consistency bukan berarti semuanya sama

Ini subtle tapi penting.

Carbon mengatakan continuity antar halaman membantu mengurangi cognitive load, tetapi terlalu banyak repetition tanpa whitespace juga bisa menyebabkan monotony. ([Carbon Design System][2])

Jadi:

**Consistency ≠ uniformity.**

Contoh buruk:

```text
semua page
┌──────────┐
│   CARD   │
└──────────┘

┌──────────┐
│   CARD   │
└──────────┘
```

Carbon-style:

```text
same tokens
same spacing
same typography
same interaction

BUT

different composition
depending on user goal
```

Ini penting untuk MOVA.

Map Ops tidak boleh dipaksa memiliki layout yang sama dengan DSS.

---

# 13. Jadi apa sebenarnya "Carbon DNA"?

Kalau kita buang semua branding IBM, Plex, blue IBM, dan component names:

```text
                  CARBON DNA

                     │
             ┌───────┴───────┐
             │               │
        Human task       Complexity
             │               │
             └───────┬───────┘
                     ↓
               Clear hierarchy
                     ↓
              Consistent system
                     ↓
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
    Typography     Space         Color
       ↓             ↓             ↓
    Components     Grid          Layers
       └─────────────┼─────────────┘
                     ↓
             Predictable UI
                     ↓
             Lower cognitive load
```

**Itulah yang menurutku perlu kita ambil dari Carbon.**

Bukan sekadar:

> "MOVA sekarang pakai IBM Carbon."

---

# 14. Lalu apa yang JANGAN kita ambil dari Carbon?

Ini sama pentingnya.

Aku **tidak menyarankan cloning Carbon 1:1**.

Karena MOVA bukan IBM Cloud.

Kita tidak perlu membawa:

* seluruh component vocabulary Carbon
* seluruh IBM color palette
* IBM Plex sebagai kewajiban
* seluruh layout pattern IBM
* seluruh visual identity IBM
* setiap Carbon component
* setiap Carbon spacing token tanpa evaluasi

Kita mengambil:

### **Principles**

bukan:

### **Brand identity.**

---

# 15. Kita bisa membuat "Carbon-derived, MOVA-native"

Menurutku ini jauh lebih kuat.

```text
IBM Carbon
     │
     │ principles
     ↓
MOVA Design Language
     │
     ├── Operational
     ├── Geographic
     ├── Indonesian context
     ├── Rider-centric
     ├── DSS-centric
     └── Map-centric
```

Sehingga:

> **Carbon menjadi DNA.**

Tetapi:

> **MOVA tetap menjadi individu.**

---

# 16. Kalau kita terapkan ke MOVA, hasil visualnya kira-kira berubah seperti ini

### Sebelum

```text
✨ Operational Intelligence

┌────────────┐ ┌────────────┐ ┌────────────┐
│ 🛵         │ │ 📍         │ │ ☁️         │
│ 124        │ │ 18         │ │ 40%        │
│ Riders     │ │ Zones      │ │ Rain       │
└────────────┘ └────────────┘ └────────────┘

╭─────────────────────────────────────────╮
│                                         │
│        futuristic map                  │
│                                         │
╰─────────────────────────────────────────╯
```

### Setelah mengambil Carbon DNA

```text
Map Ops

124 active riders     18 operational zones     3 alerts

────────────────────────────────────────────────────

                    MAP

       ┌───────────────────────────────┐
       │                               │
       │                               │
       │        operational map        │
       │                               │
       │                               │
       └───────────────────────────────┘

────────────────────────────────────────────────────

Operational alerts

08:42    Rider #021    Deviated from zone
08:37    Zone Sidoarjo North    High rain probability
08:31    Rider #104    Outside operational radius
```

Lebih tenang.

Lebih padat.

Lebih serius.

Dan yang paling penting:

> **Tidak perlu mengatakan kepada user bahwa MOVA adalah sistem pintar.**

User bisa merasakannya dari kualitas informasinya.

---

# 17. Jadi hasil First Principles kita

Aku akan merumuskan **7 hukum dasar MOVA** dari Carbon:

### Hukum 1 — Purpose before component

**Mulai dari pekerjaan user, bukan komponen UI.**

### Hukum 2 — Hierarchy before decoration

**Yang penting harus terlihat penting tanpa bantuan dekorasi.**

### Hukum 3 — Space creates meaning

**Spacing digunakan untuk menunjukkan hubungan informasi.**

### Hukum 4 — Color carries meaning

**Warna menunjukkan status/action, bukan mempercantik dashboard.**

### Hukum 5 — Icons communicate, not decorate

**Icon harus membantu recognition atau action.**

### Hukum 6 — Productive over expressive

**MOVA adalah software untuk bekerja, bukan marketing experience.**

### Hukum 7 — Consistency reduces cognitive load

**User harus merasa berada dalam sistem yang sama ketika berpindah halaman.**

Dan Carbon sendiri merangkum fondasi visualnya melalui **grid, typography, color, spacing, tokens, dan reusable components**. ([Carbon Design System][4])

---

## Yang paling menarik untuk MOVA

Menurutku setelah bedah ini, kita **belum seharusnya membuat `MOVA_DESIGN_SYSTEM_v4.md` dulu**.

Tahap berikutnya justru lebih fundamental:

> **Kita bedah Carbon satu per satu dari bawah ke atas.**

Urutannya:

```text
LEVEL 0
Design philosophy
        ↓
LEVEL 1
Grid & spacing
        ↓
LEVEL 2
Color & layers
        ↓
LEVEL 3
Typography
        ↓
LEVEL 4
Iconography
        ↓
LEVEL 5
Borders / radius / elevation
        ↓
LEVEL 6
Components
        ↓
LEVEL 7
Patterns
        ↓
LEVEL 8
Page composition
        ↓
LEVEL 9
MOVA-specific adaptation
```

Dengan cara itu kita bisa menemukan **mana yang benar-benar merupakan prinsip universal desain enterprise dan mana yang cuma “gaya IBM”**. Setelah itu baru kita putuskan: **apa yang diadopsi 100%, apa yang dimodifikasi, dan apa yang sengaja ditolak untuk MOVA.**

Lanjutkan bedah Carbon untuk MOVA

* Bedah grid dan spacing Carbon
* Bandingkan Carbon dengan MOVA

[1]: https://carbondesignsystem.com/designing/get-started/?utm_source=chatgpt.com "Carbon Design System"
[2]: https://carbondesignsystem.com/elements/2x-grid/usage/?utm_source=chatgpt.com "Carbon Design System"
[3]: https://carbondesignsystem.com/elements/spacing/overview/?utm_source=chatgpt.com "Carbon Design System"
[4]: https://carbondesignsystem.com/elements/2x-grid/overview/?utm_source=chatgpt.com "Carbon Design System"
[5]: https://carbondesignsystem.com/elements/color/overview/?utm_source=chatgpt.com "Carbon Design System"
[6]: https://carbondesignsystem.com/elements/icons/usage/?utm_source=chatgpt.com "Carbon Design System"
[7]: https://carbondesignsystem.com/components/tabs/usage/?utm_source=chatgpt.com "Carbon Design System"
[8]: https://preview.carbondesignsystem.com/building-blocks/foundations/typography/style-strategies?utm_source=chatgpt.com "Typography | Carbon Design System"
[9]: https://preview.carbondesignsystem.com/building-blocks/foundations/color/overview?utm_source=chatgpt.com "Color | Carbon Design System"
