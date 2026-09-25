# Ringkasan Diagnosa & Penyelesaian Console Error

## 1. Cloudflare Turnstile Script & Storage Warning
- **Gejala Masalah**:
  - `Tracking Prevention blocked access to storage for <URL>` (muncul berulang di console).
  - Peringatan event listener leak (`MaxListenersExceededWarning`) dari eksekusi script eksternal.
- **Penyebab**:
  - Script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` di-inject secara dinamis pada `TurnstileWidget.jsx` dan aktif pada `LoginPage.jsx`.
  - Browser tracking prevention (Edge/Chrome/Safari) memblokir third-party storage access di dalam iframe Turnstile saat dijalankan di `localhost`.
- **Solusi**:
  - Turnstile telah dilepas (*removed*) dari alur login `LoginPage.jsx` dan payload autentikasi `authService.login`.
  - Komponen `TurnstileWidget.jsx` dinetralkan sehingga tidak menyuntikkan script eksternal ke `<head>` browser.

---

## 2. Silent Refresh Token Error 401 on Initial Load
- **Gejala Masalah**:
  - `POST http://localhost:8074/api/auth/refresh-token 401 (Unauthorized)` muncul di console saat halaman login dimuat pertama kali.
  - Di development mode (React StrictMode), error terjadi dua kali akibat double-mount effect `App.jsx`.
- **Penyebab**:
  - Fungsi `initializeAuth()` pada `useAuthStore.js` selalu mengeksekusi panggilan `axios.post('/api/auth/refresh-token')` terlepas dari apakah pengguna memiliki token/sesi yang tersimpan atau berstatus tamu (guest/unauthenticated).
  - Ketika tamu membuka halaman tanpa cookie/token, backend merespons dengan HTTP 401/400, menghasilkan pesan error merah di devtools console.
- **Solusi (Sesuai Keputusan /grill-me: Interceptor-Only Lazy Refresh)**:
  - Pada `useAuthStore.initializeAuth()`, ditambahkan *lazy guard check*: jika tidak ada token akses yang tersimpan di storage lokal (`!currentToken`), proses inisialisasi langsung diselesaikan dengan `isInitialized: true` dan `isAuthenticated: false` tanpa melakukan panggilan jaringan ke `/api/auth/refresh-token`.
  - Panggilan silent refresh hanya dieksekusi secara *on-demand* melalui response interceptor `api.js` ketika permintaan ke endpoint terproteksi mengalami error 401.

---

## 3. Status Verifikasi
- Pengujian otomatis unit & integrasi (`vitest`): **15 Test Suites passed, 88 Tests passed (100%)**.
- Tidak ada error 401 yang muncul pada halaman login atau inisialisasi awal aplikasi.
