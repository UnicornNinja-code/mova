<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Shield, Lock, Eye, EyeOff, ArrowRight, AlertTriangle } from 'lucide-svelte';
  import { authStore, getRoleLandingPath } from '../../lib/stores/auth.svelte';
  import { authService } from '../../services/authService';
  import { router } from '../../lib/stores/router.svelte';
  import MovaLoading from '../../components/ui/MovaLoading.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let newPassword = $state('');
  let confirmPassword = $state('');
  let showNew = $state(false);
  let showConfirm = $state(false);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  // Transition state activated ONLY after backend confirms password change
  let showTransition = $state(false);

  // Real-time debounce check state for confirm password (2s delay)
  let confirmTimer: any = null;
  let isCheckingConfirm = $state(false);
  let isConfirmMatch = $state<boolean | null>(null);

  const errors = $state<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  onMount(() => {
    // If not authenticated or already finished first login, guard and exit immediately
    if (!authStore.isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (authStore.user?.first_login === false) {
      const destination = getRoleLandingPath(authStore.user?.role);
      router.replace(destination);
      return;
    }
  });

  onDestroy(() => {
    if (confirmTimer) clearTimeout(confirmTimer);
  });

  // Debounced password check with 2 seconds delay
  const triggerDebouncedPasswordCheck = () => {
    if (confirmTimer) clearTimeout(confirmTimer);
    errors.confirmPassword = undefined;
    isConfirmMatch = null;

    if (!confirmPassword) {
      isCheckingConfirm = false;
      return;
    }

    isCheckingConfirm = true;
    confirmTimer = setTimeout(() => {
      isCheckingConfirm = false;
      if (confirmPassword) {
        if (newPassword !== confirmPassword) {
          errors.confirmPassword = 'Konfirmasi password tidak cocok';
          isConfirmMatch = false;
        } else {
          errors.confirmPassword = undefined;
          isConfirmMatch = true;
        }
      }
    }, 2000);
  };

  const handleConfirmInput = () => {
    triggerDebouncedPasswordCheck();
  };

  const handleNewPasswordInput = () => {
    if (confirmPassword) {
      triggerDebouncedPasswordCheck();
    }
  };

  // Password strength calculation
  const passwordStrength = $derived(() => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;

    if (score <= 1) return { score, label: 'Sangat Lemah', color: '#EF4444' };
    if (score === 2) return { score, label: 'Lemah', color: '#F97316' };
    if (score === 3) return { score, label: 'Cukup', color: '#EAB308' };
    if (score === 4) return { score, label: 'Kuat', color: '#22C55E' };
    return { score: 5, label: 'Sangat Kuat', color: '#10B981' };
  });

  const validate = () => {
    if (confirmTimer) clearTimeout(confirmTimer);
    isCheckingConfirm = false;

    errors.newPassword = undefined;
    errors.confirmPassword = undefined;
    let valid = true;

    if (!newPassword || newPassword.length < 8) {
      errors.newPassword = 'Password baru minimal 8 karakter';
      valid = false;
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Konfirmasi password tidak cocok';
      isConfirmMatch = false;
      valid = false;
    } else if (confirmPassword) {
      isConfirmMatch = true;
    }
    return valid;
  };

  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault();
    if (loading) return; // Prevent duplicate submissions
    if (!validate()) return;

    loading = true;
    errorMsg = null;

    try {
      // 1. Submit new password to backend first
      await authService.completeFirstLogin({ newPassword });

      // 2. Set transition flag
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mova_transition', 'true');
      }

      // 3. Update local auth state with confirmed first_login = false
      if (authStore.user && authStore.token) {
        const updatedUser = { ...authStore.user, first_login: false };
        authStore.login(updatedUser, authStore.token);
      }

      // 4. Directly replace history so /first-login is eliminated from back history
      const isSuperAdmin = authStore.user?.role === 'SUPERADMIN';
      const destination = isSuperAdmin ? '/first-setup' : getRoleLandingPath(authStore.user?.role);
      router.replace(destination);
    } catch (err: any) {
      errorMsg =
        err?.response?.data?.msg ||
        err?.message ||
        'Gagal memperbarui password. Silakan coba kembali.';
      loading = false;
    }
  };
</script>

<!-- ══════════════════════════════════════════════════════════ -->
<!-- FIRST LOGIN / FORCE CHANGE PASSWORD FORM                  -->
<!-- ══════════════════════════════════════════════════════════ -->
  <div class="min-h-screen bg-[#09090B] flex items-center justify-center px-4 py-10 font-outfit-400 relative overflow-hidden">
    <!-- Ambient glow -->
    <div class="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FF634A]/8 rounded-full blur-[160px] pointer-events-none"></div>
    <div class="fixed bottom-0 right-1/4 w-[400px] h-[300px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none"></div>

    <div class="w-full max-w-md relative z-10">
      <!-- Clean, minimal header without coffee icon -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
          <Shield class="w-3.5 h-3.5 text-amber-400" />
          <span class="text-xs font-outfit-600 text-amber-300">Aktivasi Keamanan Wajib</span>
        </div>
        <h1 class="text-2xl font-outfit-700 text-white leading-tight">
          Ubah password Lama Anda
        </h1>
        <p class="text-sm text-[#A1A1AA] mt-2 leading-relaxed">
          Untuk keamanan akun, Anda wajib mengganti password sementara<br class="hidden sm:block" /> sebelum mulai menggunakan sistem.
        </p>
      </div>

      <!-- Account Badge -->
      <div class="flex justify-center mb-6">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#18181D] border border-[#272730]">
          <div class="w-2 h-2 rounded-full bg-[#FF634A] animate-pulse"></div>
          <span class="text-xs text-[#A1A1AA]">Akun:</span>
          <span class="text-xs font-outfit-600 text-white">
            {authStore.user?.email || authStore.user?.username || 'Pengguna'}
          </span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#272730] text-[#A1A1AA]">
            {authStore.user?.role}
          </span>
        </div>
      </div>

      <!-- Form Card -->
      <div class="bg-[#131316]/95 backdrop-blur-xl rounded-3xl border border-[#24242A] p-6 sm:p-8 shadow-2xl">
        <form onsubmit={handleSubmit} class="space-y-5">
          <!-- Error Banner -->
          {#if errorMsg}
            <div class="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/40 flex items-start gap-2.5">
              <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p class="text-xs text-rose-200 leading-relaxed">{errorMsg}</p>
            </div>
          {/if}

          <!-- New Password Input -->
          <div class="space-y-1.5">
            <label for="first-login-new-pw" class="text-xs font-outfit-600 text-[#A1A1AA] uppercase tracking-wide">
              Password Baru
            </label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
              <input
                id="first-login-new-pw"
                type={showNew ? 'text' : 'password'}
                bind:value={newPassword}
                oninput={handleNewPasswordInput}
                placeholder="Minimal 8 karakter"
                disabled={loading}
                class="w-full pl-10 pr-10 py-3 bg-[#18181D] border {errors.newPassword ? 'border-rose-500/60' : 'border-[#272730]'} rounded-2xl text-sm text-white placeholder-[#52525B] focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onclick={() => (showNew = !showNew)}
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                aria-label="Toggle password visibility"
              >
                {#if showNew}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
              </button>
            </div>
            <!-- Password Strength Indicator -->
            {#if newPassword}
              <div class="flex items-center gap-2 pt-0.5">
                <div class="flex gap-1 flex-1">
                  {#each [1, 2, 3, 4, 5] as i}
                    <div
                      class="h-1 flex-1 rounded-full transition-all duration-300"
                      style="background-color: {i <= passwordStrength().score ? passwordStrength().color : '#272730'}"
                    ></div>
                  {/each}
                </div>
                <span class="text-[11px] font-outfit-600" style="color: {passwordStrength().color}">
                  {passwordStrength().label}
                </span>
              </div>
            {/if}
            {#if errors.newPassword}
              <p class="text-xs text-rose-400 pl-1">{errors.newPassword}</p>
            {/if}
          </div>

          <!-- Confirm Password Input -->
          <div class="space-y-1.5">
            <label for="first-login-confirm-pw" class="text-xs font-outfit-600 text-[#A1A1AA] uppercase tracking-wide">
              Konfirmasi Password Baru
            </label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
              <input
                id="first-login-confirm-pw"
                type={showConfirm ? 'text' : 'password'}
                bind:value={confirmPassword}
                oninput={handleConfirmInput}
                placeholder="Ulangi password baru"
                disabled={loading}
                class="w-full pl-10 pr-10 py-3 bg-[#18181D] border {errors.confirmPassword ? 'border-rose-500/60' : (isConfirmMatch ? 'border-emerald-500/40' : 'border-[#272730]')} rounded-2xl text-sm text-white placeholder-[#52525B] focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onclick={() => (showConfirm = !showConfirm)}
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                aria-label="Toggle confirm password visibility"
              >
                {#if showConfirm}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
              </button>
            </div>
            {#if isCheckingConfirm}
              <p class="text-xs text-zinc-400 pl-1 animate-pulse">Memeriksa kecocokan password...</p>
            {:else if errors.confirmPassword}
              <p class="text-xs text-rose-400 pl-1">{errors.confirmPassword}</p>
            {:else if isConfirmMatch && confirmPassword}
              <p class="text-xs text-emerald-400 pl-1">✓ Password cocok</p>
            {/if}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            disabled={loading}
            class="w-full py-3.5 rounded-2xl font-outfit-700 text-sm text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF634A]/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {#if loading}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Memvalidasi...</span>
            {:else}
              <span>Perbarui Password & Lanjutkan</span>
              <ArrowRight class="w-4 h-4" />
            {/if}
          </button>
        </form>
      </div>

      <!-- Security Notice -->
      <p class="text-center text-[11px] text-[#52525B] mt-5 leading-relaxed">
        🔒 Halaman ini wajib diselesaikan sebelum mengakses sistem.
      </p>
    </div>
  </div>
