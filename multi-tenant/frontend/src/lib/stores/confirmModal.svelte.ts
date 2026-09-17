/*
 * confirmModal.svelte.ts
 * Svelte 5 Reactive Store for Programmatic Step Verification Modal
 */

import type { VerificationModalOptions, VerificationContextType } from '../types/verificationModal.types';

class ConfirmModalStore {
  isOpen = $state(false);
  options = $state<VerificationModalOptions>({
    context: 'CUSTOM',
    title: '',
    subtitle: '',
    targetName: '',
  });
  loading = $state(false);
  errorMsg = $state<string | null>(null);

  private resolver: ((value: boolean) => void) | null = null;

  /**
   * Programmatic invocation that returns a Promise<boolean>
   */
  verify(opts: VerificationModalOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.options = { ...opts };
      this.errorMsg = null;
      this.loading = false;
      this.isOpen = true;
    });
  }

  /**
   * Handle confirmation action
   */
  async confirm() {
    if (this.options.onConfirm) {
      this.loading = true;
      this.errorMsg = null;
      try {
        await this.options.onConfirm();
        this.close(true);
      } catch (err: any) {
        this.errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengeksekusi tindakan. Silakan coba lagi.';
      } finally {
        this.loading = false;
      }
    } else {
      this.close(true);
    }
  }

  /**
   * Cancel and close modal
   */
  cancel() {
    if (this.options.onCancel) {
      this.options.onCancel();
    }
    this.close(false);
  }

  private close(result: boolean) {
    this.isOpen = false;
    if (this.resolver) {
      this.resolver(result);
      this.resolver = null;
    }
  }
}

export const confirmModal = new ConfirmModalStore();
