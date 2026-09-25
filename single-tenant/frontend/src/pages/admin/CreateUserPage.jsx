import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Alert,
  RadioGroup,
  RadioGroupItem,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText } from "@/components/composites";
import {
  ArrowLeft,
  UserPlus,
  Copy,
  Check,
  CheckCircle2,
  Mail,
  Link as LinkIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import { userService } from "@/services/userService";
import { formatApiError } from "@/lib/errorHandler";

const createUserSchema = z.object({
  name: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  email: z.string().email("Format alamat email tidak valid"),
  username: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"], {
    required_error: "Pilih peran akun pengguna",
  }),
});

export function CreateUserPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activationType, setActivationType] = useState("manual"); // "manual" | "email"
  const [createdResult, setCreatedResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showInvitationLink, setShowInvitationLink] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      phone: "",
      role: "SUPERVISOR",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        username: data.username?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        role: data.role,
      };

      const result = await userService.createUser(payload);
      setCreatedResult(result);
    } catch (err) {
      setError(formatApiError(err, "auth"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6 max-w-3xl">
      {/* Header Breadcrumb & Title */}
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Manajemen Pengguna</span>
        </Link>
        <h1 className="text-xl font-heading font-medium tracking-tight text-slate-900 dark:text-slate-100">
          Tambah Pengguna Baru
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Buat akun staf baru untuk sistem operasional KopiGo dengan alur aktivasi mandiri
        </p>
      </div>

      {error && (
        <Alert variant="danger" title={error.title || "Perhatian"} className="text-xs rounded-xl">
          {error.message || error}
        </Alert>
      )}

      {/* Success State Screen if Created */}
      {createdResult ? (
        <div className="p-6 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success)]/20 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-medium text-slate-900 dark:text-slate-100">
                Akun Pengguna Berhasil Dibuat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Akun untuk <strong className="text-slate-800 dark:text-slate-200">{createdResult.name}</strong> ({createdResult.email}) siap diaktivasi.
              </p>
            </div>
          </div>

          {createdResult.invitation_link && (
            <div className="p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Tautan Aktivasi Mandiri (Berlaku 48 Jam)</span>
                <span className="text-[10px] text-slate-400 font-mono">Sekali Pakai</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showInvitationLink ? "text" : "password"}
                    readOnly
                    value={createdResult.invitation_link}
                    className="w-full bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvitationLink(!showInvitationLink)}
                    aria-label={showInvitationLink ? "Sembunyikan tautan" : "Tampilkan tautan"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showInvitationLink ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => copyToClipboard(createdResult.invitation_link)}
                  className="flex items-center gap-1.5 text-xs shrink-0 rounded-xl h-9"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Salin Tautan
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Kirimkan tautan ini kepada staf terkait untuk menyelesaikan aktivasi akun dan mengatur kata sandi mereka.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setCreatedResult(null);
                setValue("name", "");
                setValue("email", "");
                setValue("username", "");
                setValue("phone", "");
              }}
              className="text-xs rounded-xl h-9"
            >
              Buat Pengguna Lain
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate("/admin/users")}
              className="text-xs rounded-xl h-9"
            >
              Kembali ke Manajemen Pengguna
            </Button>
          </div>
        </div>
      ) : (
        /* Create User Form */
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 p-6 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs"
        >
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-heading font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Informasi Dasar
            </h3>

            <FormField error={!!errors.name}>
              <FormLabel htmlFor="name" required>
                Nama Lengkap
              </FormLabel>
              <Input
                id="name"
                {...register("name")}
                placeholder="Contoh: Budi Santoso"
                className="text-xs rounded-xl"
              />
              {errors.name && <FormErrorText>{errors.name.message}</FormErrorText>}
            </FormField>

            <FormField error={!!errors.email}>
              <FormLabel htmlFor="email" required>
                Alamat Email
              </FormLabel>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="Contoh: budi@kopigo.id"
                className="text-xs rounded-xl"
              />
              {errors.email && <FormErrorText>{errors.email.message}</FormErrorText>}
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField error={!!errors.username}>
                <FormLabel htmlFor="username">
                  Username <span className="text-slate-400 text-[10px]">(Opsional)</span>
                </FormLabel>
                <Input
                  id="username"
                  {...register("username")}
                  placeholder="Dibuat otomatis bila kosong"
                  className="text-xs rounded-xl"
                />
              </FormField>

              <FormField error={!!errors.phone}>
                <FormLabel htmlFor="phone">
                  Nomor Telepon <span className="text-slate-400 text-[10px]">(Opsional)</span>
                </FormLabel>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="Contoh: 081234567890"
                  className="text-xs rounded-xl"
                />
              </FormField>
            </div>

            <FormField error={!!errors.role}>
              <FormLabel htmlFor="role" required>
                Peran Pengguna
              </FormLabel>
              <Select
                value={selectedRole}
                onValueChange={(val) => setValue("role", val)}
              >
                <SelectItem value="SUPERVISOR">Supervisor (Kontrol Operasional)</SelectItem>
                <SelectItem value="MANAGEMENT">Manajer (Bisnis & Analitik)</SelectItem>
                <SelectItem value="RIDER">Rider (Operasional Lapangan)</SelectItem>
                <SelectItem value="SUPERADMIN">Super Admin (Akses Penuh)</SelectItem>
              </Select>
              {errors.role && <FormErrorText>{errors.role.message}</FormErrorText>}
            </FormField>
          </div>

          <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
            <h3 className="text-xs font-heading font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Metode Aktivasi Akun
            </h3>

            <div className="space-y-2">
              <label
                onClick={() => setActivationType("manual")}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  activationType === "manual"
                    ? "border-[var(--brand-primary)] bg-[var(--brand-subtle)]/20 dark:bg-[var(--brand-subtle)]/10 ring-1 ring-[var(--brand-primary)]/20"
                    : "border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#111318] hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex h-5 items-center">
                  <input
                    type="radio"
                    checked={activationType === "manual"}
                    onChange={() => setActivationType("manual")}
                    className="h-4 w-4 text-[var(--brand-primary)] cursor-pointer"
                  />
                </div>
                <div className="text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                    Buat tautan aktivasi mandiri (Manual)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Buat akun langsung dan tampilkan tautan aktivasi instan untuk disalin ke clipboard.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setActivationType("email")}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  activationType === "email"
                    ? "border-[var(--brand-primary)] bg-[var(--brand-subtle)]/20 dark:bg-[var(--brand-subtle)]/10 ring-1 ring-[var(--brand-primary)]/20"
                    : "border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#111318] hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex h-5 items-center">
                  <input
                    type="radio"
                    checked={activationType === "email"}
                    onChange={() => setActivationType("email")}
                    className="h-4 w-4 text-[var(--brand-primary)] cursor-pointer"
                  />
                </div>
                <div className="text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Kirim email aktivasi secara otomatis
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Kirim undangan aktivasi langsung ke alamat email staf melalui server SMTP KopiGo.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => navigate("/admin/users")}
              className="text-xs rounded-xl h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="flex items-center gap-2 text-xs rounded-xl h-9"
            >
              <UserPlus className="w-4 h-4" />
              Simpan Pengguna
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default CreateUserPage;
