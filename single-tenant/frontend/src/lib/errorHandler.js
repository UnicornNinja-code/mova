/**
 * MOVA Error Handling & Humanization Utility
 * 
 * Filosofi: Tenang → Jelas → Membantu → Tidak Mengintimidasi.
 * Mengubah pesan error teknis (Axios timeout, HTTP status codes, network errors)
 * menjadi bahasa pengguna yang sopan dan memberikan arahan tindakan.
 */

export function formatApiError(error, fallbackContext = "auth") {
  // Jika error sudah berformat { title, message }
  if (error && typeof error === "object" && error.title && error.message) {
    return error;
  }

  // 1. Deteksi Timeout (Axios timeout 15000ms / ECONNABORTED)
  const isTimeout =
    error?.code === "ECONNABORTED" ||
    (typeof error?.message === "string" && error.message.toLowerCase().includes("timeout")) ||
    error?.code === "ETIMEDOUT";

  if (isTimeout) {
    return {
      title: "Permintaan Belum Dapat Diproses",
      message: "Kami mengalami kendala saat menghubungi server. Silakan periksa koneksi internet Anda dan coba lagi beberapa saat.",
    };
  }

  // 2. Deteksi Kendala Jaringan / Offline / Server Refused
  const isNetworkError =
    error?.code === "ERR_NETWORK" ||
    error?.message === "Network Error" ||
    (typeof error?.message === "string" && error.message.toLowerCase().includes("failed to fetch"));

  if (isNetworkError) {
    return {
      title: "Koneksi Terputus",
      message: "Tidak dapat terhubung ke server MOVA. Pastikan perangkat Anda terhubung ke jaringan dan coba kembali.",
    };
  }

  // 3. Status Code HTTP dari Backend Response
  const status = error?.response?.status;
  const backendMsg = error?.response?.data?.msg || error?.response?.data?.message;

  if (status === 401 || status === 403) {
    if (fallbackContext === "login") {
      return {
        title: "Kredensial Tidak Sesuai",
        message: backendMsg || "Email, nama pengguna, atau kata sandi yang Anda masukkan tidak cocok. Silakan periksa kembali.",
      };
    }
    return {
      title: "Akses Ditolak",
      message: backendMsg || "Sesi Anda telah berakhir atau akun tidak memiliki izin untuk tindakan ini. Silakan masuk kembali.",
    };
  }

  if (status === 400) {
    // Validasi token atau input salah
    if (backendMsg && typeof backendMsg === "string") {
      return {
        title: "Permintaan Tidak Sesuai",
        message: backendMsg,
      };
    }
    return {
      title: "Tautan Tidak Berlaku",
      message: "Tautan atau token ini tidak valid, sudah kedaluwarsa, atau pernah digunakan. Silakan ajukan permintaan baru.",
    };
  }

  if (status === 404) {
    return {
      title: "Data Tidak Ditemukan",
      message: backendMsg || "Akun atau data yang Anda cari tidak tersedia dalam sistem.",
    };
  }

  if (status === 429) {
    return {
      title: "Akses Dibatasi Sementara",
      message: "Terlalu banyak percobaan dalam waktu singkat. Demi keamanan akun Anda, silakan tunggu beberapa saat sebelum mencoba kembali.",
    };
  }

  if (status && status >= 500) {
    return {
      title: "Layanan Sedang Mengalami Kendala",
      message: "Sistem pusat MOVA sedang dalam penanganan teknis. Silakan coba kembali dalam beberapa saat.",
    };
  }

  // 4. Jika ada pesan error eksplisit dari string/Error object yang sudah manusiawi
  if (typeof error === "string" && error.length > 0 && !error.toLowerCase().includes("timeout") && !error.toLowerCase().includes("error:")) {
    return {
      title: "Perhatian",
      message: error,
    };
  }

  if (backendMsg && typeof backendMsg === "string") {
    return {
      title: "Perhatian",
      message: backendMsg,
    };
  }

  // 5. Fallback Default yang Santun
  return {
    title: "Permintaan Belum Dapat Diselesaikan",
    message: "Terjadi kendala saat memproses tindakan Anda. Silakan coba beberapa saat lagi.",
  };
}
