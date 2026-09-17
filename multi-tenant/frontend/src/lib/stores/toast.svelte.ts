/*
 * toast.svelte.ts
 * Pure Svelte 5 Runes ($state) Global Toast Notification Store
 */

export interface ToastItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
  title?: string;
}

class ToastStore {
  toasts = $state<ToastItem[]>([]);

  show(type: "success" | "error" | "info" | "warning", message: string, duration = 4000, title?: string) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = {
      id,
      type,
      message,
      duration,
      title,
    };

    this.toasts = [...this.toasts, newToast];

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  success(message: string, duration = 4000, title?: string) {
    return this.show("success", message, duration, title);
  }

  error(message: string, duration = 5000, title?: string) {
    return this.show("error", message, duration, title);
  }

  info(message: string, duration = 4000, title?: string) {
    return this.show("info", message, duration, title);
  }

  warning(message: string, duration = 4500, title?: string) {
    return this.show("warning", message, duration, title);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clear() {
    this.toasts = [];
  }
}

export const toast = new ToastStore();
