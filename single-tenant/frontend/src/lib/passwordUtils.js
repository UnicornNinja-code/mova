import * as z from "zod";

export const passwordRequirements = [
  { id: "length", regex: /.{8,}/, text: "Minimal 8 karakter" },
  { id: "uppercase", regex: /[A-Z]/, text: "Huruf kapital" },
  { id: "lowercase", regex: /[a-z]/, text: "Huruf kecil" },
  { id: "number", regex: /[0-9]/, text: "Angka" },
];

/**
 * Menghitung tingkat kekuatan kata sandi
 * @param {string} pwd 
 * @returns {{ score: number, label: string, color: string, isStrong: boolean }}
 */
export function checkPasswordStrength(pwd) {
  if (!pwd) {
    return { score: 0, label: "Kosong", color: "bg-zinc-700", isStrong: false };
  }

  let score = 0;
  passwordRequirements.forEach((req) => {
    if (req.regex.test(pwd)) score += 1;
  });

  if (score <= 2) {
    return { score: 1, label: "Lemah", color: "bg-red-500", isStrong: false };
  }
  if (score === 3) {
    return { score: 2, label: "Sedang", color: "bg-amber-500", isStrong: false };
  }
  return { score: 3, label: "Kuat", color: "bg-emerald-500", isStrong: true };
}

/**
 * Memeriksa kecocokan kata sandi dan konfirmasi secara real-time
 * @param {string} password 
 * @param {string} confirmPassword 
 * @returns {{ status: 'idle' | 'match' | 'mismatch', isMatching: boolean, message: string }}
 */
export function checkPasswordMatch(password, confirmPassword) {
  if (!confirmPassword || confirmPassword.length === 0) {
    return {
      status: "idle",
      isMatching: false,
      message: "",
    };
  }

  if (password === confirmPassword) {
    return {
      status: "match",
      isMatching: true,
      message: "Kata sandi cocok",
    };
  }

  return {
    status: "mismatch",
    isMatching: false,
    message: "Kata sandi belum cocok",
  };
}

/**
 * Standard Zod Schema untuk validasi password baru & konfirmasi
 */
export const passwordSetupSchema = z
  .object({
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung minimal 1 huruf kapital")
      .regex(/[a-z]/, "Harus mengandung minimal 1 huruf kecil")
      .regex(/[0-9]/, "Harus mengandung minimal 1 angka"),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });
