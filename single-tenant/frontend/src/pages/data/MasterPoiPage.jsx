import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Badge,
  Spinner,
  Alert,
} from "@/components/primitives";
import { DataTable, ConfirmDialog } from "@/components/composites";
import {
  Layers,
  Plus,
  RefreshCw,
  UploadCloud,
  Search,
  MapPin,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  Database,
  CheckCircle2,
  RotateCw,
  RotateCcw,
  Globe,
  User,
} from "lucide-react";
import { poiService } from "@/services/poiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { formatDate } from "@/lib/formatters";
import { PoiHealthControlPanel } from "./components/PoiHealthControlPanel";
import { PoiDetailModal } from "./components/PoiDetailModal";
import { PoiCategoryBadge } from "./components/PoiCategoryIcon";
import { PoiFormModal } from "./components/PoiFormModal";
import { PoiBulkModal } from "./components/PoiBulkModal";

export function MasterPoiPage() {
  const currentAuthUser = useAuthStore((state) => state.user);
  const canManage = ["SUPERADMIN", "SUPERVISOR"].includes(currentAuthUser?.role);
  const isSuperadmin = currentAuthUser?.role === "SUPERADMIN";

  // Data States
  const [pois, setPois] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Search, Filter & Sort States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Detail Modal States
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState(null);

  // Form Modal States
  const [formModal, setFormModal] = useState({
    isOpen: false,
    poiToEdit: null,
    loading: false,
  });

  // Bulk Modal States
  const [bulkModal, setBulkModal] = useState({
    isOpen: false,
    loading: false,
  });

  // Confirm Dialog States
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: null,
    targetPoi: null,
    loading: false,
  });

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poisData, categoriesData, statsData] = await Promise.all([
        poiService.getPois(),
        poiService.getCategories(),
        poiService.getPoiStats().catch(() => null),
      ]);

      setPois(Array.isArray(poisData) ? poisData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      if (statsData) setStats(statsData);
    } catch (err) {
      console.error("Error loading POI data:", err);
      setError(err.response?.data?.message || err.message || "Gagal memuat data Master POI.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show temporary toast/notification
  const notify = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper for Data Source info & badge
  const getSourceMeta = useCallback((poi) => {
    const src = poi.metadata?.source;
    if (src === "OVERPASS_API" || poi.external_id?.startsWith("osm:")) {
      return {
        label: "OpenStreetMap",
        icon: Globe,
        badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
      };
    }
    if (src === "MANUAL_ENTRY" || poi.external_id?.startsWith("manual:")) {
      return {
        label: "Manual Input",
        icon: User,
        badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      };
    }
    if (src === "MANUAL_BULK_UPLOAD") {
      return {
        label: "Bulk Upload",
        icon: UploadCloud,
        badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
      };
    }
    return {
      label: "Sistem",
      icon: Database,
      badgeClass: "bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
    };
  }, []);

  // Filter Active State Check
  const isFilterActive = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      selectedCategory !== "ALL" ||
      selectedStatus !== "ALL" ||
      sortBy !== null
    );
  }, [searchTerm, selectedCategory, selectedStatus, sortBy]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setSortBy(null);
    setSortDirection("asc");
    setCurrentPage(1);
  };

  // Handle Sort Toggle
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortBy(null);
        setSortDirection("asc");
      }
    } else {
      setSortBy(columnKey);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Filtered and Sorted Data
  const processedPois = useMemo(() => {
    let result = pois.filter((poi) => {
      // Category filter
      if (selectedCategory !== "ALL" && poi.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "ELIGIBLE" && poi.operational_status !== "ELIGIBLE") return false;
        if (selectedStatus === "EXCLUDED" && poi.operational_status !== "EXCLUDED") return false;
        if (selectedStatus === "PENDING" && poi.status !== "PENDING") return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = (poi.name || "").toLowerCase().includes(query);
        const matchCategory = (poi.category || "").toLowerCase().includes(query);
        const matchSource = (poi.metadata?.source || poi.external_id || "").toLowerCase().includes(query);
        return matchName || matchCategory || matchSource;
      }

      return true;
    });

    // Sorting
    if (sortBy) {
      result = [...result].sort((a, b) => {
        let valA = "";
        let valB = "";

        if (sortBy === "name") {
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
        } else if (sortBy === "category") {
          valA = (a.category || "").toLowerCase();
          valB = (b.category || "").toLowerCase();
        } else if (sortBy === "operational_status") {
          valA = (a.operational_status || a.status || "").toLowerCase();
          valB = (b.operational_status || b.status || "").toLowerCase();
        } else if (sortBy === "source") {
          valA = getSourceMeta(a).label.toLowerCase();
          valB = getSourceMeta(b).label.toLowerCase();
        } else if (sortBy === "updated_at") {
          valA = new Date(a.updated_at || a.created_at || 0).getTime();
          valB = new Date(b.updated_at || b.created_at || 0).getTime();
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [pois, selectedCategory, selectedStatus, searchTerm, sortBy, sortDirection, getSourceMeta]);

  // Handlers
  const handleOpenDetail = (poi) => {
    setSelectedPoi(poi);
    setDetailModalOpen(true);
  };

  const handleOpenCreate = () => {
    setFormModal({ isOpen: true, poiToEdit: null, loading: false });
  };

  const handleOpenEdit = (poi) => {
    setDetailModalOpen(false);
    setFormModal({ isOpen: true, poiToEdit: poi, loading: false });
  };

  const handleFormSubmit = async (payload, poiId) => {
    setFormModal((prev) => ({ ...prev, loading: true }));
    try {
      if (poiId) {
        const updated = await poiService.updatePoi(poiId, payload);
        setPois((prev) => prev.map((p) => (p.id === poiId ? { ...p, ...updated } : p)));
        notify(`POI '${updated.name}' berhasil diperbarui.`);
      } else {
        const created = await poiService.createPoi(payload);
        setPois((prev) => [created, ...prev]);
        notify(`POI '${created.name}' berhasil didaftarkan.`);
      }
      setFormModal({ isOpen: false, poiToEdit: null, loading: false });
    } catch (err) {
      setFormModal((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  };

  const handleOpenDelete = (poi) => {
    setDetailModalOpen(false);
    setConfirmDialog({
      isOpen: true,
      type: "delete",
      targetPoi: poi,
      loading: false,
    });
  };

  const handleConfirmAction = async () => {
    const { type, targetPoi } = confirmDialog;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));

    try {
      if (type === "delete" && targetPoi) {
        await poiService.deletePoi(targetPoi.id);
        setPois((prev) => prev.filter((p) => p.id !== targetPoi.id));
        notify(`POI '${targetPoi.name}' berhasil dihapus.`);
      } else if (type === "sync_osm") {
        const res = await poiService.syncOverpassPois();
        await loadData();
        notify(`Sinkronisasi Overpass OSM selesai (${res?.count || 0} POI diproses).`);
      } else if (type === "recluster") {
        const res = await poiService.reclusterPois();
        await loadData();
        notify(`Pengelompokan ulang POI selesai (${res?.updatedCount || 0} kategori diperbarui).`);
      }
      setConfirmDialog({ isOpen: false, type: null, targetPoi: null, loading: false });
    } catch (err) {
      console.error("Action error:", err);
      notify(err.response?.data?.message || err.message || "Aksi gagal dijalankan.", "error");
      setConfirmDialog({ isOpen: false, type: null, targetPoi: null, loading: false });
    }
  };

  const handleBulkSubmit = async (bulkItems) => {
    setBulkModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await poiService.bulkCreatePois(bulkItems);
      await loadData();
      setBulkModal({ isOpen: false, loading: false });
      notify(`Bulk import selesai: ${res?.total_saved || bulkItems.length} POI berhasil disinkronkan.`);
    } catch (err) {
      setBulkModal((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  };

  // Approval handlers
  const handleApprovePoi = async (poi) => {
    try {
      await poiService.approveOrRejectPoi(poi.id, "APPROVED");
      setPois((prev) =>
        prev.map((p) => (p.id === poi.id ? { ...p, status: "APPROVED", approval_status: "APPROVED" } : p))
      );
      setDetailModalOpen(false);
      notify(`POI '${poi.name}' telah disetujui.`);
    } catch (err) {
      notify(err.message || "Gagal menyetujui POI.", "error");
    }
  };

  const handleRejectPoi = async (poi) => {
    try {
      await poiService.approveOrRejectPoi(poi.id, "REJECTED");
      setPois((prev) =>
        prev.map((p) => (p.id === poi.id ? { ...p, status: "REJECTED", approval_status: "REJECTED" } : p))
      );
      setDetailModalOpen(false);
      notify(`POI '${poi.name}' telah ditolak.`);
    } catch (err) {
      notify(err.message || "Gagal menolak POI.", "error");
    }
  };

  // Table Columns Definition with sorting enabled
  const columns = [
    {
      header: "NAMA POI",
      accessor: "name",
      sortable: true,
      headerClassName: "w-[280px]",
      render: (row) => (
        <div className="flex flex-col py-0.5">
          <span
            className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(row);
            }}
          >
            {row.name}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {row.latitude?.toFixed(4)}, {row.longitude?.toFixed(4)}
          </span>
        </div>
      ),
    },
    {
      header: "KATEGORI",
      accessor: "category",
      sortable: true,
      headerClassName: "w-[220px]",
      render: (row) => <PoiCategoryBadge category={row.category} />,
    },
    {
      header: "STATUS",
      accessor: "operational_status",
      sortable: true,
      headerClassName: "w-[120px]",
      render: (row) => {
        const isEligible = row.operational_status === "ELIGIBLE" && row.status === "APPROVED";
        const isPending = row.status === "PENDING" || row.approval_status === "PENDING";
        return (
          <Badge
            variant={isEligible ? "success" : isPending ? "warning" : "neutral"}
            className="text-[11px] font-medium"
          >
            {isEligible ? "Eligible" : isPending ? "Pending" : row.operational_status || row.status}
          </Badge>
        );
      },
    },
    {
      header: "SUMBER DATA",
      accessor: "source",
      sortable: true,
      headerClassName: "w-[160px]",
      render: (row) => {
        const sourceMeta = getSourceMeta(row);
        const SourceIcon = sourceMeta.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium border ${sourceMeta.badgeClass} shadow-2xs`}
          >
            <SourceIcon className="w-3 h-3 shrink-0" />
            <span>{sourceMeta.label}</span>
          </span>
        );
      },
    },
    {
      header: "DIPERBARUI",
      accessor: "updated_at",
      sortable: true,
      headerClassName: "w-[140px]",
      render: (row) => (
        <span className="text-xs text-[var(--text-secondary)] font-mono">
          {formatDate(row.updated_at || row.created_at)}
        </span>
      ),
    },
    {
      header: "AKSI",
      id: "actions",
      headerClassName: "w-[130px] text-right",
      cellClassName: "text-right",
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Detail Shortcut */}
          <button
            onClick={() => handleOpenDetail(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--surface-raised)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
            title="Lihat Detail Lengkap POI"
          >
            <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Detail</span>
          </button>

          {canManage && (
            <>
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
                title="Edit POI"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleOpenDelete(row)}
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--status-danger)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
                title="Hapus POI"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4">
          <Alert variant={notification.type === "error" ? "danger" : "success"} className="shadow-xl">
            {notification.type === "error" ? (
              <AlertCircle className="w-4 h-4 mr-2 inline" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2 inline" />
            )}
            {notification.message}
          </Alert>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
            Master POI
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-normal">
            Manage and monitor points of interest used by MOVA
          </p>

          {/* KPI Micro-Badges summary */}
          {stats?.summary && (
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] shadow-xs">
                <Layers className="w-3 h-3 text-[var(--text-muted)]" />
                <strong className="text-[var(--text-primary)] font-semibold">{stats.summary.total_pois || pois.length}</strong>
                <span className="text-[10px] text-[var(--text-muted)]">Total POI</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <strong className="font-semibold text-emerald-800 dark:text-emerald-300">{stats.summary.valid_count || 0}</strong>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Valid & Eligible</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-sky-500/10 border border-sky-500/25 text-[11px] font-mono text-sky-700 dark:text-sky-400 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <strong className="font-semibold text-sky-800 dark:text-sky-300">{categories.length || stats.summary.total_categories}</strong>
                <span className="text-[10px] text-sky-600/80 dark:text-sky-400/80">Kategori</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] bg-amber-500/10 border border-amber-500/25 text-[11px] font-mono text-amber-700 dark:text-amber-400 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full border border-amber-400" />
                <strong className="font-semibold text-amber-800 dark:text-amber-300">{stats.summary.pending_count || 0}</strong>
                <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">Pending</span>
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs h-9"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canManage && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkModal({ isOpen: true, loading: false })}
                disabled={loading}
                className="gap-1.5 text-xs h-9"
              >
                <UploadCloud className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Bulk Import
              </Button>

              {isSuperadmin && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setConfirmDialog({
                        isOpen: true,
                        type: "recluster",
                        targetPoi: null,
                        loading: false,
                      })
                    }
                    disabled={loading}
                    className="gap-1.5 text-xs h-9"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Re-cluster
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setConfirmDialog({
                        isOpen: true,
                        type: "sync_osm",
                        targetPoi: null,
                        loading: false,
                      })
                    }
                    disabled={loading}
                    className="gap-1.5 text-xs h-9"
                  >
                    <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Sync Overpass
                  </Button>
                </>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreate}
                disabled={loading}
                className="gap-1.5 text-xs h-9 px-3.5"
              >
                <Plus className="w-4 h-4" />
                Tambah POI
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Master Data Health & Overview Control Layer */}
      <PoiHealthControlPanel
        stats={stats}
        poisCount={pois.length}
        categoriesCount={categories.length}
        loading={loading}
      />

      {/* Filter and Search Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
          <Input
            type="text"
            placeholder="Cari nama POI, kategori, atau sumber..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 text-xs h-9"
          />
        </div>

        {/* Filter Dropdowns and Reset Button */}
        <div className="w-[190px]">
          <Select
            value={selectedCategory}
            onValueChange={(val) => {
              setSelectedCategory(val);
              setCurrentPage(1);
            }}
            placeholder="Semua Kategori"
          >
            <SelectItem value="ALL">Semua Kategori</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id || cat.name} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="w-[150px]">
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            placeholder="Semua Status"
          >
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="ELIGIBLE">Eligible</SelectItem>
            <SelectItem value="EXCLUDED">Excluded</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </Select>
        </div>

        {/* Reset Filter Button */}
        {isFilterActive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 px-3 text-xs gap-1.5 text-[var(--accent-primary)] hover:text-[var(--text-primary)]"
            title="Kembalikan semua filter dan urutan ke awal"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filter
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="text-xs">
          <AlertCircle className="w-4 h-4 mr-2 inline" />
          {error}
          <Button
            size="sm"
            variant="secondary"
            onClick={loadData}
            className="ml-4 py-0.5 px-2 text-xs"
          >
            Coba Lagi
          </Button>
        </Alert>
      )}

      {/* Table Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)]">
          <Spinner size="lg" label="Memuat Master Data POI..." />
        </div>
      ) : processedPois.length === 0 ? (
        <div className="text-center py-20 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-3">
          <Layers className="w-12 h-12 text-[var(--text-muted)] mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isFilterActive
              ? "Tidak ada POI yang cocok dengan filter"
              : "Belum ada data POI tersimpan"}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isFilterActive
              ? "Coba ubah kata kunci pencarian atau tekan tombol Reset Filter untuk melihat semua POI."
              : "Gunakan tombol Tambah POI atau Sync Overpass untuk mengisi data."}
          </p>
          {isFilterActive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleResetFilters}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Semua Filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)] overflow-hidden">
            <DataTable
              columns={columns}
              data={processedPois.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={handleSort}
              onRowClick={handleOpenDetail}
            />
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] px-1">
            <span>
              Menampilkan{" "}
              <strong className="text-[var(--text-primary)] font-semibold">
                {Math.min(processedPois.length, (currentPage - 1) * pageSize + 1)} -{" "}
                {Math.min(processedPois.length, currentPage * pageSize)}
              </strong>{" "}
              dari <strong className="text-[var(--text-primary)] font-semibold">{processedPois.length}</strong> total POI
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="text-xs h-8 px-2.5"
              >
                Sebelumnya
              </Button>
              <span className="px-2.5 py-1 text-[var(--text-primary)] font-mono font-medium">
                {currentPage} / {Math.ceil(processedPois.length / pageSize) || 1}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= Math.ceil(processedPois.length / pageSize)}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="text-xs h-8 px-2.5"
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Detail Modal */}
      <PoiDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        poi={selectedPoi}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onApprove={handleApprovePoi}
        onReject={handleRejectPoi}
        canManage={canManage}
      />

      {/* Create / Edit Form Modal */}
      <PoiFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, poiToEdit: null, loading: false })}
        onSubmit={handleFormSubmit}
        poiToEdit={formModal.poiToEdit}
        categories={categories}
        loading={formModal.loading}
      />

      {/* Bulk Upload Modal */}
      <PoiBulkModal
        isOpen={bulkModal.isOpen}
        onClose={() => setBulkModal({ isOpen: false, loading: false })}
        onSubmit={handleBulkSubmit}
        loading={bulkModal.loading}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        title={
          confirmDialog.type === "delete"
            ? "Konfirmasi Hapus POI"
            : confirmDialog.type === "sync_osm"
            ? "Konfirmasi Sinkronisasi Overpass OSM"
            : "Konfirmasi Re-cluster POI"
        }
        description={
          confirmDialog.type === "delete"
            ? `Apakah Anda yakin ingin menghapus POI '${confirmDialog.targetPoi?.name}'? Tindakan ini tidak dapat dibatalkan.`
            : confirmDialog.type === "sync_osm"
            ? "Sinkronisasi Overpass akan mengunduh data POI terbaru dari OpenStreetMap untuk wilayah Sidoarjo. Proses ini mungkin memakan waktu beberapa detik."
            : "Proses re-cluster akan memetakan ulang seluruh POI di database ke dalam 59 kategori keramaian resmi tanpa memanggil API eksternal."
        }
        confirmText={
          confirmDialog.type === "delete"
            ? "Hapus POI"
            : confirmDialog.type === "sync_osm"
            ? "Mulai Sinkronisasi"
            : "Jalankan Re-cluster"
        }
        confirmVariant={confirmDialog.type === "delete" ? "danger" : "primary"}
        onConfirm={handleConfirmAction}
        loading={confirmDialog.loading}
      />
    </div>
  );
}
