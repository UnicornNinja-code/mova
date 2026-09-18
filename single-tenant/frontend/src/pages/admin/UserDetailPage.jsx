import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Badge,
  Alert,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText, ConfirmDialog, RoleTransitionModal } from "@/components/composites";
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
    role: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Action Dialog states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null,
    loading: false,
  });

  const [roleChangeModal, setRoleChangeModal] = useState({
    isOpen: false,
    newRole: "",
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
        role: data.role || "RIDER",
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

  const handleExecuteRoleChange = async ({ newRole, reason }) => {
    setRoleChangeModal((prev) => ({ ...prev, loading: true }));
    try {
      const result = await userService.changeUserRole(id, { newRole, reason });
      setActionSuccess(result.message || `Peran pengguna berhasil diubah menjadi ${newRole}.`);
      setRoleChangeModal({ isOpen: false, newRole: "", loading: false });
      await loadUserDetails();
    } catch (err) {
      setError(formatApiError(err, "auth"));
      setRoleChangeModal((prev) => ({ ...prev, loading: false }));
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

  const renderStatusBadge = (accountStatus) => {
    switch (accountStatus) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono font-medium text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Active
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-amber-500/10 border border-amber-500/25 text-xs font-mono font-medium text-amber-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pending Activation
          </span>
        );
      case "SUSPENDED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-rose-500/10 border border-rose-500/25 text-xs font-mono font-medium text-rose-400">
            <Ban className="w-3.5 h-3.5 text-rose-400" />
            Suspended
          </span>
        );
    }
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
        <Alert variant="danger" title="Pengguna Tidak Ditemukan">
          Data akun pengguna yang diminta tidak tersedia atau telah dihapus.
        </Alert>
        <Link to="/admin/users">
          <Button variant="outline" size="sm" className="text-xs">
            ← Kembali ke Daftar Pengguna
          </Button>
        </Link>
      </div>
    );
  }

  const isPending = user.account_status === "PENDING";
  const isSuspended = user.account_status === "SUSPENDED";

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6 max-w-4xl">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Users
        </Link>
      </div>

      {actionSuccess && (
        <Alert
          variant="success"
          title="Berhasil"
          onClose={() => setActionSuccess(null)}
          className="text-xs"
        >
          {actionSuccess}
        </Alert>
      )}

      {error && (
        <Alert
          variant="danger"
          title={error.title || "Perhatian"}
          onClose={() => setError(null)}
          className="text-xs"
        >
          {error.message || error}
        </Alert>
      )}

      {/* Identity Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] text-base font-semibold text-[var(--text-primary)]">
            {getInitials(user.name)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                {user.name}
              </h1>
              {isSelf && (
                <Badge variant="neutral" className="text-[10px]">
                  Akun Anda
                </Badge>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono">
              {user.email}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
              {renderStatusBadge(user.account_status)}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] text-xs font-medium border shadow-2xs ${
                  getRoleConfig(user.role).badgeClass
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${getRoleConfig(user.role).dotClass}`} />
                {formatRoleName(user.role)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-xs h-8.5 px-3"
            >
              <Edit2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Edit User</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="text-xs h-8.5 px-3"
            >
              Batal Edit
            </Button>
          )}

          {!isSelf && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRoleChangeModal({
                  isOpen: true,
                  newRole: user.role,
                  loading: false,
                })
              }
              className="flex items-center gap-1.5 text-xs h-8.5 px-3"
            >
              <Shield className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Change Role</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details / Edit Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Account Profile Card */}
          <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Account Information
            </h3>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <FormField>
                  <FormLabel htmlFor="edit-name" required>
                    Full Name
                  </FormLabel>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="text-xs"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel htmlFor="edit-email" required>
                    Email Address
                  </FormLabel>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="text-xs"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel htmlFor="edit-phone">Phone Number</FormLabel>
                  <Input
                    id="edit-phone"
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="text-xs"
                    placeholder="e.g. 08123456789"
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={editLoading}
                  >
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] text-xs">
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-[var(--text-secondary)]">Full Name</span>
                  <span className="col-span-2 font-medium text-[var(--text-primary)]">
                    {user.name}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-[var(--text-secondary)]">Email</span>
                  <span className="col-span-2 font-mono text-[var(--text-primary)]">
                    {user.email}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-[var(--text-secondary)]">Username</span>
                  <span className="col-span-2 font-mono text-[var(--text-primary)]">
                    {user.username}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-[var(--text-secondary)]">Phone</span>
                  <span className="col-span-2 text-[var(--text-primary)]">
                    {user.phone || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-[var(--text-secondary)]">Created</span>
                  <span className="col-span-2 text-[var(--text-primary)]">
                    {user.created_at ? formatDate(user.created_at) : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-2.5">
                  <span className="text-[var(--text-secondary)]">Last active</span>
                  <span className="col-span-2 text-[var(--text-primary)]">
                    {user.last_active_at ? formatRelativeTime(user.last_active_at) : "Just now"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Authentication & Sessions Card */}
          <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Authentication & Security
            </h3>

            <div className="divide-y divide-[var(--border-subtle)] text-xs">
              <div className="grid grid-cols-3 py-2.5 items-center">
                <span className="text-[var(--text-secondary)]">Status Akun</span>
                <div className="col-span-2">
                  {renderStatusBadge(user.account_status)}
                </div>
              </div>
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-[var(--text-secondary)]">Verifikasi Email</span>
                <span className="col-span-2 text-[var(--text-primary)]">
                  {isPending ? "Menunggu Verifikasi & Pembuatan Password" : "Terverifikasi (Aktif)"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2.5 items-center">
                <span className="text-[var(--text-secondary)]">Sesi Login Aktif</span>
                <div className="col-span-2 flex items-center justify-between">
                  <span className="font-mono text-[var(--text-primary)] font-medium">
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
                      className="text-[11px] h-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Revoke Sessions
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Danger Zone */}
        <div className="space-y-6">
          <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Administrative Actions
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
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Resend Activation Link</span>
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
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/60"
                >
                  <Ban className="w-3.5 h-3.5 shrink-0" />
                  <span>Suspend Account</span>
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
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Reactivate Account</span>
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
                  className="w-full flex items-center justify-center gap-2 text-xs h-9"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Delete Account</span>
                </Button>
              )}

              {isSelf && (
                <div className="p-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-xs text-[var(--text-muted)] flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
                  <span>
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
            ? "Suspend account?"
            : confirmModal.type === "reactivate"
            ? "Reactivate account?"
            : confirmModal.type === "revoke_sessions"
            ? "Revoke active sessions?"
            : confirmModal.type === "resend_activation"
            ? "Generate new activation link?"
            : "Delete user account?"
        }
        description={
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            <div className="font-semibold text-[var(--text-primary)]">
              {user.name} ({user.email})
            </div>
            {confirmModal.type === "suspend" && (
              <p>
                This will prevent the user from signing in to MOVA. Existing active sessions will be revoked immediately.
              </p>
            )}
            {confirmModal.type === "reactivate" && (
              <p>
                This will restore access for the user to log in with their existing credentials.
              </p>
            )}
            {confirmModal.type === "revoke_sessions" && (
              <p>
                This will terminate all active browser and mobile sessions for this user.
              </p>
            )}
            {confirmModal.type === "resend_activation" && (
              <p>
                This will create a fresh single-use activation link valid for 48 hours.
              </p>
            )}
            {confirmModal.type === "delete" && (
              <p className="text-[var(--status-danger)]">
                This action is permanent and cannot be undone. All assigned records will be removed or detached.
              </p>
            )}
          </div>
        }
        confirmText={
          confirmModal.type === "suspend"
            ? "Suspend account"
            : confirmModal.type === "reactivate"
            ? "Reactivate account"
            : confirmModal.type === "revoke_sessions"
            ? "Revoke sessions"
            : confirmModal.type === "resend_activation"
            ? "Generate link"
            : "Delete account"
        }
        confirmVariant={
          confirmModal.type === "suspend" || confirmModal.type === "delete"
            ? "danger"
            : "primary"
        }
        loading={confirmModal.loading}
        onConfirm={handleExecuteConfirm}
      />

      {/* Dedicated Role Transition Modal */}
      <RoleTransitionModal
        isOpen={roleChangeModal.isOpen}
        targetUser={user}
        loading={roleChangeModal.loading}
        onClose={() => setRoleChangeModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleExecuteRoleChange}
      />

      {/* Manual Activation Link Modal */}
      <Dialog
        open={activationLinkModal.isOpen}
        onOpenChange={(open) => {
          if (!open) setActivationLinkModal((prev) => ({ ...prev, isOpen: false }));
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Activation Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-[var(--text-secondary)]">
              Berikan tautan aktivasi berikut kepada pengguna untuk menetapkan kata sandi mereka. Tautan berlaku selama 48 jam.
            </p>

            <div className="flex items-center gap-2 p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] break-all font-mono text-[11px]">
              <span className="flex-1 select-all">{activationLinkModal.link}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(activationLinkModal.link)}
                className="shrink-0 flex items-center gap-1.5 h-8 text-xs"
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
