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
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Users
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Create User
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Provision a new MOVA account with invitation-based activation
        </p>
      </div>

      {error && (
        <Alert variant="danger" title={error.title} className="text-xs">
          {error.message}
        </Alert>
      )}

      {/* Success State Screen if Created */}
      {createdResult ? (
        <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Akun Pengguna Berhasil Dibuat
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Akun untuk {createdResult.name} ({createdResult.email}) siap diaktivasi.
              </p>
            </div>
          </div>

          {createdResult.invitation_link && (
            <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
                <span>Tautan Aktivasi Mandiri (Berlaku 48 Jam)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Single-use</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showInvitationLink ? "text" : "password"}
                    readOnly
                    value={createdResult.invitation_link}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] pl-3 pr-9 py-1.5 text-xs font-mono text-[var(--text-primary)] select-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvitationLink(!showInvitationLink)}
                    aria-label={showInvitationLink ? "Sembunyikan tautan" : "Tampilkan tautan"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {showInvitationLink ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => copyToClipboard(createdResult.invitation_link)}
                  className="flex items-center gap-1.5 text-xs shrink-0"
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
              <p className="text-[11px] text-[var(--text-muted)]">
                Kirimkan tautan ini kepada pengguna untuk menyelesaikan aktivasi akun dan membuat kata sandi baru.
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
              className="text-xs"
            >
              Buat Pengguna Lain
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate("/admin/users")}
              className="text-xs"
            >
              Kembali ke Daftar Pengguna
            </Button>
          </div>
        </div>
      ) : (
        /* Create User Form */
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)]"
        >
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Basic Information
            </h3>

            <FormField error={!!errors.name}>
              <FormLabel htmlFor="name" required>
                Full Name
              </FormLabel>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g. Febriyan Dwi"
                className="text-xs"
              />
              {errors.name && <FormErrorText>{errors.name.message}</FormErrorText>}
            </FormField>

            <FormField error={!!errors.email}>
              <FormLabel htmlFor="email" required>
                Email Address
              </FormLabel>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="e.g. user@kopikeliling.com"
                className="text-xs"
              />
              {errors.email && <FormErrorText>{errors.email.message}</FormErrorText>}
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField error={!!errors.username}>
                <FormLabel htmlFor="username">
                  Username <span className="text-[var(--text-muted)] text-[10px]">(Optional)</span>
                </FormLabel>
                <Input
                  id="username"
                  {...register("username")}
                  placeholder="Auto-generated if empty"
                  className="text-xs"
                />
              </FormField>

              <FormField error={!!errors.phone}>
                <FormLabel htmlFor="phone">
                  Phone Number <span className="text-[var(--text-muted)] text-[10px]">(Optional)</span>
                </FormLabel>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="e.g. 081234567890"
                  className="text-xs"
                />
              </FormField>
            </div>

            <FormField error={!!errors.role}>
              <FormLabel htmlFor="role" required>
                Role
              </FormLabel>
              <Select
                value={selectedRole}
                onValueChange={(val) => setValue("role", val)}
              >
                <SelectItem value="SUPERVISOR">Supervisor (Operational Control)</SelectItem>
                <SelectItem value="MANAGEMENT">Manager (Business & Analytics)</SelectItem>
                <SelectItem value="RIDER">Rider (Field Mobile Operations)</SelectItem>
                <SelectItem value="SUPERADMIN">Super Admin (Full Administration)</SelectItem>
              </Select>
              {errors.role && <FormErrorText>{errors.role.message}</FormErrorText>}
            </FormField>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Account Activation Flow
            </h3>

            <div className="space-y-2">
              <label
                onClick={() => setActivationType("manual")}
                className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
                  activationType === "manual"
                    ? "border-[var(--accent-primary)] bg-[var(--surface-raised)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <div className="flex h-5 items-center">
                  <input
                    type="radio"
                    checked={activationType === "manual"}
                    onChange={() => setActivationType("manual")}
                    className="h-4 w-4 text-[var(--accent-primary)] cursor-pointer"
                  />
                </div>
                <div className="text-xs">
                  <span className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5" />
                    Generate activation link manually
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Buat akun langsung dan tampilkan tautan aktivasi instan untuk disalin ke clipboard.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setActivationType("email")}
                className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
                  activationType === "email"
                    ? "border-[var(--accent-primary)] bg-[var(--surface-raised)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <div className="flex h-5 items-center">
                  <input
                    type="radio"
                    checked={activationType === "email"}
                    onChange={() => setActivationType("email")}
                    className="h-4 w-4 text-[var(--accent-primary)] cursor-pointer"
                  />
                </div>
                <div className="text-xs">
                  <span className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Send activation email automatically
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Kirim undangan aktivasi langsung ke alamat email staf melalui server SMTP.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => navigate("/admin/users")}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="flex items-center gap-2 text-xs"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default CreateUserPage;
