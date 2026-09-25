import { describe, it, expect } from "vitest";
import { formatApiError } from "@/lib/errorHandler";

describe("🛡️ formatApiError — Polite & Reassuring Error Translator", () => {
  it("translates raw Axios timeout errors into polite, reassuring messages", () => {
    const timeoutError = {
      code: "ECONNABORTED",
      message: "timeout of 15000ms exceeded",
    };

    const formatted = formatApiError(timeoutError);
    expect(formatted.title).toBe("Permintaan Belum Dapat Diproses");
    expect(formatted.message).toContain("Kami mengalami kendala saat menghubungi server");
    expect(formatted.message).not.toContain("15000ms");
    expect(formatted.message).not.toContain("ECONNABORTED");
  });

  it("translates Network Error and connection refused errors into clear Indonesian messages", () => {
    const networkError = {
      code: "ERR_NETWORK",
      message: "Network Error",
    };

    const formatted = formatApiError(networkError);
    expect(formatted.title).toBe("Koneksi Terputus");
    expect(formatted.message).toContain("Tidak dapat terhubung ke server KopiGo");
    expect(formatted.message).not.toContain("ERR_NETWORK");
  });

  it("translates 401 Unauthorized for login into credential feedback", () => {
    const authError = {
      response: {
        status: 401,
        data: { msg: "Invalid username or password" },
      },
    };

    const formatted = formatApiError(authError, "login");
    expect(formatted.title).toBe("Kredensial Tidak Sesuai");
    expect(formatted.message).toBe("Invalid username or password");
  });

  it("translates 429 Rate Limit into security throttle notice", () => {
    const rateLimitError = {
      response: {
        status: 429,
        data: { msg: "Too many requests" },
      },
    };

    const formatted = formatApiError(rateLimitError);
    expect(formatted.title).toBe("Akses Dibatasi Sementara");
    expect(formatted.message).toContain("Terlalu banyak percobaan");
  });

  it("translates 500 Internal Server Error into calm technical notice", () => {
    const server500 = {
      response: {
        status: 500,
        data: { msg: "Internal Server Error" },
      },
    };

    const formatted = formatApiError(server500);
    expect(formatted.title).toBe("Layanan Sedang Mengalami Penyesuaian");
    expect(formatted.message).toContain("Sistem pusat KopiGo sedang dalam penanganan teknis");
  });

  it("preserves object if already formatted with title and message", () => {
    const preformatted = {
      title: "Token Belum Diisi",
      message: "Silakan masukkan token aktivasi staf Anda.",
    };

    const formatted = formatApiError(preformatted);
    expect(formatted).toEqual(preformatted);
  });
});
