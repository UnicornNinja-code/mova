<script lang="ts">
  import { X, Key, Copy, Check, CheckCircle2 } from 'lucide-svelte';
  import { userService, type UserAccountItem } from '../../services/userService';

  interface Props {
    open: boolean;
    onClose: () => void;
    user: UserAccountItem | null;
    onSuccess?: () => void;
  }

  let { open = false, onClose, user, onSuccess }: Props = $props();

  let tempPassword = $state('');
  let submitting = $state(false);
  let copied = $state(false);
  let errorMsg = $state<string | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'CZS-2026-';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    tempPassword = pass;
  };

  $effect(() => {
    if (open) {
      generateRandomPassword();
      copied = false;
      errorMsg = null;
    }
  });

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      copied = true;
      setTimeout(() => (copied = false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyReset = async () => {
    if (!user || !tempPassword) return;
    submitting = true;
    errorMsg = null;
    try {
      await userService.resetPassword(user.id, tempPassword);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mereset password pengguna.';
    } finally {
      submitting = false;
    }
  };
</script>

{#if open && user}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup modal reset password"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-md bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-400 flex items-center justify-center shadow-md">
            <Key class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Reset Password Akun</h3>
            <p class="text-xs text-[#A1A1AA]">{user.name} (@{user.username})</p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if errorMsg}
        <div class="p-3 bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs rounded-2xl">
          {errorMsg}
        </div>
      {/if}

      <!-- Password generator box -->
      <div class="space-y-3">
        <label for="input-temp-password" class="block text-xs font-outfit-600 text-zinc-300">
          Password Sementara Baru:
        </label>

        <div class="flex items-center gap-2">
          <input
            id="input-temp-password"
            type="text"
            bind:value={tempPassword}
            class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white font-mono text-xs sm:text-sm font-bold tracking-wider focus:border-[#FF634A] focus:outline-none"
          />

          <button
            type="button"
            onclick={handleCopyPassword}
            class="px-3.5 py-2.5 rounded-2xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-200 border border-[#2E2E38] text-xs font-outfit-600 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            {#if copied}
              <Check class="w-4 h-4 text-emerald-400" />
              <span class="text-emerald-400">Tersalin</span>
            {:else}
              <Copy class="w-4 h-4 text-[#FF634A]" />
              <span>Salin</span>
            {/if}
          </button>
        </div>

        <div class="flex items-center justify-between text-[11px] text-[#71717A]">
          <span>Password otomatis di-generate</span>
          <button
            type="button"
            onclick={generateRandomPassword}
            class="text-[#FF634A] hover:underline cursor-pointer"
          >
            Generate Ulang
          </button>
        </div>

        <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] text-[11px] text-[#A1A1AA] leading-relaxed">
          💡 Seluruh sesi login aktif pengguna ini akan otomatis dicabut (*session revoked*). Berikan kata sandi ini kepada pengguna secara aman.
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3">
        <button
          type="button"
          onclick={onClose}
          class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
        >
          Batal
        </button>

        <button
          type="button"
          onclick={handleApplyReset}
          disabled={submitting}
          class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50"
        >
          <span class="px-5 py-2 flex items-center gap-1.5 text-white font-bold">
            <CheckCircle2 class="w-4 h-4" />
            <span>{submitting ? 'Mereset Sandi...' : 'Terapkan Reset'}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
{/if}
