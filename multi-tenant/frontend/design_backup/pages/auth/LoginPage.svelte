<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { authService, type CaptchaData } from "../../services/authService";
  import { authStore, getRoleLandingPath } from "../../lib/stores/auth.svelte";
  import {
    Lock,
    User,
    Shield,
    ArrowRight,
    KeyRound,
    RefreshCw,
    Search,
    Clock,
    AlertTriangle,
  } from "lucide-svelte";
  import Button from "../../components/ui/Button.svelte";
  import Input from "../../components/ui/Input.svelte";
  import Alert from "../../components/ui/Alert.svelte";
  import CheckAccountStatusModal from "../../components/auth/CheckAccountStatusModal.svelte";
  import CaptchaChallenge from "../../components/auth/CaptchaChallenge.svelte";

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let identifier = $state("");
  let password = $state("");
  let captchaAnswer = $state("");
  let captchaData = $state<CaptchaData | null>(null);
  let captchaLoading = $state(false);
  let requiresCaptcha = $state(false);
  let showCheckStatusModal = $state(false);
  let errorMsg = $state<string | null>(null);
  let loading = $state(false);

  const CAPTCHA_DURATION = 60; // 60 detik batas waktu countdown captcha
  let captchaTimeLeft = $state(CAPTCHA_DURATION);
  let captchaInterval: any = null;

  const errors = $state<{
    identifier?: string;
    password?: string;
    captcha?: string;
  }>({});

  const startCaptchaTimer = () => {
    if (captchaInterval) clearInterval(captchaInterval);
    captchaTimeLeft = CAPTCHA_DURATION;
    captchaInterval = setInterval(() => {
      if (captchaTimeLeft > 1) {
        captchaTimeLeft -= 1;
      } else {
        captchaTimeLeft = 0;
        loadCaptcha(captchaData?.captcha_id); // Auto-refresh saat masa berlaku habis
      }
    }, 1000);
  };

  onMount(async () => {
    try {
      const risk = await authService.checkRiskStatus();
      if (risk?.requires_captcha) {
        requiresCaptcha = true;
        loadCaptcha();
      }
    } catch (err) {
      console.warn("Gagal mengecek status risiko awal:", err);
    }
  });

  const loadCaptcha = async (oldId?: string) => {
    captchaLoading = true;
    try {
      captchaData = await authService.getCaptcha(oldId);
      captchaAnswer = "";
      errors.captcha = undefined;
      startCaptchaTimer();
    } catch (err) {
      console.warn("Gagal memuat CAPTCHA:", err);
    } finally {
      captchaLoading = false;
    }
  };

  onDestroy(() => {
    if (captchaInterval) clearInterval(captchaInterval);
  });

  const validate = () => {
    errors.identifier = undefined;
    errors.password = undefined;
    errors.captcha = undefined;
    let valid = true;

    if (!identifier || identifier.trim().length < 3) {
      errors.identifier = "Username atau Email minimal 3 karakter";
      valid = false;
    }
    if (!password || password.length < 6) {
      errors.password = "Password minimal 6 karakter";
      valid = false;
    }
    if (
      requiresCaptcha &&
      (!captchaAnswer || captchaAnswer.trim().length < 3)
    ) {
      errors.captcha = "Masukkan kode CAPTCHA keamanan";
      valid = false;
    }
    return valid;
  };

  const handleLogin = async (e?: Event) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    loading = true;
    errorMsg = null;

    try {
      const res = await authService.login({
        identifier: identifier.trim(),
        password,
        captcha_id: requiresCaptcha ? captchaData?.captcha_id : undefined,
        captcha_answer: requiresCaptcha ? captchaAnswer.trim() : undefined,
      });

      const userObj = res?.user;
      const token = res?.token;

      if (!token || !userObj) {
        throw new Error(
          "Token autentikasi tidak ditemukan pada respon server.",
        );
      }

      // Check if user account is deactivated
      if (userObj.is_active === false) {
        authStore.login(userObj, token);
        onNavigate("/inactive");
        return;
      }

      authStore.login(userObj, token);

      // Route based on first-login status
      if (userObj.first_login === true) {
        // User has never set their own password — force to first-login setup page
        onNavigate('/first-login');
      } else {
        const landing = getRoleLandingPath(userObj.role);
        onNavigate(landing);
      }
    } catch (err: any) {
      const data = err?.response?.data;
      errorMsg =
        data?.msg ||
        data?.message ||
        err?.message ||
        "Autentikasi gagal. Periksa username dan kata sandi Anda.";

      // Progressive Challenge escalation from backend
      if (data?.requires_captcha) {
        requiresCaptcha = true;
        loadCaptcha(captchaData?.captcha_id);
      } else if (requiresCaptcha) {
        loadCaptcha(captchaData?.captcha_id);
      }
    } finally {
      loading = false;
    }
  };
</script>

<div
  class="min-h-screen bg-[#09090B] pattern-dots-dark relative flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6 lg:px-8 font-outfit-400 select-none overflow-x-hidden"
>
  <!-- Ambient Lighting Effects -->
  <div
    class="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[120px] pointer-events-none"
  ></div>
  <div
    class="fixed bottom-10 right-10 w-72 h-72 bg-purple-950/20 rounded-full blur-[90px] pointer-events-none"
  ></div>

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
      <h1
        class="text-4xl sm:text-5xl font-outfit-800 font-extrabold text-white tracking-tight"
      >
        MOVA
      </h1>
      <p
        class="text-sm sm:text-base text-[#FF8573] font-outfit-600 tracking-wide mt-1"
      >
        Move Where Demand Is.
      </p>
      <p class="text-xs sm:text-sm text-zinc-400 font-outfit-400 mt-0.5">
        Mobile Operations & Visibility Analytics
      </p>
    </div>

    <!-- Main Card Container -->
    <div
      class="bg-[#131316]/95 backdrop-blur-xl py-7 px-6 sm:px-8 rounded-3xl border border-[#24242A] shadow-2xl space-y-6"
    >
      <!-- Session Expired Notification -->
      {#if authStore.isExpired && !errorMsg}
        <Alert variant="warning" title="Sesi Berakhir">
          Sesi login Anda telah berakhir demi keamanan. Silakan masuk kembali
          untuk melanjutkan.
        </Alert>
      {/if}

      <!-- Error Message Alert -->
      {#if errorMsg}
        <Alert variant="danger" title="Gagal Masuk">
          {errorMsg}
        </Alert>
      {/if}

      <form onsubmit={handleLogin} class="space-y-4">
        <Input
          label="Username atau Alamat Email"
          leftIcon={User}
          placeholder="superadmin@kopikeliling.com"
          required
          error={errors.identifier}
          bind:value={identifier}
        />

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label
              for="login-password"
              class="block text-xs font-outfit-600 text-[#D4D4D8]"
            >
              Kata Sandi <span class="text-[#FF634A] font-bold">*</span>
            </label>
            <button
              type="button"
              onclick={() => onNavigate("/forgot-password")}
              class="text-xs text-[#FF634A] hover:text-[#FF8573] font-outfit-600 transition-colors cursor-pointer"
            >
              Lupa kata sandi?
            </button>
          </div>

          <Input
            id="login-password"
            type="password"
            leftIcon={Lock}
            placeholder="••••••••"
            required
            error={errors.password}
            bind:value={password}
          />
        </div>

        <!-- Progressive Security Escalation: CAPTCHA Verification Block -->
        {#if requiresCaptcha}
          <CaptchaChallenge
            {captchaData}
            {captchaLoading}
            {captchaTimeLeft}
            {captchaAnswer}
            error={errors.captcha}
            onRefresh={() => loadCaptcha(captchaData?.captcha_id)}
            onInput={(val) => {
              captchaAnswer = val;
              errors.captcha = undefined;
            }}
          />
        {/if}

        <Button
          type="submit"
          variant="primary"
          size="md"
          isPending={loading}
          class="w-full py-3.5 mt-2 font-outfit-600"
          rightIcon={ArrowRight}
        >
          {loading ? "Memverifikasi Kredensial..." : "Masuk ke Sistem"}
        </Button>
      </form>

      <!-- Check Account Status Utility Prompt -->
      <div
        class="p-2.5 bg-[#1A1A1F] rounded-2xl border border-[#272730] text-center text-xs text-[#A1A1AA] flex items-center justify-center"
      >
        <button
          type="button"
          onclick={() => (showCheckStatusModal = true)}
          class="text-xs text-[#FF8573] hover:text-[#FF634A] font-outfit-600 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Search class="w-3.5 h-3.5 text-[#FF634A]" />
          <span>Cek status akun</span>
        </button>
      </div>

      <!-- Enterprise Restricted Notice Footer -->
      <div class="pt-3 border-t border-[#24242A] text-center space-y-1">
        <div
          class="flex items-center justify-center gap-1.5 text-xs text-[#71717A] font-medium"
        >
          <Shield class="w-3.5 h-3.5 text-[#52525B]" />
          <span>Akses Terbatas: Sistem Internal Perusahaan</span>
        </div>
        <p class="text-[11px] text-[#52525B]">
          Provisioning akun hanya dilakukan oleh Administrator MOVA.
        </p>
      </div>
    </div>
  </div>

  <!-- Check Account Status Modal Component -->
  <CheckAccountStatusModal
    isOpen={showCheckStatusModal}
    onClose={() => (showCheckStatusModal = false)}
    onPrefillLogin={(val) => {
      identifier = val;
    }}
  />
</div>
