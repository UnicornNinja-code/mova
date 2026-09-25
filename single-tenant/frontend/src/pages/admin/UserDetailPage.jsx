import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Badge,
  StatusBadge,
  Alert,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText, ConfirmDialog } from "@/components/composites";
import {
  ArrowLeft,
  Users,
  Shield,
  Clock,
  Mail,
  Phone,
  Key,
  RefreshCw,
  Ban,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Edit2,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import { formatRelativeTime, formatDate, formatRoleName, getRoleConfig } from "@/lib/formatters";
import { formatApiError } from "@/lib/errorHandler";

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentAuthUser = useAuthStore((state) => state.user);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Action Dialog states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null,
    loading: false,
  });

  const [activationLinkModal, setActivationLinkModal] = useState({
    isOpen: false,
    link: "",
    copied: false,
  });

  const isSelf = String(user?.id) === String(currentAuthUser?.id);

  const loadUserDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUserById(id);
      setUser(data);
      setEditFormData({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
      });
    } catch (err) {
      setError(formatApiError(err, "auth"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadUserDetails();
    }
  }, [id, loadUserDetails]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setError(null);

    try {
      const updated = await userService.updateUser(id, editFormData);
      setUser(updated);
      setIsEditing(false);
      setActionSuccess("Data akun pengguna berhasil diperbarui.");
    } catch (err) {
      setError(formatApiError(err, "auth"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleExecuteConfirm = async () => {
    const { type } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, loading: true }));

    try {
      if (type === "suspend") {
        await userService.setUserStatus(id, false);
        setActionSuccess(`Akun ${user.name} berhasil dinonaktifkan.`);
      } else if (type === "reactivate") {
        await userService.setUserStatus(id, true);
        setActionSuccess(`Akun ${user.name} berhasil diaktifkan kembali.`);
      } else if (type === "revoke_sessions") {
        await userService.revokeSessions(id);
        setActionSuccess(`Seluruh sesi aktif untuk ${user.name} berhasil dicabut.`);
      } else if (type === "resend_activation") {
        const result = await userService.resendActivation(id);
        if (result.invitation_link) {
          setActivationLinkModal({
            isOpen: true,
            link: result.invitation_link,
            copied: false,
          });
        }
        setActionSuccess(`Tautan aktivasi baru untuk ${user.name} berhasil dibuat.`);
      } else if (type === "delete") {
        await userService.deleteUser(id);
        navigate("/admin/users", {
          state: { notice: `Akun ${user.name} berhasil dihapus.` },
        });
        return;
      }

      setConfirmModal({ isOpen: false, type: null, loading: false });
      await loadUserDetails();
    } catch (err) {
      setError(formatApiError(err, "auth"));
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setActivationLinkModal((prev) => ({ ...prev, copied: true }));
    setTimeout(() => {
      setActivationLinkModal((prev) => ({ ...prev, copied: false }));
    }, 2500);
  };

  const getInitials = (name = "") => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <Spinner size="lg" label="Memuat Detail Pengguna..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Alert variant="danger" title="Pengguna Tidak Ditemukan" className="rounded-xl">
          Data akun pengguna yang diminta tidak tersedia atau telah dihapus.
        </Alert>
        <Link to="/admin/users">
          <Button variant="outline" size="sm" className="text-xs rounded-xl">
            ← Kembali ke Manajemen Pengguna
          </Button>
        </Link>
      </div>
    );
  }

  const isPending = user.account_status === "PENDING";
  const isSuspended = user.account_status === "SUSPENDED";

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6 max-w-5xl">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Manajemen Pengguna</span>
        </Link>
      </div>

      {actionSuccess && (
        <Alert
          variant="success"
          title="Berhasil"
          onClose={() => setActionSuccess(null)}
          className="text-xs rounded-xl"
        >
          {actionSuccess}
        </Alert>
      )}

      {error && (
        <Alert
          variant="danger"
          title={error.title || "Perhatian"}
          onClose={() => setError(null)}
          className="text-xs rounded-xl"
        >
          {error.message || error}
        </Alert>
      )}

      {/* Identity Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-subtle)] text-[var(--brand-primary)] text-lg font-heading font-medium border border-[var(--brand-primary)]/20 shadow-xs">
            {getInitials(user.name)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-heading font-medium text-slate-900 dark:text-slate-100">
                {user.name}
              </h1>
              {isSelf && (
                <Badge variant="brand" size="sm" pill>
                  Akun Anda
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {user.email}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge status={user.account_status || (user.is_active ? "ACTIVE" : "SUSPENDED")} pill />
              <Badge variant="neutral" size="sm" pill>
                {formatRoleName(user.role)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-xs h-9 px-3 rounded-xl"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Data</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="text-xs h-9 px-3 rounded-xl"
            >
              Batal Edit
            </Button>
          )}

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details / Edit Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Account Profile Card */}
          <div className="p-5 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs space-y-4">
            <h3 className="text-xs font-heading font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Informasi Akun
            </h3>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <FormField>
                  <FormLabel htmlFor="edit-name" required>
                    Nama Lengkap
                  </FormLabel>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="text-xs rounded-xl"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel htmlFor="edit-email" required>
                    Alamat Email
                  </FormLabel>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="text-xs rounded-xl"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel htmlFor="edit-phone">Nomor Telepon</FormLabel>
                  <Input
                    id="edit-phone"
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="text-xs rounded-xl"
                    placeholder="Contoh: 08123456789"
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={editLoading}
                    className="rounded-xl"
                  >
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-slate-400">Nama Lengkap</span>
                  <span className="col-span-2 font-medium text-slate-800 dark:text-slate-200">
                    {user.name}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-slate-400">Email</span>
                  <span className="col-span-2 font-mono text-slate-800 dark:text-slate-200">
                    {user.email}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-slate-400">Username</span>
                  <span className="col-span-2 font-mono text-slate-800 dark:text-slate-200">
                    {user.username || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-slate-400">Nomor Telepon</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {user.phone || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-slate-400">Terdaftar Pada</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {user.created_at ? formatDate(user.created_at) : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-slate-400">Aktivitas Terakhir</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {user.last_active_at ? formatRelativeTime(user.last_active_at) : "Baru saja"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Authentication & Sessions Card */}
          <div className="p-5 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs space-y-4">
            <h3 className="text-xs font-heading font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Autentikasi & Keamanan
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              <div className="grid grid-cols-3 py-2.5 items-center">
                <span className="text-slate-400">Status Akun</span>
                <div className="col-span-2">
                  <StatusBadge status={user.account_status || (user.is_active ? "ACTIVE" : "SUSPENDED")} pill />
                </div>
              </div>
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-slate-400">Status Aktivasi</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200 font-medium">
                  {isPending ? "Menunggu Verifikasi & Pembuatan Password" : "Terverifikasi (Aktif)"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2.5 items-center">
                <span className="text-slate-400">Sesi Login Aktif</span>
                <div className="col-span-2 flex items-center justify-between">
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                    {user.active_sessions_count || 0} perangkat terhubung
                  </span>
                  {(user.active_sessions_count || 0) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          type: "revoke_sessions",
                          loading: false,
                        })
                      }
                      className="text-[11px] h-7 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Cabut Sesi
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Danger Zone */}
        <div className="space-y-6">
          <div className="p-5 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs space-y-3">
            <h3 className="text-xs font-heading font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tindakan Administratif
            </h3>

            <div className="space-y-2">
              {isPending && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: "resend_activation",
                      loading: false,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 rounded-xl text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Kirim Ulang Link Aktivasi</span>
                </Button>
              )}

              {!isSelf && !isPending && !isSuspended && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: "suspend",
                      loading: false,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 rounded-xl text-rose-500 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/60"
                >
                  <Ban className="w-3.5 h-3.5 shrink-0" />
                  <span>Nonaktifkan Akun</span>
                </Button>
              )}

              {!isSelf && isSuspended && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: "reactivate",
                      loading: false,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 rounded-xl text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Aktifkan Kembali Akun</span>
                </Button>
              )}

              {!isSelf && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: "delete",
                      loading: false,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 rounded-xl"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Hapus Akun</span>
                </Button>
              )}

              {isSelf && (
                <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Anda sedang melihat akun Superadmin Anda sendiri. Aksi penonaktifan dan penghapusan akun dibatasi untuk perlindungan sistem.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Confirmation Dialog */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        title={
          confirmModal.type === "suspend"
            ? "Nonaktifkan akun?"
            : confirmModal.type === "reactivate"
            ? "Aktifkan kembali akun?"
            : confirmModal.type === "revoke_sessions"
            ? "Cabut seluruh sesi aktif?"
            : confirmModal.type === "resend_activation"
            ? "Kirim tautan aktivasi baru?"
            : "Hapus akun pengguna?"
        }
        description={
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {user.name} ({user.email})
            </div>
            {confirmModal.type === "suspend" && (
              <p>
                Pengguna ini akan segera dicegah untuk masuk ke sistem KopiGo. Seluruh sesi aktif dan token akses akan langsung dicabut.
              </p>
            )}
            {confirmModal.type === "reactivate" && (
              <p>
                Pengguna akan dapat masuk kembali ke sistem KopiGo menggunakan kredensial mereka yang telah terdaftar.
              </p>
            )}
            {confirmModal.type === "revoke_sessions" && (
              <p>
                Pengguna akan dipaksa keluar dan harus masuk kembali di semua perangkat dan peramban aktif.
              </p>
            )}
            {confirmModal.type === "resend_activation" && (
              <p>
                Tautan aktivasi sebelumnya akan dibatalkan dan tautan baru yang berlaku selama 48 jam akan dibuat.
              </p>
            )}
            {confirmModal.type === "delete" && (
              <p className="text-[var(--status-danger)]">
                Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Seluruh catatan yang terkait akan dilepas.
              </p>
            )}
          </div>
        }
        confirmLabel={
          confirmModal.type === "suspend"
            ? "Nonaktifkan Akun"
            : confirmModal.type === "reactivate"
            ? "Aktifkan Akun"
            : confirmModal.type === "revoke_sessions"
            ? "Cabut Sesi"
            : confirmModal.type === "resend_activation"
            ? "Buat Tautan"
            : "Hapus Akun"
        }
        variant={
          confirmModal.type === "suspend" || confirmModal.type === "delete"
            ? "danger"
            : "primary"
        }
        loading={confirmModal.loading}
        onConfirm={handleExecuteConfirm}
      />

      {/* Manual Activation Link Modal */}
      <Dialog
        open={activationLinkModal.isOpen}
        onOpenChange={(open) => {
          if (!open) setActivationLinkModal((prev) => ({ ...prev, isOpen: false }));
        }}
      >
        <DialogContent maxWidth="md" className="rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-medium text-slate-900 dark:text-slate-100">
              Tautan Aktivasi Manual
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-500 dark:text-slate-400">
              Berikan tautan aktivasi berikut kepada pengguna untuk menetapkan kata sandi mereka. Tautan berlaku selama 48 jam.
            </p>

            <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl break-all font-mono text-[11px]">
              <span className="flex-1 select-all">{activationLinkModal.link}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(activationLinkModal.link)}
                className="shrink-0 flex items-center gap-1.5 h-8 text-xs rounded-lg"
              >
                {activationLinkModal.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin
                  </>
                )}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setActivationLinkModal((prev) => ({ ...prev, isOpen: false }))
              }
              className="rounded-lg"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserDetailPage;
