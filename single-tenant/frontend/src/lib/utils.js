import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard className merger combining clsx condition logic and tailwind-merge conflict resolution.
 * Compatible with shadcn/ui component primitives.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Currency formatter (Indonesian Rupiah)
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Standard date formatter
 */
export function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Standard date-time formatter
 */
export function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
