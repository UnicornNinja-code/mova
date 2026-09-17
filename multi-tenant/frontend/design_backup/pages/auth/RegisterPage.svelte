<script lang="ts">
  import { onMount } from "svelte";
  import { authService } from "../../services/authService";
  import { authStore, getRoleLandingPath } from "../../lib/stores/auth.svelte";
  import { Coffee, User, Lock, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, KeyRound, Check, Sparkles, MailCheck, Shield, ShieldAlert, Mail } from "lucide-svelte";
  import Button from "../../components/ui/Button.svelte";
  import Input from "../../components/ui/Input.svelte";
  import Alert from "../../components/ui/Alert.svelte";

  interface Props {
    onNavigate: (route: string) => void;
    tokenParam?: string | null;
  }

  let { onNavigate, tokenParam = null }: Props = $props();

  let token = $state<string | null>(null);
  let verifyingToken = $state(false);
  let tokenValid = $state(false);

  let verifiedEmail = $state<string>("");
  let verifiedName = $state<string>("");
  let verifiedRole = $state<string>("RIDER");

  let step = $state(1); // 1: Request Link, 2: Set Password & Birth Date, 3: Success
  let emailOrUsername = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let birthDate = $state("");

  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let loading = $state(false);

  let requestError = $state<string | null>(null);
  let passwordError = $state<string | null>(null);
  let confirmError = $state<string | null>(null);
  let birthDateError = $state<string | null>(null);

  let redirectCountdown = $state(3);

  // Real-time password validation indicators
  let hasMinLength = $derived(newPassword.length >= 8);
  let hasUppercase = $derived(/[A-Z]/.test(newPassword));
  let hasNumber = $derived(/[0-9]/.test(newPassword));
  let isMatching = $derived(newPassword.length > 0 && newPassword === confirmPassword);

  $effect(() => {
    if (step === 3) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      const interval = setInterval(() => {
        if (redirectCountdown > 1) {
          redirectCountdown -= 1;
        } else {
          clearInterval(interval);
          onNavigate("/login");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  });

  onMount(async () => {
    let currentToken = tokenParam;
    const urlParams = new URLSearchParams(window.location.search);
    if (!currentToken) {
      currentToken = urlParams.get("token");
    }
    const emailInUrl = urlParams.get("email");
    if (emailInUrl) {
      verifiedEmail = emailInUrl;
      emailOrUsername = emailInUrl;
    }

    if (currentToken) {
      token = currentToken;
      verifyingToken = true;
      try {
        const verifyRes = await authService.verifyResetToken(currentToken);
        tokenValid = true;
        if (verifyRes?.email) verifiedEmail = verifyRes.email;
        if (verifyRes?.name) verifiedName = verifyRes.name;
        if (verifyRes?.role) verifiedRole = verifyRes.role;
        if (verifyRes?.birth_date) {
          const rawDate = String(verifyRes.birth_date);
          birthDate = rawDate.split("T")[0];
        }
        step = 2;
      } catch (err: any) {
        errorMsg =
          err?.response?.data?.msg ||
          "Tautan aktivasi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.";
        tokenValid = false;
        step = 1;
      } finally {
        verifyingToken = false;
      }
    }
  });

  // Step flow: 1 = Missing/Invalid Token Guard, 2 = Set Password & Birth Date, 3 = Success

  const handleSetPassword = async (e?: Event) => {
    if (e) e.preventDefault();
    passwordError = null;
    confirmError = null;
    birthDateError = null;

    if (!birthDate) {
      birthDateError = "Tanggal lahir wajib diisi untuk verifikasi identitas personel";
      return;
    }

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
      errorMsg = "Token aktivasi tidak tersedia.";
      return;
    }

    loading = true;
    errorMsg = null;

    try {
      await authService.resetPassword({
        token,
        password: newPassword,
        birth_date: birthDate,
      });
      successMsg = "Akun berhasil diaktifkan! Silakan masuk menggunakan kata sandi baru.";
      step = 3;
    } catch (err: any) {
      errorMsg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        err?.message ||
        "Gagal mengaktifkan akun. Tautan aktivasi mungkin telah kedaluwarsa.";
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen bg-[#09090B] pattern-dots-dark relative flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6 lg:px-8 font-outfit-400 select-none overflow-x-hidden">
  <!-- Ambient Lighting Effects -->
  <div class="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[120px] pointer-events-none"></div>
  <div class="fixed bottom-10 right-10 w-72 h-72 bg-blue-950/20 rounded-full blur-[90px] pointer-events-none"></div>

  <div class="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
    <!-- Brand Header -->
    <div class="text-center space-y-3 mb-7">
      <div class="w-14 h-14 bg-gradient-to-tr from-[#FF634A] to-[#FF8573] rounded-2xl flex items-center justify-center text-[#09090B] mx-auto shadow-xl shadow-[#FF634A]/25 shrink-0 border border-white/20">
        <Coffee class="w-7 h-7 stroke-[2.5]" />
      </div>
      <div>
        <span class="text-[10px] font-outfit-600 uppercase tracking-widest text-[#71717A] block">Registrasi & Onboarding</span>
        <h1 class="text-2xl sm:text-3xl font-outfit-600 text-white tracking-tight mt-0.5">
          Aktivasi Akun Internal
        </h1>
        <p class="text-xs text-[#A1A1AA] mt-1 max-w-xs mx-auto">
          Verifikasi identitas & setup kata sandi awal personel MOVA
        </p>
      </div>
    </div>

    <!-- Main Card Container -->
    <div class="bg-[#131316]/95 backdrop-blur-xl py-7 px-6 sm:px-8 rounded-3xl border border-[#24242A] shadow-2xl space-y-5">
      <!-- Step Flow Indicators -->
      <div class="flex items-center justify-between gap-1 pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-1.5 {step >= 1 ? 'text-[#FF634A]' : 'text-[#52525B]'} text-xs font-outfit-600">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border {step >= 1 ? 'border-[#FF634A] bg-[#FF634A]/20' : 'border-[#383842] bg-[#1A1A1F]'}">1</span>
          <span>Tautan</span>
        </div>
        <div class="flex-1 h-[1px] mx-1 {step >= 2 ? 'bg-[#FF634A]' : 'bg-[#272730]'}"></div>
        <div class="flex items-center gap-1.5 {step >= 2 ? 'text-[#FF634A]' : 'text-[#52525B]'} text-xs font-outfit-600">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border {step >= 2 ? 'border-[#FF634A] bg-[#FF634A]/20' : 'border-[#383842] bg-[#1A1A1F]'}">2</span>
          <span>Sandi</span>
        </div>
        <div class="flex-1 h-[1px] mx-1 {step >= 3 ? 'bg-[#FF634A]' : 'bg-[#272730]'}"></div>
        <div class="flex items-center gap-1.5 {step >= 3 ? 'text-emerald-400' : 'text-[#52525B]'} text-xs font-outfit-600">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border {step >= 3 ? 'border-emerald-400 bg-emerald-950/40 text-emerald-400' : 'border-[#383842] bg-[#1A1A1F]'}">3</span>
          <span>Selesai</span>
        </div>
      </div>

      {#if verifyingToken}
        <div class="py-10 flex flex-col items-center justify-center space-y-3">
          <div class="w-9 h-9 border-3 border-[#FF634A] border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs text-[#A1A1AA] font-outfit-600">Memverifikasi tautan aktivasi...</span>
        </div>
      {:else}
        {#if errorMsg}
          <Alert variant="danger" title="Kendala Aktivasi">
            {errorMsg}
          </Alert>
        {/if}

        {#if successMsg && step !== 3}
          <Alert variant="success" title="Instruksi Terkirim">
            {successMsg}
          </Alert>
        {/if}

        <!-- STEP 1: TOKEN REQUIRED (ACCESSED WITHOUT DIRECT INVITATION LINK) -->
        {#if step === 1}
          <div class="space-y-4 text-center py-2 animate-in fade-in duration-200">
            <div class="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
              <ShieldAlert class="w-7 h-7" />
            </div>

            <div class="space-y-1.5">
              <h3 class="text-base font-outfit-600 text-white">
                Tautan Aktivasi Resmi Diperlukan
              </h3>
              <p class="text-xs text-[#A1A1AA] leading-relaxed max-w-sm mx-auto">
                Aktivasi akun MOVA hanya dapat dilakukan melalui tautan resmi yang dikirimkan langsung ke email resmi Anda oleh Administrator atau Manajemen.
              </p>
            </div>

            <div class="p-3.5 bg-[#18181D] rounded-2xl border border-[#272732] text-left text-xs text-zinc-300 space-y-2.5">
              <div class="flex items-start gap-2.5">
                <Mail class="w-4 h-4 text-[#FF634A] shrink-0 mt-0.5" />
                <span class="text-[11px] leading-relaxed text-zinc-300">
                  Buka kotak masuk (inbox) atau folder spam pada email resmi Anda dan klik tombol <strong>"Aktivasi Akun"</strong>.
                </span>
              </div>
              <div class="flex items-start gap-2.5">
                <KeyRound class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span class="text-[11px] leading-relaxed text-zinc-400">
                  Untuk keamanan sistem internal, token aktivasi tidak dapat diminta atau dimasukkan secara manual melalui halaman publik.
                </span>
              </div>
            </div>

            <div class="pt-2 space-y-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                class="w-full py-3 font-outfit-600"
                rightIcon={ArrowRight}
                onclick={() => onNavigate('/login')}
              >
                Kembali ke Halaman Login
              </Button>
            </div>
          </div>
        {/if}

        <!-- STEP 2: SET PASSWORD / GOOGLE ACTIVATION (VALID TOKEN) -->
        {#if step === 2}
          <div class="space-y-4">
            <!-- Verified Email Identity Card -->
            <div class="p-4 bg-[#18181D] rounded-2xl border border-emerald-500/30 text-xs text-emerald-200 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck class="w-4 h-4" />
                  </div>
                  <div>
                    <span class="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">Email Terverifikasi</span>
                    <span class="text-xs font-semibold text-white font-mono">{verifiedEmail || 'Akun Internal'}</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-lg bg-[#272730] text-[10px] font-bold text-zinc-300 uppercase tracking-wider border border-[#383842]">
                  {verifiedRole}
                </span>
              </div>
              {#if verifiedName}
                <p class="text-[11px] text-zinc-400 pl-9">
                  Nama Personel: <strong class="text-zinc-200">{verifiedName}</strong>
                </p>
              {/if}
            </div>

            <form onsubmit={handleSetPassword} class="space-y-4">
              <!-- Tanggal Lahir -->
              <div class="space-y-1.5">
                <label for="reg-birthdate" class="block font-outfit-600 text-zinc-300 text-xs flex items-center justify-between">
                  <span>Tanggal Lahir Personel <span class="text-[#FF634A] font-bold">*</span></span>
                  <span class="text-[10px] text-zinc-500 font-normal">Identifikasi data personel</span>
                </label>
                <input
                  id="reg-birthdate"
                  type="date"
                  bind:value={birthDate}
                  required
                  class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border {birthDateError ? 'border-rose-500' : 'border-[#2E2E38]'} text-white text-xs font-outfit-400 focus:border-[#FF634A] focus:outline-none cursor-pointer"
                />
                {#if birthDateError}
                  <p class="text-[11px] text-rose-400 font-medium">{birthDateError}</p>
                {/if}
              </div>

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
                {loading ? "Menyimpan Sandi..." : "Aktifkan Akun Saya"}
              </Button>
            </form>
          </div>
        {/if}

        <!-- STEP 3: ACTIVATION SUCCESS -->
        {#if step === 3}
          <div class="text-center py-4 space-y-4">
            <div class="w-16 h-16 bg-emerald-950/40 border border-emerald-800/40 rounded-3xl flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/50">
              <CheckCircle2 class="w-8 h-8 stroke-[2.5]" />
            </div>

            <div class="space-y-1">
              <h3 class="font-outfit-600 text-lg text-white">
                Akun Berhasil Diaktifkan!
              </h3>
              <p class="text-xs text-[#A1A1AA] max-w-xs mx-auto">
                Kata sandi baru & tanggal lahir Anda telah tersimpan. Mengalihkan ke halaman login dalam <strong class="text-[#FF634A] font-bold">{redirectCountdown}s</strong>...
              </p>
            </div>

            <Button
              type="button"
              onclick={() => onNavigate("/login")}
              variant="primary"
              size="md"
              class="w-full py-3.5 font-outfit-600"
              rightIcon={ArrowRight}
            >
              Masuk ke Halaman Login Sekarang
            </Button>
          </div>
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
