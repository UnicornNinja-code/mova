# PART 01 — FLOW-01: GLOBAL SHELL & SECURITY CORE (LAYAR A1–A4)

> **Status Dokumen**: 🏛️ **FLOW-01 RECONSTRUCTION BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (Layar A1 s/d A4 & Master Navigation Shell)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Lingkup & Sasaran Layar

Fase ini merekonstruksi fondasi navigasi global dan siklus autentikasi pengguna secara menyeluruh:

| Kode Layar | Nama Layar | Rute URL | Role Pengguna | Komponen Radix UI | Endpoint API Terintegrasi |
|---|---|---|---|---|---|
| **Shell-D** | Desktop Master Shell | Layout Terpusat | Superadmin, Management, Supervisor | `DropdownMenu`, `Tooltip`, `Sheet`, `Toast` | `GET /users/profile`, `POST /auth/logout` |
| **Shell-M** | Rider Mobile PWA Shell | Layout PWA | Rider | `Tabs`, `Toast`, `Slot` | `GET /users/profile`, `POST /auth/logout` |
| **Layar A1** | Secure Sign In | `/login` | Public / All | `Form`, `Toast`, `Slot` | `POST /auth/login`, `POST /auth/refresh-token`, `GET /users/profile` |
| **Layar A2** | First-Login Password | `/auth/first-login` | Authenticated (Flagged) | `Form`, `Progress`, `Toast` | `POST /auth/first-login` |
| **Layar A3** | Account Activation | `/auth/activate` | Public (Invite Token) | `Form`, `Popover`, `Toast` | `POST /auth/activate` |
| **Layar A4** | Password Recovery | `/auth/forgot-password`<br>`/auth/reset-password` | Public | `Form`, `Alert`, `Toast` | `POST /auth/forgot-password`<br>`POST /auth/reset-password` |

---

## 2. Arsitektur Antarmuka & UX Persona

### 2.1 Master Desktop Shell (Radix Native DNA)
* **Kepadatan Terkelola (*Dense but Calm*)**: Sidebar ramping (*collapsible* 64px/240px) mengelompokkan fitur ke dalam 5 pilar navigasi:
  1. `OPERATIONS` (`/dashboard`, `/operations/live`, `/operations/weather`, `/distribution`)
  2. `INTELLIGENCE` (`/dss`, `/zones`, `/locations`, `/market/competitors`)
  3. `ASSETS & MASTER DATA` (`/poi`, `/fleet`, `/products`, `/spatial/roads`)
  4. `PERFORMANCE & REPORTS` (`/analytics`, `/reports`)
  5. `GOVERNANCE & SYSTEM` (`/users`, `/system/readiness`, `/system/data-health`, `/system/audit`, `/settings`)
* **Hindari 18 Menu Terpisah**: Tidak memetakan 18 modul backend menjadi 18 menu sejajar.
* **Header Operasional**: Status koneksi jaringan, tombol toggle sidebar, notifikasi ringkas, dan dropdown profil pengguna.

### 2.2 Mobile PWA Rider Shell
* **Bottom Navigation Bar 3 Tab**:
  * Tab 1: `🛵 My Shift` (`/rider`) — Alur klaim armada dan check-in geofence.
  * Tab 2: `☕ Spot & POS` (`/rider/selling`) — Penguncian spot dan kasir penjualan.
  * Tab 3: `👤 History & Akun` (`/rider/history`) — Riwayat shift dan pengaturan profil.

---

## 3. Spesifikasi TDD (Test-Driven Development)

Sesuai siklus **Red-Green-Refactor**, rangkaian unit & integration test wajib dibuat terlebih dahulu sebelum implementasi komponen.

### 3.1 Berkas Uji yang Wajib Dibuat (`tests/flow-01/`)
1. `tests/flow-01/authLogin.test.jsx`:
   - [x] Merender form login (username/email, password, captcha).
   - [x] Menampilkan pesan error validasi Zod jika field kosong.
   - [x] Memanggil `POST /auth/login` via MSW handler.
   - [x] Mengarahkan pengguna dengan flag `must_change_password: true` ke `/auth/first-login`.
   - [x] Mengarahkan role `RIDER` ke `/rider` dan role manajerial ke `/dashboard`.
2. `tests/flow-01/authFirstLogin.test.jsx`:
   - [x] Memvalidasi kecocokan password baru dan konfirmasi.
   - [x] Mengirim `POST /auth/first-login` dan menyimpan token sesi teranyar.
3. `tests/flow-01/authActivation.test.jsx`:
   - [x] Membaca token aktivasi dari query param URL.
   - [x] Memvalidasi format tanggal lahir dan konfirmasi kata sandi.
   - [x] Menembak `POST /auth/activate` dan me-redirect ke `/login` dengan toast sukses.
4. `tests/flow-01/masterShellNavigation.test.jsx`:
   - [x] Merender sidebar 5 pilar navigasi pada viewport desktop ($\ge 1024\text{ px}$).
   - [x] Menguji fungsi collapse/expand sidebar dan aksesibilitas keyboard (Tab & Enter).
   - [x] Merender bottom bar 3 tab pada viewport mobile ($< 768\text{ px}$) saat login sebagai Rider.

---

## 4. Rencana Implementasi Bertahap

```text
Langkah 1 (RED)   : Tulis seluruh file pengujian di tests/flow-01/ menggunakan Vitest & RTL.
Langkah 2 (GREEN) : Bangun AuthContext, Axios Client Interceptor, komponen Auth (A1-A4), dan Layout Shell.
Langkah 3 (VERIFY): Jalankan 'npx vitest run tests/flow-01/' dan pastikan 100% lulus (All Green).
Langkah 4 (REFACTOR): Rapikan token Tailwind, optimalkan bundle lazy loading route auth & shell.
```
