import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Badge,
  StatusBadge,
  Spinner,
  Alert,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/primitives";
import { DataTable, ConfirmDialog, MetricCard, SearchInput } from "@/components/composites";
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  ExternalLink,
  Shield,
  Clock,
  Mail,
  Phone,
  Key,
  RefreshCw,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import { formatRelativeTime, formatDate, formatRoleName, getRoleConfig } from "@/lib/formatters";

export function UsersPage() {
  const navigate = useNavigate();
  const currentAuthUser = useAuthStore((state) => state.user);

  // Data & Loading state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Quick Inspection Dialog state (Modal Dialog Tengah)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Dialog states for Actions
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // "suspend" | "reactivate" | "revoke_sessions" | "resend_activation" | "delete"
    targetUser: null,
    loading: false,
  });

  const [activationLinkModal, setActivationLinkModal] = useState({
    isOpen: false,
    link: "",
    copied: false,
    showLink: false,
  });

  // Fetch Users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedRole !== "ALL") params.role = selectedRole;
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await userService.getUsers(params);
      const userList = response.data?.users || response.users || response.data || [];
      setUsers(Array.isArray(userList) ? userList : []);
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Gagal memuat daftar pengguna.");
    } finally {
      setLoading(false);
    }
  }, [selectedRole, selectedStatus, searchTerm]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Secondary summary statistics
  const stats = useMemo(() => {
    const total = users.length;
    let active = 0;
    let pending = 0;
    let suspended = 0;

    users.forEach((u) => {
      const st = u.account_status || (u.is_active ? "ACTIVE" : "SUSPENDED");
      if (st === "PENDING") pending++;
      else if (st === "SUSPENDED") suspended++;
      else active++;
    });

    return { total, active, pending, suspended };
  }, [users]);

  // Paginated Users Slice & Total Pages
  const totalPages = Math.ceil(users.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, currentPage, pageSize]);

  // Action handlers
  const handleOpenDetailModal = (user) => {
    setSelectedUser(user);
    setDetailModalOpen(true);
  };

  const handleOpenConfirm = (type, targetUser) => {
    setConfirmModal({
      isOpen: true,
      type,
      targetUser,
      loading: false,
    });
  };

  const handleExecuteConfirm = async () => {
    const { type, targetUser } = confirmModal;
    if (!targetUser) return;

    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (type === "suspend") {
        await userService.setUserStatus(targetUser.id, false);
        setActionSuccess(`Akun ${targetUser.name} berhasil dinonaktifkan.`);
      } else if (type === "reactivate") {
        await userService.setUserStatus(targetUser.id, true);
        setActionSuccess(`Akun ${targetUser.name} berhasil diaktifkan kembali.`);
      } else if (type === "revoke_sessions") {
        await userService.revokeSessions(targetUser.id);
        setActionSuccess(`Seluruh sesi aktif untuk ${targetUser.name} berhasil dicabut.`);
      } else if (type === "resend_activation") {
        const result = await userService.resendActivation(targetUser.id);
        if (result.invitation_link) {
          setActivationLinkModal({
            isOpen: true,
            link: result.invitation_link,
            copied: false,
          });
        }
        setActionSuccess(`Tautan aktivasi baru untuk ${targetUser.name} berhasil dibuat.`);
      } else if (type === "delete") {
        await userService.deleteUser(targetUser.id);
        setActionSuccess(`Akun ${targetUser.name} berhasil dihapus dari sistem.`);
        if (selectedUser?.id === targetUser.id) {
          setDetailModalOpen(false);
        }
      }

      setConfirmModal({ isOpen: false, type: null, targetUser: null, loading: false });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Gagal mengeksekusi tindakan.");
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

  // Helper for Initials
  const getInitials = (name = "") => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";
  };

  // Table Columns Definition
  const columns = [
    {
      key: "user",
      header: "PENGGUNA",
      headerClassName: "w-[280px]",
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-subtle)] text-[var(--brand-primary)] text-xs font-heading font-medium border border-[var(--brand-primary)]/20 shadow-xs">
            {getInitials(row.name)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-heading font-medium text-slate-900 dark:text-slate-100 truncate hover:text-[var(--brand-primary)] transition-colors">
              {row.name}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
              {row.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "PERAN",
      headerClassName: "w-[150px]",
      render: (row) => {
        const roleVariant = {
          SUPERADMIN: "brand",
          SUPERVISOR: "info",
          RIDER: "success",
          STAFF_GUDANG: "warning",
        }[row.role] || "neutral";
        return (
          <Badge variant={roleVariant} size="sm" pill>
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80 shrink-0" />
            {formatRoleName(row.role)}
          </Badge>
        );
      },
    },
    {
      key: "account_status",
      header: "STATUS AKUN",
      headerClassName: "w-[140px]",
      render: (row) => {
        const status = row.account_status || (row.is_active ? "ACTIVE" : "SUSPENDED");
        return <StatusBadge status={status} size="sm" pill />;
      },
    },
    {
      key: "last_active",
      header: "AKTIVITAS TERAKHIR",
      headerClassName: "w-[150px]",
      render: (row) => (
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {row.account_status === "PENDING"
            ? "—"
            : row.last_active_at
              ? formatRelativeTime(row.last_active_at)
              : "Baru saja"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "TERDAFTAR",
      headerClassName: "w-[130px]",
      render: (row) => (
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {row.created_at ? formatDate(row.created_at) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[60px] text-right",
      cellClassName: "text-right",
      render: (row) => {
        const isSelf = String(row.id) === String(currentAuthUser?.id);
        const isPending = row.account_status === "PENDING";
        const isSuspended = row.account_status === "SUSPENDED";

        return (
          <div
            className="flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#181B22] transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  title="Aksi Pengguna"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-52 z-50">
                <DropdownMenuItem
                  icon={ExternalLink}
                  onSelect={() => navigate(`/admin/users/${row.id}`)}
                >
                  Lihat Profil Lengkap
                </DropdownMenuItem>

                {isPending && (
                  <DropdownMenuItem
                    icon={RefreshCw}
                    className="text-[var(--brand-primary)]"
                    onSelect={() => handleOpenConfirm("resend_activation", row)}
                  >
                    Kirim Ulang Aktivasi
                  </DropdownMenuItem>
                )}

                {!isSelf && !isPending && !isSuspended && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      icon={RotateCcw}
                      onSelect={() => handleOpenConfirm("revoke_sessions", row)}
                    >
                      Cabut Sesi Aktif
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={Ban}
                      destructive
                      onSelect={() => handleOpenConfirm("suspend", row)}
                    >
                      Nonaktifkan Akun
                    </DropdownMenuItem>
                  </>
                )}

                {!isSelf && isSuspended && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      icon={CheckCircle2}
                      className="text-[var(--status-success)]"
                      onSelect={() => handleOpenConfirm("reactivate", row)}
                    >
                      Aktifkan Kembali
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-medium tracking-tight text-slate-900 dark:text-slate-100">
            Manajemen Pengguna
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola akun pengguna, peran akses, dan status keamanan KopiGo
          </p>
        </div>

        <div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate("/admin/users/create")}
            className="flex items-center gap-2 text-xs h-9 px-4 rounded-xl"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Pengguna
          </Button>
        </div>
      </div>

      {/* Interactive Metric Cards (KPI) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Pengguna"
          value={stats.total}
          icon={Users}
          status="neutral"
          selected={selectedStatus === "ALL"}
          onClick={() => {
            setSelectedStatus("ALL");
            setCurrentPage(1);
          }}
          className="cursor-pointer"
        />
        <MetricCard
          title="Akun Aktif"
          value={stats.active}
          icon={CheckCircle2}
          status="success"
          selected={selectedStatus === "ACTIVE"}
          onClick={() => {
            setSelectedStatus("ACTIVE");
            setCurrentPage(1);
          }}
          className="cursor-pointer"
        />
        <MetricCard
          title="Menunggu Aktivasi"
          value={stats.pending}
          icon={Clock}
          status="warning"
          selected={selectedStatus === "PENDING"}
          onClick={() => {
            setSelectedStatus("PENDING");
            setCurrentPage(1);
          }}
          className="cursor-pointer"
        />
        <MetricCard
          title="Dinonaktifkan"
          value={stats.suspended}
          icon={Ban}
          status="danger"
          selected={selectedStatus === "SUSPENDED"}
          onClick={() => {
            setSelectedStatus("SUSPENDED");
            setCurrentPage(1);
          }}
          className="cursor-pointer"
        />
      </div>

      {/* Notifications */}
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
          title="Perhatian"
          onClose={() => setError(null)}
          className="text-xs rounded-xl"
        >
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            placeholder="Cari nama, email, atau username..."
            className="w-full sm:w-72"
          />

          <div className="w-44">
            <Select
              value={selectedRole}
              onValueChange={(val) => {
                setSelectedRole(val);
                setCurrentPage(1);
              }}
              placeholder="Semua Peran"
            >
              <SelectItem value="ALL">Semua Peran</SelectItem>
              <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
              <SelectItem value="MANAGEMENT">Manajer</SelectItem>
              <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
              <SelectItem value="RIDER">Rider</SelectItem>
              <SelectItem value="STAFF_GUDANG">Staff Gudang</SelectItem>
            </Select>
          </div>

          <div className="w-44">
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              placeholder="Semua Status"
            >
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="PENDING">Menunggu</SelectItem>
              <SelectItem value="SUSPENDED">Dinonaktifkan</SelectItem>
            </Select>
          </div>
        </div>

        {(searchTerm || selectedRole !== "ALL" || selectedStatus !== "ALL") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setSelectedRole("ALL");
              setSelectedStatus("ALL");
              setCurrentPage(1);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Reset Filter
          </Button>
        )}
      </div>

      {/* Main Table */}
      <div className="border border-slate-200/80 dark:border-white/5 rounded-xl bg-white dark:bg-[#111318] overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={paginatedUsers}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onRowClick={handleOpenDetailModal}
          emptyTitle="Tidak ada pengguna"
          emptyDescription="Tidak ada data pengguna yang cocok dengan kriteria filter saat ini."
        />
        {!loading && users.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200/60 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span>
              Menampilkan <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</strong>–<strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, users.length)}</strong> dari <strong className="text-slate-800 dark:text-slate-200">{users.length}</strong> pengguna
            </span>
            <span>{pageSize} data per halaman</span>
          </div>
        )}
      </div>

      {/* Quick Inspection Dialog Modal (Replacing Sheet) */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent maxWidth="md" className="rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-medium text-slate-900 dark:text-slate-100">
              Profil Ringkas Pengguna
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-5 pt-2">
              {/* Identity Header */}
              <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-subtle)] text-[var(--brand-primary)] text-base font-heading font-medium border border-[var(--brand-primary)]/20 shadow-xs">
                  {getInitials(selectedUser.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-heading font-medium text-slate-900 dark:text-slate-100 truncate">
                    {selectedUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                    {selectedUser.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={selectedUser.account_status || (selectedUser.is_active ? "ACTIVE" : "SUSPENDED")} size="sm" pill />
                    <span className="text-[10px] text-slate-400">·</span>
                    <Badge variant="neutral" size="sm" pill>
                      {formatRoleName(selectedUser.role)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Account Information Details Grid */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-heading font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Informasi Akun
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs border border-slate-200/70 dark:border-white/5 rounded-xl p-3 bg-white dark:bg-[#111318]">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Username</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {selectedUser.username || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Nomor Telepon</span>
                    <span className="text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {selectedUser.phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Terdaftar Pada</span>
                    <span className="text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {selectedUser.created_at ? formatDate(selectedUser.created_at) : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Aktivitas Terakhir</span>
                    <span className="text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {selectedUser.last_active_at ? formatRelativeTime(selectedUser.last_active_at) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-white/5">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setDetailModalOpen(false);
                    navigate(`/admin/users/${selectedUser.id}`);
                  }}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 text-xs h-9 rounded-xl"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Lihat Profil Lengkap</span>
                </Button>

                {selectedUser.account_status === "PENDING" && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenConfirm("resend_activation", selectedUser);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs h-9 rounded-xl text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Kirim Ulang Link</span>
                  </Button>
                )}

                {String(selectedUser.id) !== String(currentAuthUser?.id) ? (
                  <>
                    {selectedUser.account_status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => {
                          setDetailModalOpen(false);
                          handleOpenConfirm("suspend", selectedUser);
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs h-9 rounded-xl text-rose-500 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/60"
                      >
                        <Ban className="w-3.5 h-3.5 shrink-0" />
                        <span>Nonaktifkan</span>
                      </Button>
                    )}

                    {selectedUser.account_status === "SUSPENDED" && (
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => {
                          setDetailModalOpen(false);
                          handleOpenConfirm("reactivate", selectedUser);
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs h-9 rounded-xl text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Aktifkan</span>
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
          confirmModal.targetUser ? (
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {confirmModal.targetUser.name} ({confirmModal.targetUser.email})
              </div>
              {confirmModal.type === "suspend" && (
                <p>
                  Pengguna ini akan segera dicegah untuk masuk ke sistem KopiGo.
                  Seluruh sesi aktif dan token akses akan langsung dicabut.
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
                  Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
                </p>
              )}
            </div>
          ) : null
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

            <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl font-mono text-[11px]">
              <div className="relative flex-1">
                <input
                  type={activationLinkModal.showLink ? "text" : "password"}
                  readOnly
                  value={activationLinkModal.link}
                  className="w-full bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/10 rounded-lg pl-2.5 pr-8 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 select-all"
                />
                <button
                  type="button"
                  onClick={() =>
                    setActivationLinkModal((prev) => ({
                      ...prev,
                      showLink: !prev.showLink,
                    }))
                  }
                  aria-label={
                    activationLinkModal.showLink
                      ? "Sembunyikan tautan"
                      : "Tampilkan tautan"
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {activationLinkModal.showLink ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
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

export default UsersPage;
