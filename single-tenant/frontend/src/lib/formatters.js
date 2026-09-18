/**
 * formatters.js
 * Standardized data presentation helpers for MOVA
 */

export function formatRupiah(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Rp0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined || Number.isNaN(Number(meters))) {
    return "0 m";
  }
  const m = Number(meters);
  if (m >= 1000) {
    return `${(m / 1000).toFixed(2)} km`;
  }
  return `${Math.round(m)} m`;
}

export function formatDateTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatPercentage(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) {
    return "0%";
  }
  return `${(Number(ratio) * 100).toFixed(1)}%`;
}

export function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatRelativeTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(isoString);
}

export const ROLE_LABELS = {
  SUPERADMIN: "Super Admin",
  MANAGEMENT: "Manager",
  SUPERVISOR: "Supervisor",
  RIDER: "Rider",
};

export const ROLE_CONFIGS = {
  SUPERADMIN: {
    label: "Super Admin",
    shortLabel: "Super Admin",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    dotClass: "bg-purple-500",
  },
  MANAGEMENT: {
    label: "Manager",
    shortLabel: "Manager",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    dotClass: "bg-blue-500",
  },
  SUPERVISOR: {
    label: "Supervisor",
    shortLabel: "Supervisor",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  RIDER: {
    label: "Rider",
    shortLabel: "Rider",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    dotClass: "bg-sky-500",
  },
};

export function formatRoleName(role) {
  if (!role) return "—";
  const upper = String(role).toUpperCase();
  return ROLE_LABELS[upper] || role;
}

export function getRoleConfig(role) {
  if (!role) {
    return {
      label: "—",
      shortLabel: "—",
      badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      dotClass: "bg-zinc-400",
    };
  }
  const upper = String(role).toUpperCase();
  return (
    ROLE_CONFIGS[upper] || {
      label: role,
      shortLabel: role,
      badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      dotClass: "bg-zinc-400",
    }
  );
}
