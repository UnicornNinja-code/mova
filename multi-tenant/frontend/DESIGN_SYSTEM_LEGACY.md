# LEGACY DESIGN SYSTEM & UI TOKEN ARCHIVE (MOVA)

Dokumen ini merupakan arsip komprehensif token desain, palet warna, tipografi, dan pola komponen antarmuka MOVA sebelum migrasi ke sistem terstandarisasi **shadcn-svelte (bits-ui & Tailwind CSS)**.

---

## 1. Color Palette Tokens

### Brand & Primary Accent
- **Primary Brand (Vibrant Orange):** `#FF634A`
- **Primary Dark:** `#D9442C`
- **Primary Hover:** `#FF755E`
- **Primary Soft Background:** `rgba(255, 99, 74, 0.12)`
- **Primary Gradient:** `linear-gradient(135deg, #FF634A 0%, #FF8573 100%)`

### Dark Aesthetic Surface Palette
- **App Background:** `#09090B` (Deep Dark Zinc)
- **Card Surface:** `#131316`
- **Elevated Surface (Modals/Popovers):** `#1A1A1F`
- **Surface Hover:** `#222228`
- **Border Default:** `#24242A`
- **Border Subtle:** `#1C1C22`

### Text & Content Hierarchy
- **Foreground (Primary Text):** `#FFFFFF`
- **Muted Foreground (Subtitles/Secondary):** `#A1A1AA`
- **Subtle (Disabled/Placeholders):** `#71717A`

### Semantic Status Colors
- **Success (Green):**
  - Text/Icon: `#10B981`
  - Background: `rgba(16, 185, 129, 0.12)`
  - Border: `rgba(16, 185, 129, 0.25)`
- **Warning (Amber):**
  - Text/Icon: `#F59E0B`
  - Background: `rgba(245, 158, 11, 0.12)`
  - Border: `rgba(245, 158, 11, 0.25)`
- **Danger / Destructive (Red):**
  - Text/Icon: `#EF4444`
  - Background: `rgba(239, 68, 68, 0.12)`
  - Border: `rgba(239, 68, 68, 0.25)`
- **Info (Blue):**
  - Text/Icon: `#3B82F6`
  - Background: `rgba(59, 130, 246, 0.12)`
  - Border: `rgba(59, 130, 246, 0.25)`

---

## 2. Typography Conventions

- **Font Family:** `'Outfit', system-ui, -apple-system, sans-serif`
- **Monospace Font (Code/UUID):** `'JetBrains Mono', monospace`
- **Type Scales:**
  - **Display 48:** 48px / 60px line-height, font-weight 600, letter-spacing -0.03em
  - **Title 18:** 18px / 28px line-height, font-weight 600, letter-spacing -0.01em
  - **Body 14:** 14px / 20px line-height, font-weight 400, color `#A1A1AA`
  - **Caption 12:** 12px / 16px line-height, font-weight 500

---

## 3. UI Component Attributes & Shapes

- **Card Container:**
  - Background: `#131316`
  - Border: `1px solid #24242A`
  - Border Radius: `24px` (Large rounded)
  - Hover Transition: `border-color 0.2s ease`
- **Split-Pill Button:**
  - Background: `#FFFFFF`
  - Text Color: `#0A0A0C`
  - Border Radius: `9999px` (Full Pill)
  - Box Shadow: `0 4px 14px rgba(0, 0, 0, 0.2)`
- **Pattern Dots Overlay:**
  - Radial gradient dots (1.2px, 16px spacing) on dark background `#121215`

---

## 4. Layout Architecture Patterns

1. **Desktop / SuperAdmin & Management Layout:**
   - Left fixed collapsible sidebar (`w-64`).
   - Top Header bar with live Notification Dropdown, Breadcrumb, and User Profile.
   - Main content viewport with `p-6` padding and scrollable data tables.
2. **Supervisor Field Command Layout:**
   - Map-centric split layout with floating operational control drawer.
3. **Rider Mobile-First Layout:**
   - Full-width mobile view with safe-area inset protection (`env(safe-area-inset-bottom)`).
   - Bottom floating navigation bar (`h-16`).
   - High-contrast tactile action buttons (POS quick-cash presets, attendance swipe/click).
