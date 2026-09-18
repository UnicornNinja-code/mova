import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Badge,
  Spinner,
  Alert,
  Sheet,
  SheetContent,
  SheetFooter,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/primitives";
import { DataTable, ConfirmDialog, RoleTransitionModal } from "@/components/composites";
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

  // Quick Inspection Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Dialog states for Actions
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // "suspend" | "reactivate" | "revoke_sessions" | "resend_activation" | "delete"
    targetUser: null,
    loading: false,
  });

  const [roleChangeModal, setRoleChangeModal] = useState({
    isOpen: false,
    targetUser: null,
    newRole: "",
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
  const handleOpenDrawer = (user) => {
    setSelectedUser(user);
    setDrawerOpen(true);
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
          setDrawerOpen(false);
        }
      }

      setConfirmModal({ isOpen: false, type: null, targetUser: null, loading: false });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Gagal mengeksekusi tindakan.");
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleOpenRoleChange = (targetUser) => {
    setRoleChangeModal({
      isOpen: true,
      targetUser,
      newRole: targetUser.role,
      loading: false,
    });
  };

  const handleExecuteRoleChange = async ({ targetUserId, newRole, reason }) => {
    setRoleChangeModal((prev) => ({ ...prev, loading: true }));
    try {
      const result = await userService.changeUserRole(targetUserId, { newRole, reason });
      setActionSuccess(result.message || `Peran pengguna berhasil diubah menjadi ${newRole}.`);
      setRoleChangeModal({ isOpen: false, targetUser: null, newRole: "", loading: false });
      if (selectedUser?.id === targetUserId) {
        setSelectedUser((prev) => ({ ...prev, role: newRole }));
      }
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Gagal mengubah peran pengguna.");
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

  // Status Dot Renderer (Standard Dense Calm Representation)
  const renderStatusDot = (accountStatus) => {
    switch (accountStatus) {
      case "ACTIVE":
        return (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--status-success)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">Active</span>
          </div>
        );
      case "PENDING":
        return (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border-2 border-[var(--status-warning)] bg-transparent" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">Pending</span>
          </div>
        );
      case "SUSPENDED":
      default:
        return (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--status-danger)]" />
            <span className="text-xs font-medium text-[var(--text-muted)]">Suspended</span>
          </div>
        );
    }
  };

  // Table Columns Definition
  const columns = [
    {
      key: "user",
      header: "USER",
      headerClassName: "w-[280px]",
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs font-semibold text-[var(--text-primary)]">
            {getInitials(row.name)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-[var(--text-primary)] truncate hover:underline">
              {row.name}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] truncate">
              {row.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "ROLE",
      headerClassName: "w-[140px]",
      render: (row) => {
        const config = getRoleConfig(row.role);
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium border shadow-2xs ${config.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
            {config.label}
          </span>
        );
      },
    },
    {
      key: "account_status",
      header: "ACCOUNT",
      headerClassName: "w-[130px]",
      render: (row) => renderStatusDot(row.account_status),
    },
    {
      key: "last_active",
      header: "LAST ACTIVE",
      headerClassName: "w-[140px]",
      render: (row) => {
        if (row.account_status === "PENDING") {
          return <span className="text-xs text-[var(--text-muted)]">—</span>;
        }
        return (
          <span className="text-xs text-[var(--text-secondary)]">
            {row.last_active_at ? formatRelativeTime(row.last_active_at) : "Just now"}
          </span>
        );
      },
    },
    {
      key: "created_at",
      header: "CREATED",
      headerClassName: "w-[130px]",
      render: (row) => (
        <span className="text-xs text-[var(--text-muted)]">
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
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  title="Aksi Pengguna"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-48 z-50">
                <DropdownMenuItem
                  icon={ExternalLink}
                  onSelect={() => navigate(`/admin/users/${row.id}`)}
                >
                  Lihat Profil
                </DropdownMenuItem>

                <DropdownMenuItem
                  icon={Users}
                  onSelect={() => navigate(`/admin/users/${row.id}`)}
                >
                  Ubah Pengguna
                </DropdownMenuItem>

                {!isSelf && (
                  <DropdownMenuItem
                    icon={Shield}
                    onSelect={() => handleOpenRoleChange(row)}
                  >
                    Ganti Jabatan
                  </DropdownMenuItem>
                )}

                {isPending && (
                  <DropdownMenuItem
                    icon={RefreshCw}
                    className="text-[var(--accent-primary)]"
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
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-5">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Users
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage MOVA accounts and access
          </p>
          {/* KPI Micro-Badges summary */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] shadow-xs">
              <Users className="w-3 h-3 text-[var(--text-muted)]" />
              <strong className="text-[var(--text-primary)] font-semibold">{stats.total}</strong>
              <span className="text-[10px] text-[var(--text-muted)]">Users</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-mono text-emerald-400 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <strong className="font-semibold text-emerald-300">{stats.active}</strong>
              <span className="text-[10px] text-emerald-400/80">Active</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-amber-500/10 border border-amber-500/25 text-[11px] font-mono text-amber-400 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full border border-amber-400" />
              <strong className="font-semibold text-amber-300">{stats.pending}</strong>
              <span className="text-[10px] text-amber-400/80">Pending</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-rose-500/10 border border-rose-500/25 text-[11px] font-mono text-rose-400 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <strong className="font-semibold text-rose-300">{stats.suspended}</strong>
              <span className="text-[10px] text-rose-400/80">Suspended</span>
            </span>
          </div>
        </div>

        <div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate("/admin/users/create")}
            className="flex items-center gap-2 text-xs h-9 px-4"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Notifications */}
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
          title="Perhatian"
          onClose={() => setError(null)}
          className="text-xs"
        >
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search name, email, or username..."
            className="pl-8 text-xs h-9"
          />
        </div>

        <div className="w-[160px]">
          <Select
            value={selectedRole}
            onValueChange={(val) => {
              setSelectedRole(val);
              setCurrentPage(1);
            }}
            placeholder="Role"
          >
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
            <SelectItem value="MANAGEMENT">Manager</SelectItem>
            <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
            <SelectItem value="RIDER">Rider</SelectItem>
          </Select>
        </div>

        <div className="w-[160px]">
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            placeholder="Status"
          >
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </Select>
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
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Reset filter
          </Button>
        )}
      </div>

      {/* Main Table */}
      <div className="border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)] overflow-hidden">
        <DataTable
          columns={columns}
          data={paginatedUsers}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onRowClick={handleOpenDrawer}
          emptyTitle="Tidak ada pengguna"
          emptyDescription="Tidak ada data pengguna yang cocok dengan kriteria filter saat ini."
        />
        {!loading && users.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-muted)]/30 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] font-mono">
            <span>
              Menampilkan <strong className="text-[var(--text-primary)]">{(currentPage - 1) * pageSize + 1}</strong>–<strong className="text-[var(--text-primary)]">{Math.min(currentPage * pageSize, users.length)}</strong> dari <strong className="text-[var(--text-primary)]">{users.length}</strong> pengguna
            </span>
            <span>{pageSize} data per halaman</span>
          </div>
        )}
      </div>

      {/* Quick Inspection Drawer (Right-Side Sheet) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          width="md"
          title="User Profile"
          subtitle="Quick identity inspection & administrative control"
        >
          {selectedUser && (
            <div className="space-y-5">
              {/* Identity Header Card */}
              <div className="flex items-center gap-3 p-3.5 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-semibold text-[var(--text-primary)]">
                  {getInitials(selectedUser.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {selectedUser.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {selectedUser.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {renderStatusDot(selectedUser.account_status)}
                    <span className="text-[10px] text-[var(--text-muted)]">·</span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] font-medium">
                      {selectedUser.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Account Information */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Account
                </h4>
                <div className="space-y-2 text-xs border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3 bg-[var(--surface)] divide-y divide-[var(--border-subtle)]">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Role</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-full)] text-[10px] font-medium border ${
                        getRoleConfig(selectedUser.role).badgeClass
                      }`}
                    >
                      <span className={`h-1 w-1 rounded-full ${getRoleConfig(selectedUser.role).dotClass}`} />
                      {formatRoleName(selectedUser.role)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Username</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {selectedUser.username}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Phone</span>
                    <span className="text-[var(--text-primary)]">
                      {selectedUser.phone || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Created</span>
                    <span className="text-[var(--text-primary)]">
                      {selectedUser.created_at ? formatDate(selectedUser.created_at) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Last active</span>
                    <span className="text-[var(--text-primary)]">
                      {selectedUser.last_active_at ? formatRelativeTime(selectedUser.last_active_at) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Authentication & Access */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Authentication
                </h4>
                <div className="space-y-2 text-xs border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3 bg-[var(--surface)] divide-y divide-[var(--border-subtle)]">
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Status Aktivasi</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {selectedUser.account_status === "PENDING" ? "Menunggu Aktivasi" : "Terverifikasi"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Active Sessions</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {selectedUser.active_sessions_count || 0} active
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Drawer */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate(`/admin/users/${selectedUser.id}`);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-xs h-9 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Open Full Profile</span>
                </Button>

                {selectedUser.account_status === "PENDING" && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => handleOpenConfirm("resend_activation", selectedUser)}
                    className="w-full flex items-center justify-center gap-2 text-xs h-9 text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Resend Activation Link</span>
                  </Button>
                )}

                {String(selectedUser.id) !== String(currentAuthUser?.id) ? (
                  <>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => handleOpenRoleChange(selectedUser)}
                      className="w-full flex items-center justify-center gap-2 text-xs h-9"
                    >
                      <Shield className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                      <span>Change Role</span>
                    </Button>

                    {selectedUser.account_status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => handleOpenConfirm("suspend", selectedUser)}
                        className="w-full flex items-center justify-center gap-2 text-xs h-9 text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/60"
                      >
                        <Ban className="w-3.5 h-3.5 shrink-0" />
                        <span>Suspend Account</span>
                      </Button>
                    )}

                    {selectedUser.account_status === "SUSPENDED" && (
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => handleOpenConfirm("reactivate", selectedUser)}
                        className="w-full flex items-center justify-center gap-2 text-xs h-9 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Reactivate Account</span>
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>Akun Superadmin Anda saat ini (Proteksi aktif).</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
            ? "Revoke all active sessions?"
            : confirmModal.type === "resend_activation"
            ? "Generate new activation link?"
            : "Delete user account?"
        }
        description={
          confirmModal.targetUser ? (
            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="font-semibold text-[var(--text-primary)]">
                {confirmModal.targetUser.name} ({confirmModal.targetUser.email})
              </div>
              {confirmModal.type === "suspend" && (
                <p>
                  This will immediately prevent the user from signing in to MOVA.
                  All active refresh sessions and access tokens will be revoked.
                </p>
              )}
              {confirmModal.type === "reactivate" && (
                <p>
                  This will restore the user's ability to sign in to MOVA with their existing credentials.
                </p>
              )}
              {confirmModal.type === "revoke_sessions" && (
                <p>
                  This will force the user to sign in again on all devices and active browsers.
                </p>
              )}
              {confirmModal.type === "resend_activation" && (
                <p>
                  This will invalidate any previous activation tokens and generate a fresh 48-hour activation link.
                </p>
              )}
              {confirmModal.type === "delete" && (
                <p className="text-[var(--status-danger)]">
                  This action is permanent and cannot be undone. All assigned records will be orphaned or removed.
                </p>
              )}
            </div>
          ) : null
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
        targetUser={roleChangeModal.targetUser}
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

            <div className="flex items-center gap-2 p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] font-mono text-[11px]">
              <div className="relative flex-1">
                <input
                  type={activationLinkModal.showLink ? "text" : "password"}
                  readOnly
                  value={activationLinkModal.link}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] pl-2.5 pr-8 py-1.5 text-xs font-mono text-[var(--text-primary)] select-all"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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

export default UsersPage;
