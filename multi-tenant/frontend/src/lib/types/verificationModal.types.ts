/*
 * verificationModal.types.ts
 * Type definitions and preset configurations for StepVerificationModal in TypeScript
 */

export type VerificationContextType =
  | 'DSS_RECALIBRATE'
  | 'DISTRIBUTION_COMMIT'
  | 'DELETE_PRODUCT'
  | 'DELETE_USER'
  | 'USER_TOGGLE_STATUS'
  | 'ARMADA_MAINTENANCE_OVERRIDE'
  | 'ARMADA_DELETE'
  | 'ZONE_CREATE_UPDATE'
  | 'ZONE_TOGGLE_STATUS'
  | 'ZONE_DELETE'
  | 'SPATIAL_RULES_UPDATE'
  | 'WEATHER_SYNC_BROADCAST'
  | 'USER_PASSWORD_RESET'
  | 'CHECKOUT_SHIFT'
  | 'CUSTOM';

export type VerificationSeverity = 'info' | 'warning' | 'danger' | 'success';

export interface VerificationModalOptions {
  isOpen?: boolean;
  context?: VerificationContextType;
  title?: string;
  subtitle?: string;
  badge?: string;
  targetName?: string;
  targetId?: string | number;
  severity?: VerificationSeverity;
  impactPoints?: string[];
  verificationLabel?: string;
  requirePhrase?: string | null; // e.g. "KONFIRMASI" or item name
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'secondary' | 'white';
  customPayload?: Record<string, any>;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
}

export interface ContextPreset {
  badge: string;
  title: string;
  subtitle: string;
  severity: VerificationSeverity;
  confirmVariant: 'primary' | 'danger' | 'secondary' | 'white';
  confirmLabel: string;
  cancelLabel: string;
  verificationLabel: string;
  impactPoints: string[];
}

export const VERIFICATION_PRESETS: Record<VerificationContextType, ContextPreset> = {
  DSS_RECALIBRATE: {
    badge: 'BWM-TOPSIS Engine',
    title: 'Rekalkulasi Bobot Keputusan DSS',
    subtitle: 'Menghitung ulang preferensi kriteria dan merombak urutan ranking zona operasional lapangan.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Eksekusi Rekalkulasi Bobot',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya memahami bahwa hasil kalkulasi ini akan langsung diterapkan ke sistem rekomendasi rute bagi seluruh rider aktif.',
    impactPoints: [
      'Memperbarui ranking prioritas zona di peta operasional secara real-time.',
      'Memengaruhi alokasi rekomendasi titik penjualan bagi seluruh rider aktif.',
      'Audit log akan mencatat identitas Anda sebagai analis pengubah konfigurasi.',
    ],
  },
  DISTRIBUTION_COMMIT: {
    badge: 'Plotting & Dispatch',
    title: 'Komitmen Alokasi Distribusi Rider',
    subtitle: 'Menerapkan alokasi zona wilayah dan armada bagi seluruh rider dalam antrean shift harian.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Commit & Terbitkan Penugasan',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya telah meninjau alokasi zona dan ketersediaan kapasitas armada, serta siap menerbitkan penugasan resmi.',
    impactPoints: [
      'Mengunci antrean FIFO rider untuk sesi operasional hari ini.',
      'Menandai unit armada yang ditugaskan menjadi status IN_USE.',
      'Notifikasi penugasan zona akan diterbitkan ke aplikasi mobile rider.',
    ],
  },
  DELETE_PRODUCT: {
    badge: 'Katalog Menu & Penjualan',
    title: 'Hapus / Nonaktifkan Menu Produk',
    subtitle: 'Tindakan penghapusan menu memerlukan verifikasi riwayat transaksi penjualan.',
    severity: 'danger',
    confirmVariant: 'danger',
    confirmLabel: 'Konfirmasi Proses Produk',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya menyetujui perubahan status atau penghapusan produk menu ini.',
    impactPoints: [
      'Menu yang telah memiliki riwayat penjualan tidak dapat dihapus permanen untuk menjaga pembukuan keuangan.',
      'Gunakan fitur Arsipkan (Discontinued) untuk menonaktifkan penjualan tanpa merusak histori transaksi.',
    ],
  },
  DELETE_USER: {
    badge: 'Otorisasi & Akun',
    title: 'Nonaktifkan / Hapus Akun Pengguna',
    subtitle: 'Mencabut hak akses akun dari lingkungan operasional sistem MantaKopi COZIS.',
    severity: 'danger',
    confirmVariant: 'danger',
    confirmLabel: 'Konfirmasi Hapus Akun',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya mengonfirmasi penonaktifan atau penghapusan akun pengguna ini secara sadar.',
    impactPoints: [
      'Pengguna tidak lagi dapat login atau mengakses sistem operasional.',
      'Seluruh riwayat penugasan, distribusi, atau transaksi masa lalu tetap tersimpan utuh di log audit.',
    ],
  },
  USER_TOGGLE_STATUS: {
    badge: 'Status Akun Pengguna',
    title: 'Ubah Status Akses Pengguna',
    subtitle: 'Mengubah status aktivasi akun pengguna di lingkungan operasional.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Konfirmasi Ubah Status',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya mengonfirmasi perubahan status akses akun pengguna ini.',
    impactPoints: [
      'Pengguna yang dinonaktifkan tidak akan dapat masuk atau menerima penugasan baru.',
      'Akun yang diaktifkan kembali akan langsung dapat mengakses fitur sesuai hak akses perannya.',
    ],
  },
  ARMADA_MAINTENANCE_OVERRIDE: {
    badge: 'Manajemen Armada',
    title: 'Alihkan Armada ke Mode Maintenance',
    subtitle: 'Mengubah status armada gerobak/motor listrik menjadi tidak tersedia untuk penugasan.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Alihkan ke Perbaikan',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya memastikan unit armada ini telah berada di Central Hub dan tidak sedang dikendarai rider di lapangan.',
    impactPoints: [
      'Unit tidak akan muncul dalam pilihan plotting rute atau reservasi gerobak rider.',
      'Jika unit sedang berstatus IN_USE, pengalihan memerlukan konfirmasi serah terima fisik dari rider.',
    ],
  },
  ARMADA_DELETE: {
    badge: 'Inventaris Armada',
    title: 'Hapus Unit Armada Operasional',
    subtitle: 'Menghapus data armada secara permanen dari sistem basis data.',
    severity: 'danger',
    confirmVariant: 'danger',
    confirmLabel: 'Konfirmasi Hapus Armada',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya memastikan unit armada ini tidak sedang digunakan bertugas atau memiliki penugasan aktif.',
    impactPoints: [
      'Data spesifikasi dan identitas unit armada akan dihapus dari daftar master.',
      'Unit armada yang sedang digunakan (IN_USE) tidak dapat dihapus sebelum shift diselesaikan.',
    ],
  },
  ZONE_CREATE_UPDATE: {
    badge: 'Zona Spasial GIS',
    title: 'Konfirmasi Simpan Data Zona',
    subtitle: 'Menyimpan konfigurasi geofence poligon dan parameter kapasitas wilayah.',
    severity: 'info',
    confirmVariant: 'primary',
    confirmLabel: 'Simpan Zona Wilayah',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya telah memastikan koordinat geofence dan kapasitas kuota rider telah sesuai.',
    impactPoints: [
      'Poligon batas wilayah akan otomatis divalidasi terhadap restriksi jalan tol & protokol di PostGIS.',
      'Kapasitas maksimal yang ditentukan akan menjadi kuota antrean plotting rider harian.',
    ],
  },
  ZONE_TOGGLE_STATUS: {
    badge: 'Operasional Zona',
    title: 'Ubah Status Operasional Zona',
    subtitle: 'Mengubah status aktivasi zona wilayah untuk penugasan rute harian.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Konfirmasi Ubah Status',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya mengonfirmasi perubahan status ketersediaan zona operasional ini.',
    impactPoints: [
      'Zona yang dinonaktifkan tidak akan dimasukkan dalam simulasi auto-plotting dan ranking TOPSIS.',
      'Rider yang sedang bertugas di zona ini tetap dapat menyelesaikan shift berjalan.',
    ],
  },
  ZONE_DELETE: {
    badge: 'Hapus Zona Wilayah',
    title: 'Hapus Permanen Zona Wilayah',
    subtitle: 'Menghapus batas geofence dan konfigurasi zona dari sistem PostGIS.',
    severity: 'danger',
    confirmVariant: 'danger',
    confirmLabel: 'Hapus Permanen Zona',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya memahami bahwa zona ini beserta seluruh histori plottingnya akan dihapus permanen.',
    impactPoints: [
      'Batas poligon spasial zona akan dihapus dari peta operasional.',
      'Pastikan tidak ada sesi distribusi aktif yang sedang menggunakan zona ini.',
    ],
  },
  SPATIAL_RULES_UPDATE: {
    badge: 'Batas Wilayah GIS',
    title: 'Pembaruan Aturan Restriksi Spasial',
    subtitle: 'Perubahan aturan restriksi jalan akan memicu validasi poligon otomatis di PostGIS.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Terapkan Aturan Spasial',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya memahami bahwa seluruh zona yang memotong jalan terlarang akan otomatis ditandai INVALID.',
    impactPoints: [
      'Sistem PostGIS akan memindai seluruh poligon zona operasional yang memotong garis jalan tol atau protokol.',
      'Zona yang melanggar akan otomatis ditandai status INVALID dan tidak dapat digunakan untuk plotting rute.',
    ],
  },
  WEATHER_SYNC_BROADCAST: {
    badge: 'Operasional Lapangan',
    title: 'Siaran Peringatan Darurat Cuaca',
    subtitle: 'Menyiarkan pemberitahuan kondisi cuaca ekstrem ke perangkat seluruh rider aktif.',
    severity: 'info',
    confirmVariant: 'primary',
    confirmLabel: 'Siarkan Peringatan Lapangan',
    cancelLabel: 'Batal',
    verificationLabel: 'Kirimkan sinyal peringatan cuaca buruk ke seluruh rider aktif sekarang.',
    impactPoints: [
      'Notifikasi push mendesak akan tampil pada layar aplikasi mobile rider yang sedang bertugas.',
      'Rider akan diinstruksikan mengamankan armada ke shelter terdekat berkanopi.',
    ],
  },
  USER_PASSWORD_RESET: {
    badge: 'Keamanan Kredensial',
    title: 'Reset Kata Sandi Pengguna',
    subtitle: 'Membuat kredensial sementara dan mengganti sandi akun yang terdaftar.',
    severity: 'info',
    confirmVariant: 'primary',
    confirmLabel: 'Buat Sandi Sementara',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya mengonfirmasi pemberian akses reset kredensial untuk pengguna ini.',
    impactPoints: [
      'Kata sandi lama akan langsung tidak berlaku.',
      'Pengguna wajib memperbarui kata sandi pada kesempatan login berikutnya.',
    ],
  },
  CHECKOUT_SHIFT: {
    badge: 'Selesai Bertugas',
    title: 'Konfirmasi Tutup Shift Operasional',
    subtitle: 'Menyelesaikan penugasan harian dan mengembalikan armada ke markas Central Hub.',
    severity: 'success',
    confirmVariant: 'primary',
    confirmLabel: 'Konfirmasi Check-out Shift',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya telah menghitung fisik sisa stok produk dan merekonsiliasi penerimaan kas/QRIS.',
    impactPoints: [
      'Seluruh transaksi penjualan harian shift ini akan ditutup dan direkonsiliasi.',
      'Unit armada dilepaskan dari akun rider dan siap diisi daya (charging) di markas Central Hub.',
    ],
  },
  CUSTOM: {
    badge: 'Verifikasi Sistem',
    title: 'Konfirmasi Tindakan Operasional',
    subtitle: 'Harap periksa rincian tindakan sebelum melanjutkan proses eksekusi.',
    severity: 'warning',
    confirmVariant: 'primary',
    confirmLabel: 'Konfirmasi & Lanjutkan',
    cancelLabel: 'Batal',
    verificationLabel: 'Saya telah memeriksa rincian tindakan ini dan menyetujui eksekusi sistem.',
    impactPoints: [
      'Tindakan ini akan diproses langsung ke basis data utama COZIS.',
      'Pastikan seluruh parameter yang dipilih telah sesuai dengan prosedur operasional standar.',
    ],
  },
};
