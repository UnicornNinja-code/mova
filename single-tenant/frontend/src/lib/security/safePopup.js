/**
 * safePopup.js
 * Safe DOM Node builder for Leaflet Popup and Tooltips.
 * Eliminates DOM XSS by constructing real HTML DOM text nodes rather than string interpolation.
 */

import { sanitizeText } from "./sanitizer";

/**
 * Creates a secure HTMLElement for Leaflet marker popups.
 * @param {object} options
 * @param {string} options.title - Header / POI / Zone name
 * @param {string} options.subtitle - Category / Zone code
 * @param {Array<{ label: string, value: string|number }>} options.fields - Key-value details
 * @param {Array<{ label: string, onClick: Function, variant?: string }>} options.actions - Action buttons
 * @returns {HTMLElement} Safe DOM element ready for marker.bindPopup(element)
 */
export function createSafePopupContent({
  title,
  subtitle,
  fields = [],
  actions = [],
  statusBadge = null,
}) {
  const container = document.createElement("div");
  container.className = "mova-safe-popup p-3 text-sm text-[var(--text-primary)] font-sans max-w-[280px]";

  // Title section
  if (title) {
    const titleEl = document.createElement("h4");
    titleEl.className = "font-semibold text-base text-[var(--text-primary)] leading-tight mb-1 truncate";
    titleEl.textContent = sanitizeText(title);
    container.appendChild(titleEl);
  }

  // Subtitle / Status Badge
  if (subtitle || statusBadge) {
    const metaRow = document.createElement("div");
    metaRow.className = "flex items-center gap-2 mb-2";

    if (subtitle) {
      const subEl = document.createElement("span");
      subEl.className = "text-xs text-[var(--text-secondary)] font-medium";
      subEl.textContent = sanitizeText(subtitle);
      metaRow.appendChild(subEl);
    }

    if (statusBadge) {
      const badgeEl = document.createElement("span");
      badgeEl.className =
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)]";
      badgeEl.textContent = sanitizeText(statusBadge);
      metaRow.appendChild(badgeEl);
    }

    container.appendChild(metaRow);
  }

  // Key-Value fields table
  if (fields.length > 0) {
    const dl = document.createElement("div");
    dl.className = "grid grid-cols-2 gap-x-2 gap-y-1 my-2 text-xs border-t border-[var(--border-subtle)] pt-2";

    for (const field of fields) {
      const dt = document.createElement("span");
      dt.className = "text-[var(--text-muted)]";
      dt.textContent = sanitizeText(field.label);

      const dd = document.createElement("span");
      dd.className = "text-[var(--text-primary)] font-mono font-medium text-right truncate";
      dd.textContent = sanitizeText(String(field.value ?? "-"));

      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    container.appendChild(dl);
  }

  // Action buttons
  if (actions.length > 0) {
    const actionsRow = document.createElement("div");
    actionsRow.className = "flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border-subtle)]";

    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer " +
        (action.variant === "danger"
          ? "border-[var(--status-danger)] text-[var(--status-danger)] hover:bg-[var(--status-danger)] hover:text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]");
      btn.textContent = sanitizeText(action.label);

      if (typeof action.onClick === "function") {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          action.onClick();
        });
      }

      actionsRow.appendChild(btn);
    }

    container.appendChild(actionsRow);
  }

  return container;
}
