import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/userService";
import { formatRoleName, formatDate } from "@/lib/formatters";
import {
  Button,
  Input,
  Badge,
  Spinner,
  Alert,
} from "@/components/primitives";
import {
  User,
  Shield,
  Key,
  Lock,
  Mail,
  Phone,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Save,
  Check,
} from "lucide-react";

export function ProfilePage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState("info"); // "info" | "security"
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);

  // Profile Info Form State
  const [infoForm, setInfoForm] = useState({
    name: "",
    phone: "",
    birth_date: "",
  });
  const [infoSubmitting, setInfoSubmitting] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(null);
  const [infoError, setInfoError] = useState(null);

  // Password Change Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Load fresh profile on mount
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setLoading(true);
      try {
        const data = await userService.getProfile();
        if (isMounted && data) {
          setProfileData(data);
          setInfoForm({
            name: data.name || "",
            phone: data.phone || "",
            birth_date: data.birth_date ? data.birth_date.split("T")[0] : "",
          });
        }
      } catch (err) {
        if (isMounted) {
          // Fallback to authUser in store if profile fetch fails
          if (authUser) {
            setProfileData(authUser);
            setInfoForm({
              name: authUser.name || "",
              phone: authUser.phone || "",
              birth_date: authUser.birth_date ? authUser.birth_date.split("T")[0] : "",
            });
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  // Handle Profile Info Submit
  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setInfoSubmitting(true);
    setInfoSuccess(null);
    setInfoError(null);

    try {
      const updated = await userService.updateProfile({
        name: infoForm.name.trim(),
        phone: infoForm.phone ? infoForm.phone.trim() : null,
        birth_date: infoForm.birth_date || null,
      });

      setProfileData((prev) => ({ ...prev, ...updated }));
      setInfoSuccess("Informasi profil Anda berhasil diperbarui.");

      // Sync updated user data into auth store
      if (useAuthStore.getState().user) {
        const currentStored = useAuthStore.getState().user;
        const merged = { ...currentStored, ...updated };
        useAuthStore.setState({ user: merged });
        try {
          localStorage.setItem("mova_user", JSON.stringify(merged));
        } catch (e) {}
      }
    } catch (err) {
      setInfoError(err.response?.data?.msg || err.message || "Gagal memperbarui profil.");
    } finally {
      setInfoSubmitting(false);
    }
  };

  // Handle Password Change Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSubmitting(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Kata sandi baru minimal harus 8 karakter.");
      setPasswordSubmitting(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Konfirmasi kata sandi baru tidak cocok.");
      setPasswordSubmitting(false);
      return;
    }

    try {
      await userService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordSuccess("Kata sandi Anda berhasil diperbarui.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.msg || err.message || "Gagal memperbarui kata sandi. Periksa kembali kata sandi saat ini."
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // User initials
  const initials = (profileData?.name || authUser?.name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const currentRole = profileData?.role || authUser?.role || "SUPERADMIN";

  if (loading && !profileData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Spinner size="lg" label="Memuat Data Profil..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Card */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-linear-to-l from-[var(--accent-primary)]/5 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-xl font-bold text-[var(--accent-primary)] shrink-0 shadow-inner">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  {profileData?.name || authUser?.name || "Pengguna MOVA"}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Aktif
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                @{profileData?.username || authUser?.username || "username"} • {profileData?.email || authUser?.email || "email@mova.id"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                  <Shield className="w-3 h-3 text-[var(--accent-primary)]" />
                  {formatRoleName(currentRole)}
                </span>
                {profileData?.created_at && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-mono">
                    <Clock className="w-3 h-3" />
                    Bergabung {formatDate(profileData.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] mt-6 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-xs font-medium transition-all cursor-pointer ${
              activeTab === "info"
                ? "bg-[var(--accent-primary)] text-white shadow-xs font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Informasi Profil
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-xs font-medium transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-[var(--accent-primary)] text-white shadow-xs font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Keamanan & Kata Sandi
          </button>
        </div>
      </div>

      {/* TAB 1: INFORMASI PROFIL */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Edit Form */}
          <div className="md:col-span-2 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Perbarui Informasi Pribadi
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Sesuaikan nama lengkap dan detail kontak operasional akun Anda.
              </p>
            </div>

            {infoSuccess && (
              <Alert
                variant="success"
                title="Berhasil"
                onClose={() => setInfoSuccess(null)}
                className="text-xs"
              >
                {infoSuccess}
              </Alert>
            )}

            {infoError && (
              <Alert
                variant="danger"
                title="Gagal Memperbarui"
                onClose={() => setInfoError(null)}
                className="text-xs"
              >
                {infoError}
              </Alert>
            )}

            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Nama Lengkap <span className="text-[var(--status-danger)]">*</span>
                </label>
                <Input
                  type="text"
                  required
                  value={infoForm.name}
                  onChange={(e) => setInfoForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: Budi Santoso"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Nomor Telepon
                </label>
                <Input
                  type="tel"
                  value={infoForm.phone}
                  onChange={(e) => setInfoForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Contoh: 081234567890"
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Tanggal Lahir
                </label>
                <Input
                  type="date"
                  value={infoForm.birth_date}
                  onChange={(e) => setInfoForm((prev) => ({ ...prev, birth_date: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={infoSubmitting}
                  className="h-9 px-5 text-xs flex items-center gap-2"
                >
                  {infoSubmitting ? (
                    <Spinner size="xs" label="Menyimpan..." />
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Simpan Perubahan
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Read-only Account Properties Side Panel */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Identitas Akun
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">Email Akun</span>
                <span className="font-semibold text-[var(--text-primary)] break-all">
                  {profileData?.email || authUser?.email || "—"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  Email terikat permanen oleh Superadmin
                </span>
              </div>

              <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">Username</span>
                <span className="font-semibold font-mono text-[var(--text-primary)]">
                  @{profileData?.username || authUser?.username || "—"}
                </span>
              </div>

              <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">Jabatan / Role</span>
                <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                  {formatRoleName(currentRole)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KEAMANAN & GANTI PASSWORD */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Password Change Form */}
          <div className="md:col-span-2 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Perbarui Kata Sandi Akun
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Pastikan Anda menggunakan kombinasi kata sandi yang kuat dan aman.
              </p>
            </div>

            {passwordSuccess && (
              <Alert
                variant="success"
                title="Kata Sandi Berhasil Diperbarui"
                onClose={() => setPasswordSuccess(null)}
                className="text-xs"
              >
                {passwordSuccess}
              </Alert>
            )}

            {passwordError && (
              <Alert
                variant="danger"
                title="Gagal Mengubah Kata Sandi"
                onClose={() => setPasswordError(null)}
                className="text-xs"
              >
                {passwordError}
              </Alert>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Kata Sandi Saat Ini <span className="text-[var(--status-danger)]">*</span>
                </label>
                <Input
                  type={showCurrentPw ? "text" : "password"}
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  trailingElement={
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center"
                      title={showCurrentPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  placeholder="Masukkan kata sandi saat ini"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Kata Sandi Baru <span className="text-[var(--status-danger)]">*</span>
                </label>
                <Input
                  type={showNewPw ? "text" : "password"}
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  trailingElement={
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center"
                      title={showNewPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  placeholder="Minimal 8 karakter"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Konfirmasi Kata Sandi Baru <span className="text-[var(--status-danger)]">*</span>
                </label>
                <Input
                  type={showConfirmPw ? "text" : "password"}
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  trailingElement={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center"
                      title={showConfirmPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  placeholder="Ketik ulang kata sandi baru"
                  className="text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={passwordSubmitting}
                  className="h-9 px-5 text-xs flex items-center gap-2"
                >
                  {passwordSubmitting ? (
                    <Spinner size="xs" label="Menyimpan..." />
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Perbarui Kata Sandi
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Security Standards & Policy Side Panel */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Standar Keamanan Kata Sandi
            </h3>

            <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 p-0.5 rounded-full ${passwordForm.newPassword.length >= 8 ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                  <Check className="w-3 h-3" />
                </div>
                <span>Minimal 8 karakter</span>
              </div>

              <div className="flex items-start gap-2">
                <div className={`mt-0.5 p-0.5 rounded-full ${/[A-Z]/.test(passwordForm.newPassword) && /[a-z]/.test(passwordForm.newPassword) ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                  <Check className="w-3 h-3" />
                </div>
                <span>Kombinasi huruf besar & kecil</span>
              </div>

              <div className="flex items-start gap-2">
                <div className={`mt-0.5 p-0.5 rounded-full ${/[0-9]/.test(passwordForm.newPassword) ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                  <Check className="w-3 h-3" />
                </div>
                <span>Mengandung minimal satu angka</span>
              </div>

              <div className="flex items-start gap-2">
                <div className={`mt-0.5 p-0.5 rounded-full ${passwordForm.newPassword && passwordForm.newPassword === passwordForm.confirmPassword ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                  <Check className="w-3 h-3" />
                </div>
                <span>Konfirmasi kata sandi cocok</span>
              </div>
            </div>

            <div className="p-3 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] leading-relaxed mt-4">
              <span className="font-semibold text-[var(--text-secondary)] block mb-1">
                Catatan Sesi Aktif
              </span>
              Perubahan kata sandi akan segera berlaku. Sesi Anda di perangkat ini akan tetap berjalan secara aman.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
