# MOVA Single-Tenant — Rencana Rekonstruksi Frontend Terpadu (Master Blueprint)

Direktori ini berisi seluruh dokumen rencana teknis rekonstruksi arsitektur antarmuka pengguna frontend **MOVA (Mobile Operations & Visibility Application)** yang dirancang selaras dengan dokumen Single Source of Truth [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md).

---

## 📑 Struktur Berkas Rencana Rekonstruksi

| Berkas Rekonstruksi | Fase & Cakupan Layar | Fokus Arsitektur & Rekayasa |
|---|---|---|
| [`PART_00_governance_radix_architecture.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_00_governance_radix_architecture.md) | **Foundations & Governance** | Radix UI Native Primitives, Token Desain Neural Command, Axios Interceptor, TanStack Query, & Standar TDD |
| [`PART_01_flow_01_global_shell_auth.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_01_flow_01_global_shell_auth.md) | **FLOW-01 (Layar A1–A4)** | Master Desktop Shell 5-Pilar, Rider PWA Shell 3-Tab, Sign-In, First-Login, Aktivasi Akun & Pemulihan Sandi |
| [`PART_02_flow_02_command_live_ops_weather_dispatch.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_02_flow_02_command_live_ops_weather_dispatch.md) | **FLOW-02 (Layar B1–B4)** | Command Center KPI, Live Ops GIS Telemetry (30s GPS streaming), Prakiraan Cuaca Operasional & FIFO Plotting Board |
| [`PART_03_flow_03_decision_support_engine.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_03_flow_03_decision_support_engine.md) | **FLOW-03 (Layar C1–C4)** | DSS Evaluation Workspace, What-If Weight Simulator, Kalibrasi BWM ($CR \le 0.10$), & Immutable Decision History |
| [`PART_04_flow_04_spatial_poi_market_intelligence.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_04_flow_04_spatial_poi_market_intelligence.md) | **FLOW-04 (Layar D1–D4)** | Zone PostGIS Polygon Editor (Dry-run validation), Spot Discovery TOPSIS, POI Moderation, C3 Matrix & Market Intelligence |
| [`PART_05_flow_05_rider_pwa_execution.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_05_flow_05_rider_pwa_execution.md) | **FLOW-05 (Layar G1–G3)** | Rider Mobile PWA: Shift Starter, 5-Minute Fleet Hold & Claim, Geofence Proximity Check-in, Spot Lock, POS & Settlement |
| [`PART_06_flow_06_management_analytics_system.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_06_flow_06_management_analytics_system.md) | **FLOW-06 (Layar E1–E4, F1–F3)** | Fleet Lifecycle, Menu Catalog, Analytics (Plan vs Actual), Reports Export, User RBAC Guard, Readiness & Hub Settings |
| [`PART_07_flow_verification_tdd_e2e.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/reconstruction/PART_07_flow_verification_tdd_e2e.md) | **Verification & Acceptance** | Pengujian E2E (Playwright), Audit Aksesibilitas WCAG 2.1 AA (Axe-Core), Performance Benchmark, & DoD Checklist |

---

## 🛠️ Prinsip Utama Rekayasa UI/UX
* **Desktop Control Room**: RADIX NATIVE, Dense but calm, Clear hierarchy, Rectangular geometry, Low visual noise, Strong information architecture, Minimal decoration.
* **MapOps**: Map-first, Panel second, Table third.
* **Rider**: Mobile-first, Large touch target ($\ge 44\times44\text{ px}$), One decision per screen, High visibility, Minimal navigation.
* **Test-Driven Development (TDD)**: Siklus *Red-Green-Refactor* ketat (*No production code without a failing test first*).

---

*Terakhir diperbarui: 16 September 2026*
