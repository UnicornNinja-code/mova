<script lang="ts">
  import { X, UserPlus, UserCheck, CheckCircle2, Shield, Eye, EyeOff, Copy, Check, Send, Sparkles } from 'lucide-svelte';
  import { userService, type UserAccountItem } from '../../services/userService';
  import { authStore } from '../../lib/stores/auth.svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
    userToEdit?: UserAccountItem | null;
    onSuccess?: () => void;
  }

  let { open = false, onClose, userToEdit = null, onSuccess }: Props = $props();

  let name = $state('');
  let username = $state('');
  let email = $state('');
  let role = $state('RIDER');
  let password = $state('');
  let showPassword = $state(false);

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let invitationResult = $state<{ link: string; email: string; name: string } | null>(null);
  let linkCopied = $state(false);

  const isEditMode = $derived(!!userToEdit);

  $effect(() => {
    if (open) {
      errorMsg = null;
      invitationResult = null;
      linkCopied = false;
      if (userToEdit) {
        name = userToEdit.name || '';
        username = userToEdit.username || '';
        email = userToEdit.email || '';
        role = userToEdit.role || 'RIDER';
        password = '';
      } else {
        name = '';
        username = '';
        email = '';
        role = 'RIDER';
        password = '';
      }
    }
  });

  const copyInvitationLink = async () => {
    if (!invitationResult?.link) return;
    try {
      await navigator.clipboard.writeText(invitationResult.link);
      linkCopied = true;
      setTimeout(() => {
        linkCopied = false;
      }, 2500);
    } catch {
      // Fallback
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      errorMsg = 'Nama dan Email wajib diisi.';
      return;
    }

    submitting = true;
    errorMsg = null;

    try {
      if (isEditMode && userToEdit) {
        await userService.updateUser(userToEdit.id, {
          name: name.trim(),
          email: email.trim(),
          role,
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const res = await userService.createUser({
          name: name.trim(),
          username: username.trim() || email.split('@')[0],
          email: email.trim(),
          password: password || undefined,
          role,
        });

        if (res?.invitation_link) {
          invitationResult = {
            link: res.invitation_link,
            email: email.trim(),
            name: name.trim(),
          };
          if (onSuccess) onSuccess();
        } else {
          if (onSuccess) onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan data pengguna.';
    } finally {
      submitting = false;
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup modal form user"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-md bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/20">
            {#if isEditMode}
              <UserCheck class="w-5 h-5" />
            {:else}
              <UserPlus class="w-5 h-5" />
            {/if}
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">
              {isEditMode ? 'Edit Profil Pengguna' : 'Tambah Akun Pengguna Baru'}
            </h3>
            <p class="text-xs text-[#A1A1AA]">
              {isEditMode ? `ID Akun #${userToEdit?.id}` : 'Daftarkan akun operasional internal'}
            </p>
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

      {#if invitationResult}
        <div class="py-2 space-y-4 text-center">
          <div class="w-14 h-14 bg-emerald-950/40 border border-emerald-800/40 rounded-3xl flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/50">
            <CheckCircle2 class="w-7 h-7 stroke-[2.5]" />
          </div>

          <div class="space-y-1">
            <h3 class="font-outfit-600 text-base text-white">
              Akun Pengguna Berhasil Dibuat!
            </h3>
            <p class="text-xs text-[#A1A1AA] leading-relaxed">
              Email undangan & tautan verifikasi otomatis dikirimkan ke <strong class="text-zinc-200">{invitationResult.email}</strong>.
            </p>
          </div>

          <div class="p-3.5 bg-[#18181D] border border-[#2C2C36] rounded-2xl text-left space-y-2">
            <span class="text-[11px] text-zinc-400 font-semibold block">Tautan Aktivasi Akun (Berlaku 48 Jam):</span>
            <div class="flex items-center gap-2">
              <input
                type="text"
                readonly
                value={invitationResult.link}
                class="flex-1 px-2.5 py-1.5 bg-[#121215] border border-[#24242A] rounded-xl text-[11px] text-zinc-300 font-mono focus:outline-none select-all"
              />
              <button
                type="button"
                onclick={copyInvitationLink}
                class="px-3 py-1.5 rounded-xl bg-[#24242A] hover:bg-[#32323A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {#if linkCopied}
                  <Check class="w-3.5 h-3.5 text-emerald-400" />
                  <span class="text-emerald-400 text-[11px]">Tersalin!</span>
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                  <span class="text-[11px]">Salin</span>
                {/if}
              </button>
            </div>
            <p class="text-[10px] text-zinc-500">
              💡 Pengguna dapat langsung mengklik tautan tersebut untuk aktivasi instan dengan Akun Google atau membuat kata sandi.
            </p>
          </div>

          <div class="pt-2 border-t border-[#24242A]">
            <button
              type="button"
              onclick={onClose}
              class="w-full py-2.5 rounded-xl bg-[#FF634A] hover:bg-[#FF8573] text-[#09090B] text-xs font-outfit-600 font-bold transition-all cursor-pointer shadow-md"
            >
              Selesai & Tutup
            </button>
          </div>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-4 text-xs">
          <!-- Full Name -->
          <div class="space-y-1.5">
            <label for="form-user-name" class="block font-outfit-600 text-zinc-300">
              Nama Lengkap Personel <span class="text-[#FF634A]">*</span>
            </label>
            <input
              id="form-user-name"
              type="text"
              placeholder="Contoh: Doni Pratama"
              bind:value={name}
              required
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-400 focus:border-[#FF634A] focus:outline-none"
            />
          </div>

          <!-- Email -->
          <div class="space-y-1.5">
            <label for="form-user-email" class="block font-outfit-600 text-zinc-300">
              Alamat Email (Gmail / Kantor) <span class="text-[#FF634A]">*</span>
            </label>
            <input
              id="form-user-email"
              type="email"
              placeholder="Contoh: doni.rider@gmail.com"
              bind:value={email}
              required
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-400 focus:border-[#FF634A] focus:outline-none"
            />
            {#if !isEditMode}
              <p class="text-[10px] text-[#A1A1AA]">
                💡 Tautan aktivasi & verifikasi akun akan dikirimkan otomatis ke email ini.
              </p>
            {/if}
          </div>

          <!-- Role Selector -->
          <div class="space-y-1.5">
            <label for="form-user-role" class="block font-outfit-600 text-zinc-300 flex items-center gap-1.5">
              <Shield class="w-3.5 h-3.5 text-[#FF634A]" /> Peran Akun (Role) <span class="text-[#FF634A]">*</span>
            </label>
            <select
              id="form-user-role"
              bind:value={role}
              class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
            >
              {#if authStore.user?.role === 'SUPERADMIN'}
                <option value="SUPERADMIN">SUPERADMIN (Hak Akses Penuh Sistem)</option>
                <option value="MANAGEMENT">MANAGEMENT (Pengelola Akun & Armada Bisnis)</option>
              {:else if authStore.user?.role === 'MANAGEMENT'}
                <option value="MANAGEMENT">MANAGEMENT (Pengelola Akun & Armada Bisnis)</option>
              {/if}
              <option value="SUPERVISOR">SUPERVISOR (Komando Operasional & DSS)</option>
              <option value="RIDER">RIDER (Pelaksana Operasional Lapangan)</option>
            </select>
          </div>

          <!-- Username (Only in edit mode) -->
          {#if isEditMode}
            <div class="space-y-1.5">
              <label for="form-user-username" class="block font-outfit-600 text-zinc-300">
                Username Akun
              </label>
              <input
                id="form-user-username"
                type="text"
                bind:value={username}
                disabled
                class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-zinc-400 text-xs font-outfit-400 opacity-60"
              />
            </div>
          {/if}

          <!-- Actions -->
          <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3">
            <button
              type="button"
              onclick={onClose}
              class="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={submitting}
              class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50"
            >
              <span class="px-5 py-2 flex items-center gap-1.5 text-white font-bold">
                <CheckCircle2 class="w-4 h-4" />
                <span>{submitting ? 'Memproses...' : isEditMode ? 'Simpan Perubahan' : 'Buat & Kirim Undangan'}</span>
              </span>
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
