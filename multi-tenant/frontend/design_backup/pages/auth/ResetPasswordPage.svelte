<script lang="ts">
  import { onMount } from "svelte";
  import { authService } from "../../services/authService";
  import { Lock, CheckCircle2, ArrowRight, ArrowLeft, KeyRound, Check, ShieldCheck } from "lucide-svelte";
  import Button from "../../components/ui/Button.svelte";
  import Input from "../../components/ui/Input.svelte";
  import Alert from "../../components/ui/Alert.svelte";

  interface Props {
    onNavigate: (route: string) => void;
    tokenParam?: string | null;
  }

  let { onNavigate, tokenParam = null }: Props = $props();

  let token = $state<string | null>(null);
  let verifying = $state(true);
  let tokenValid = $state(false);

  let newPassword = $state("");
  let confirmPassword = $state("");

  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let loading = $state(false);

  let passwordError = $state<string | null>(null);
  let confirmError = $state<string | null>(null);

  // Real-time password validation indicators
  let hasMinLength = $derived(newPassword.length >= 8);
  let hasUppercase = $derived(/[A-Z]/.test(newPassword));
  let hasNumber = $derived(/[0-9]/.test(newPassword));
  let isMatching = $derived(newPassword.length > 0 && newPassword === confirmPassword);

  onMount(async () => {
    let currentToken = tokenParam;
    if (!currentToken) {
      const urlParams = new URLSearchParams(window.location.search);
      currentToken = urlParams.get("token");
    }

    if (!currentToken) {
      errorMsg = "Token reset kata sandi tidak ditemukan pada URL.";
      verifying = false;
      return;
    }

    token = currentToken;
    try {
      await authService.verifyResetToken(currentToken);
      tokenValid = true;
    } catch (err: any) {
      errorMsg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Token reset kata sandi tidak valid atau sudah kedaluwarsa.";
    } finally {
      verifying = false;
    }
  });

  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault();
    passwordError = null;
    confirmError = null;

    if (!newPassword || newPassword.length < 8) {
      passwordError = "Password minimal 8 karakter";
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      passwordError = "Password harus mengandung minimal 1 huruf besar (A-Z)";
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      passwordError = "Password harus mengandung minimal 1 angka (0-9)";
      return;
    }
    if (newPassword !== confirmPassword) {
      confirmError = "Konfirmasi password tidak cocok dengan password baru";
      return;
    }

    if (!token) {
      errorMsg = "Token reset tidak ditemukan.";
      return;
    }

    loading = true;
    errorMsg = null;

    try {
      await authService.resetPassword({ token, password: newPassword });
      successMsg = "Kata sandi Anda berhasil diperbarui. Mengarahkan ke halaman login...";
      setTimeout(() => onNavigate("/login"), 2000);
    } catch (err: any) {
      errorMsg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        err?.message ||
        "Gagal memperbarui kata sandi.";
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen bg-[#09090B] pattern-dots-dark relative flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6 lg:px-8 font-outfit-400 select-none overflow-x-hidden">
  <!-- Ambient Lighting Effects -->
  <div class="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[120px] pointer-events-none"></div>
  <div class="fixed bottom-10 right-10 w-72 h-72 bg-emerald-950/20 rounded-full blur-[90px] pointer-events-none"></div>

  <!-- Massive Typographic Background MOVA with Dark Blur (Outfit font) -->
  <div
    class="fixed inset-0 flex items-center justify-center select-none pointer-events-none z-0 overflow-hidden"
  >
    <span
      class="text-[14rem] sm:text-[20rem] md:text-[26rem] font-outfit-800 font-extrabold tracking-tighter text-white/[0.035] blur-[2px] leading-none select-none"
    >
      MOVA
    </span>
  </div>

  <div class="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
    <!-- Brand Header MOVA (Typography Outfit Text Only) -->
    <div class="text-center space-y-1 mb-7">
      <h1 class="text-3xl sm:text-4xl font-outfit-800 font-extrabold text-white tracking-tight">
        MOVA
      </h1>
      <p class="text-xs text-[#FF8573] font-outfit-600 tracking-wide">
        Move Where Demand Is.
      </p>
      <p class="text-[11px] text-[#71717A]">
        Setel Ulang Kata Sandi
      </p>
    </div>

    <!-- Main Card Container -->
    <div class="bg-[#131316]/95 backdrop-blur-xl py-7 px-6 sm:px-8 rounded-3xl border border-[#24242A] shadow-2xl space-y-5">
      {#if verifying}
        <div class="py-10 flex flex-col items-center justify-center space-y-3">
          <div class="w-9 h-9 border-3 border-[#FF634A] border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs text-[#A1A1AA] font-outfit-600">Memvalidasi token reset kata sandi...</span>
        </div>
      {:else}
        {#if successMsg}
          <Alert variant="success" title="Pembaruan Berhasil">
            {successMsg}
          </Alert>

          <Button
            type="button"
            onclick={() => onNavigate("/login")}
            variant="primary"
            size="md"
            class="w-full py-3.5 font-outfit-600"
            rightIcon={ArrowRight}
          >
            Masuk Sekarang
          </Button>
        {/if}

        {#if errorMsg}
          <Alert variant="danger" title="Kendala Validasi">
            {errorMsg}
          </Alert>
        {/if}

        {#if tokenValid && !successMsg}
          <form onsubmit={handleSubmit} class="space-y-4">
            <Input
              label="Kata Sandi Baru"
              type="password"
              leftIcon={Lock}
              placeholder="••••••••"
              required
              error={passwordError}
              bind:value={newPassword}
            />

            <Input
              label="Konfirmasi Kata Sandi Baru"
              type="password"
              leftIcon={KeyRound}
              placeholder="••••••••"
              required
              error={confirmError}
              bind:value={confirmPassword}
            />

            <!-- Real-time Password Strength Requirements Checklist -->
            <div class="p-3 bg-[#1A1A1F] rounded-2xl border border-[#272730] space-y-1.5 text-[11px]">
              <div class="font-outfit-600 text-[#A1A1AA] mb-1">Ketentuan Keamanan Sandi:</div>
              <div class="grid grid-cols-2 gap-1.5">
                <div class="flex items-center gap-1.5 {hasMinLength ? 'text-emerald-400 font-semibold' : 'text-[#71717A]'}">
                  {#if hasMinLength}<Check class="w-3.5 h-3.5" />{:else}<span class="w-1.5 h-1.5 rounded-full bg-[#52525B]"></span>{/if}
                  <span>Minimal 8 Karakter</span>
                </div>
                <div class="flex items-center gap-1.5 {hasUppercase ? 'text-emerald-400 font-semibold' : 'text-[#71717A]'}">
                  {#if hasUppercase}<Check class="w-3.5 h-3.5" />{:else}<span class="w-1.5 h-1.5 rounded-full bg-[#52525B]"></span>{/if}
                  <span>Huruf Besar (A-Z)</span>
                </div>
                <div class="flex items-center gap-1.5 {hasNumber ? 'text-emerald-400 font-semibold' : 'text-[#71717A]'}">
                  {#if hasNumber}<Check class="w-3.5 h-3.5" />{:else}<span class="w-1.5 h-1.5 rounded-full bg-[#52525B]"></span>{/if}
                  <span>Mengandung Angka</span>
                </div>
                <div class="flex items-center gap-1.5 {isMatching ? 'text-emerald-400 font-semibold' : 'text-[#71717A]'}">
                  {#if isMatching}<Check class="w-3.5 h-3.5" />{:else}<span class="w-1.5 h-1.5 rounded-full bg-[#52525B]"></span>{/if}
                  <span>Sandi Cocok</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isPending={loading}
              class="w-full py-3.5 font-outfit-600"
              rightIcon={ArrowRight}
            >
              {loading ? "Menyimpan Kata Sandi..." : "Perbarui Kata Sandi"}
            </Button>
          </form>
        {/if}

        <div class="pt-2 border-t border-[#24242A] text-center">
          <button
            type="button"
            onclick={() => onNavigate("/login")}
            class="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-white font-outfit-600 transition-colors cursor-pointer py-1"
          >
            <ArrowLeft class="w-3.5 h-3.5 text-[#FF634A]" /> Kembali ke Halaman Masuk
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
