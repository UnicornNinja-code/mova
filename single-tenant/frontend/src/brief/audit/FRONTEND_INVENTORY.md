# MOVA Frontend Inventory Audit (Step 01)

> **Document Type:** Step 01 Frontend Forensic Inventory  
> **Source Baseline:** `src/design_old/` (Archived MOVA Single-Tenant UI)  
> **Target Standard:** IBM Carbon Productive DNA & Calm·Precise·Operational Paradigm  
> **Status:** AUDIT COMPLETED (Pure Audit — Zero Code Modification)

---

## 1. Executive Summary

Audit inventarisasi menyeluruh dilakukan terhadap seluruh aset visual, rute halaman, layout shell, widget domain, primitif UI, hooks, dan dependensi visual frontend MOVA. Seluruh artefak telah diklasifikasikan berdasarkan tanggung jawab (*responsibility*), penggunaan ulang (*reusability*), dan ketergantungan visual (*visual dependencies*).

---

## 2. Master Inventory Table

### 2.1 Container Pages (`src/design_old/pages/`)

| No | Area / Module | File Path | Route | Responsibility | Reusable? | Visual / Library Dependency |
|:---|:---|:---|:---|:---|:---:|:---|
| 1 | Auth | `pages/auth/LoginPage.jsx` | `/login` | Credential auth, CAPTCHA, submit action | No | Tailwind, Lucide, Form hook |
| 2 | Auth | `pages/auth/RegisterPage.jsx` | `/register`, `/activate` | Self-activation token & password setup | No | Tailwind, Lucide, Form hook |
| 3 | Auth | `pages/auth/ForgotPasswordPage.jsx` | `/forgot-password`, `/reset-password` | Token request & reset confirmation | No | Tailwind, Lucide, Form hook |
| 4 | Core Ops | `pages/admin/MapOpsPage.jsx` | `/map-ops` | Live GIS Control Room, rider pins, POI cluster, weather radar, operational drawer | No | Leaflet, Lucide, Tailwind arbitrary, TanStack Query |
| 5 | Core Ops | `pages/admin/OperationalRiderPage.jsx` | `/rider/zone`, `/operational-rider` | Rider Duty HUD, FIFO queue, 5m hold timer, PostGIS check-in, POS | No | Tailwind, Lucide, Timer state, POS table |
| 6 | Core Ops | `pages/admin/DistributionPage.jsx` | `/distribution` | FIFO queue dispatch, auto/manual zone assignment | No | Tailwind, Lucide, Card grid, Status badge |
| 7 | Core Ops | `pages/admin/ZoneManagementPage.jsx` | `/zones` | PostGIS Polygon Geofence CRUD, capacity, spatial table | No | Leaflet preview, Table, Modal, Drawer |
| 8 | DSS | `pages/admin/DssPage.jsx` | `/dss`, `/dss/criteria`, `/dss/bwm` | Multi-Criteria BWM weights, C1-C6 decomposition, TOPSIS leaderboard | No | Tailwind, Table, Progress bar, Tabs |
| 9 | Asset | `pages/admin/FleetManagementPage.jsx` | `/fleet`, `/armadas` | Gerobak/Motor inventory, telemetry status, release hold | No | Tailwind, Table, Status badge, Modal |
| 10 | Commercial | `pages/admin/CatalogPage.jsx` | `/catalog` | SKU pricing, HPP/Margin, availability toggle | No | Tailwind, Table, Status badge, Modal |
| 11 | Intelligence | `pages/admin/PoiModerationPage.jsx` | `/pois` | 58-category filter, pending moderation drawer, OSM sync | No | Tailwind, Drawer, Table, Tabs |
| 12 | Intelligence | `pages/admin/CompetitorPage.jsx` | `/competitors` | Field competitor surveys, weight 1-3, C6 score | No | Tailwind, Table, Modal, Leaflet pin |
| 13 | Identity | `pages/admin/UserManagementPage.jsx` | `/users` | 4-Role RBAC directory, activation switch, hierarchy guard | No | Tailwind, Table, Status badge, Modal |
| 14 | Executive | `pages/admin/DashboardPage.jsx` | `/dashboard` | Macro KPI revenue, active sessions, compliance, DSS CR | No | Tailwind, MetricCard, DonutChart, MiniChart |
| 15 | Reporting | `pages/admin/ReportsPage.jsx` | `/reports`, `/reports/*` | Operational analytics, plan vs actual DSS, CSV export | No | Tailwind, Tabs, Table, Chart widgets |
| 16 | System | `pages/admin/SettingsPage.jsx` | `/settings`, `/sync` | Hub coordinate, toll/protocol rules, cron controls, readiness scan | No | Tailwind, Leaflet pin, Switch, Tabs |
| 17 | Test / Dev | `pages/showcase/ShowcasePage.jsx` | `/showcase` | Component kitchen-sink & token showcase | No | Tailwind, All UI components |

---

### 2.2 Layout Shells & Navigation (`src/design_old/components/layout/`)

| File Path | Responsibility | Reusable? | Visual Dependency |
|:---|:---|:---:|:---|
| `components/layout/AppLayout.jsx` | Main application shell, responsive drawer wrapper | Yes | Tailwind, Sidebar, Header |
| `components/layout/Sidebar.jsx` | Collapsible sidebar, role-filtered menu items | Yes | Tailwind, Lucide, NavLink |
| `components/layout/Header.jsx` | Live operational clock, user profile menu, system status | Yes | Tailwind, Lucide, ThemeToggle |
| `components/layout/hero-visuals/DssMapVisual.jsx` | Marketing/abstract visual illustration for hero headers | No (AI Decor) | Hardcoded SVG / Gradient |

---

### 2.3 UI Primitives & Atoms (`src/design_old/components/ui/`)

| File Path | Component | Responsibility | Reusable? | Visual Dependency |
|:---|:---|:---|:---:|:---|
| `components/ui/Button.jsx` | Button | Standard button, variants, icon slots, loading state | Yes | Tailwind, clsx, Lucide |
| `components/ui/Card.jsx` | Card | Container box with header, content, footer | Yes | Tailwind, clsx |
| `components/ui/Input.jsx` | Input | Form input, prefix icon, error state | Yes | Tailwind, clsx |
| `components/ui/Select.jsx` | Select | Native select wrapper, options list | Yes | Tailwind, clsx |
| `components/ui/Checkbox.jsx` | Checkbox | Binary checkbox control | Yes | Tailwind, clsx |
| `components/ui/Switch.jsx` | Switch | Toggle switch control | Yes | Tailwind, clsx |
| `components/ui/Badge.jsx` | Badge | Status pill, color variants | Yes | Tailwind, clsx |
| `components/ui/StatusBadge.jsx` | StatusBadge | Semantic domain status (ACTIVE, HOLD, IN_USE, etc.) | Yes | Custom color map |
| `components/ui/RiderStatusBadge.jsx` | RiderStatusBadge | Dedicated rider operational state pill | Yes | Custom color map |
| `components/ui/Modal.jsx` | Modal | Centered dialog overlay with backdrop blur | Yes | Tailwind, Portal, Lucide |
| `components/ui/Drawer.jsx` | Drawer | Slide-over side panel for details/moderation | Yes | Tailwind, Lucide |
| `components/ui/Table.jsx` | Table | Table primitives (Header, Body, Row, Cell) | Yes | Tailwind, clsx |
| `components/ui/Tabs.jsx` | Tabs | Tab navigation trigger & panel | Yes | Tailwind, clsx |
| `components/ui/Toast.jsx` | Toast | Toast notification provider & item | Yes | Tailwind, Lucide |
| `components/ui/Tooltip.jsx` | Tooltip | Hover explanation popup | Yes | Tailwind, clsx |
| `components/ui/EmptyState.jsx` | EmptyState | Zero-data placeholder illustration & call to action | Yes | Tailwind, Lucide |
| `components/ui/LoadingSkeleton.jsx` | LoadingSkeleton | Shimmering placeholder box | Yes | Tailwind, Shimmer CSS |
| `components/ui/MetricCard.jsx` | MetricCard | KPI summary card with trend indicator | Yes | Tailwind, Lucide |
| `components/ui/StatCard.jsx` | StatCard | Alternative KPI card with icon container | Yes | Tailwind, Lucide |
| `components/ui/DonutChartWidget.jsx`| DonutChartWidget | SVG circular chart for compliance/utilization | Yes | SVG, Tailwind |
| `components/ui/CriteriaProgressBar.jsx`| CriteriaProgressBar | BWM weight comparison bar | Yes | Tailwind |
| `components/ui/SummaryChips.jsx` | SummaryChips | Filter badge list | Yes | Tailwind |
| `components/ui/PageHeader.jsx` | PageHeader | Standardized breadcrumb & action title | Yes | Tailwind |
| `components/ui/ThemeToggle.jsx` | ThemeToggle | Dark/Light mode switch | Yes | Lucide, ThemeContext |
| `components/ui/ArmadaIcon.jsx` | ArmadaIcon | Custom Gerobak vs Motor Listrik SVG icon | Yes | Custom SVG |
| `components/ui/WeatherIcon.jsx` | WeatherIcon | Atmospheric status weather SVG | Yes | Custom SVG |
| `components/ui/Avatar.jsx` | Avatar | User initials / image thumbnail | Yes | Tailwind |

---

### 2.4 Map & GIS Specialized Widgets (`src/design_old/components/map/`)

| File Path | Responsibility | Reusable? | Visual Dependency |
|:---|:---|:---:|:---|
| `components/map/MapView.jsx` | Core Leaflet map instance, tile layer initialization | Yes | Leaflet, Carto/OSM tiles |
| `components/map/MOVAInteractiveMap.jsx` | Master GIS canvas with zone polygons, live markers | Yes | Leaflet, PostGIS GeoJSON |
| `components/map/MapLayerControlBox.jsx` | Floating layer toggles (Zones, POIs, Competitors, Radar) | Yes | Tailwind, Lucide |
| `components/map/MapLayers.js` | GeoJSON layer styling generator & Leaflet icon factories | Yes | Leaflet `L.divIcon` |
| `components/map/ZoneDetailDrawer.jsx` | Slide-over inspector for selected zone details & metrics | Yes | Tailwind, Lucide, Drawer |

---

### 2.5 Third-Party Visual & UI Dependencies (`package.json`)

| Package Name | Version | Purpose | Audit Verdict |
|:---|:---|:---|:---|
| `tailwindcss` | `^4.3.3` | Utility-first CSS engine | **KEEP** (Foundation) |
| `@tailwindcss/vite` | `^4.3.3` | Vite compiler integration | **KEEP** |
| `lucide-react` | `^0.468.0` | Primary icon set | **KEEP** (Restrain to Carbon rules) |
| `leaflet` | `^1.9.4` | Interactive mapping engine | **KEEP** (Domain Mandatory) |
| `clsx` & `tailwind-merge` | `^2.1.1` & `^3.6.0` | Class name composition utilities | **KEEP** |
| `react-router-dom` | `^7.0.2` | Client-side routing | **KEEP** |
| `@tanstack/react-query` | `^5.62.7` | Server state & caching | **KEEP** |
| `react-hook-form` & `zod` | `^7.54.0` & `^3.24.1` | Form state & schema validation | **KEEP** |
| `socket.io-client` | `^4.8.3` | Realtime telemetry socket | **KEEP** |
