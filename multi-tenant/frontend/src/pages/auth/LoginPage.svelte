<script lang="ts">
  import { onMount } from "svelte";
  import { cn } from "$lib/utils";
  import { Button } from "$components/ui/button";
  import { Input } from "$components/ui/input";
  import { Checkbox } from "$components/ui/checkbox";
  import { Spinner } from "$components/ui/spinner";
  import { MovaLogo } from "$components/ui/brand";
  import { DotPattern } from "$components/ui/dot-pattern";
  import { authService, type CaptchaData } from "../../services/authService";
  import { authStore, getRoleLandingPath } from "../../lib/stores/auth.svelte";
  import { setupStore } from "../../lib/stores/setupStore.svelte";
  import { router } from "../../lib/stores/router.svelte";
  import { Shield } from "lucide-svelte";

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let identifier = $state("");
  let password = $state("");
  let rememberMe = $state(true);
  let showPassword = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state("");

  // Captcha state
  let captcha = $state<CaptchaData | null>(null);
  let captchaAnswer = $state("");
  let requiresCaptcha = $state(false);
  let captchaLoading = $state(false);

  const fetchCaptcha = async () => {
    captchaLoading = true;
    try {
      const data = await authService.getCaptcha(captcha?.captcha_id);
      captcha = data;
      requiresCaptcha = true;
    } catch (err: any) {
      console.warn("Gagal memuat captcha:", err);
    } finally {
      captchaLoading = false;
    }
  };

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

  onMount(async () => {
    try {
      const risk = await authService.checkRiskStatus();
      if (risk.requires_captcha) {
        await fetchCaptcha();
      }
    } catch {
      // Risk check non-blocking
    }
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!identifier || !password) {
      errorMessage = "Silakan masukkan email/username dan password Anda.";
      return;
    }

    if (requiresCaptcha && !captchaAnswer.trim()) {
      errorMessage = "Silakan masukkan kode CAPTCHA yang tampil pada gambar.";
      return;
    }

    errorMessage = "";
    isLoading = true;

    try {
      const res = await authService.login({
        identifier: identifier.trim(),
        password,
        captcha_id: captcha?.captcha_id,
        captcha_answer: captchaAnswer.trim() || undefined,
      });

      authStore.login(res.user, res.token, res.refreshToken);

      if (res.user.first_login) {
        navigateTo("/first-login");
      } else if (res.user.role === "SUPERADMIN") {
        const setup = await setupStore.checkStatus();
        if (setup && (setup.status === "REQUIRED" || setup.status === "IN_PROGRESS")) {
          navigateTo("/first-setup");
        } else {
          navigateTo("/dashboard");
        }
      } else {
        const destination = getRoleLandingPath(res.user.role);
        navigateTo(destination);
      }
    } catch (err: any) {
      const resData = err?.response?.data;
      if (
        resData?.requires_captcha ||
        resData?.code === "CAPTCHA_REQUIRED" ||
        resData?.code === "CAPTCHA_INVALID" ||
        (err?.response?.status === 400 &&
          (String(resData?.msg || "")
            .toLowerCase()
            .includes("captcha") ||
            String(resData?.message || "")
              .toLowerCase()
              .includes("captcha")))
      ) {
        requiresCaptcha = true;
        await fetchCaptcha();
        captchaAnswer = "";
      }
      errorMessage =
        resData?.msg ||
        resData?.message ||
        err?.message ||
        "Gagal masuk ke sistem. Periksa kembali kredensial Anda.";
    } finally {
      isLoading = false;
    }
  }
</script>

<div
  class="relative min-h-screen w-full flex items-center justify-center bg-[#09090b] px-4 py-12 overflow-hidden font-sans selection:bg-[#FF634A]/30"
>
  <!-- Ambient Dot Pattern with Masking -->
  <DotPattern
    class="[mask-image:radial-gradient(800px_circle_at_center,white,transparent)] opacity-40 fill-zinc-500 pointer-events-none"
    width={20}
    height={20}
    cr={1.2}
  />

  <!-- Ambient Radiant Glow Orbs -->
  <div
    class="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-[#FF634A]/10 blur-[128px] pointer-events-none"
  ></div>
  <div
    class="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[128px] pointer-events-none"
  ></div>

  <!-- Background Mova Typography Watermark matching Logo (Heavy & Tight with Dot) -->
  <div
    class="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
  >
    <span
      class="font-heading text-[12rem] sm:text-[18rem] md:text-[24rem] font-black tracking-[-0.035em] text-white/[0.045] leading-none select-none"
    >
      Mova<span class="text-[#FF634A]/30">.</span>
    </span>
  </div>

  <!-- Centered Login Card (Level 2 Surface) -->
  <div
    class="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#131316]/90 p-8 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-10"
  >
    <!-- Header -->
    <div class="mb-8 text-center">
      <h1
        class="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl"
      >
        Selamat Datang di Mova<span class="text-[#FF634A]">.</span>
      </h1>
      <p class="text-xs text-zinc-400 font-sans leading-relaxed">
        platform DSS untuk optimasi lokasi penjualan bisnis berbasis keliling
      </p>
    </div>

    {#if errorMessage}
      <div
        class="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
      >
        <i class="bx bx-error-circle text-base"></i>
        <span>{errorMessage}</span>
      </div>
    {/if}

    <!-- Login Form -->
    <form onsubmit={handleLogin} class="space-y-4 font-sans">
      <div>
        <label
          for="identifier"
          class="mb-1.5 block text-xs font-medium text-zinc-300"
        >
          Email / Username
        </label>
        <Input
          id="identifier"
          type="text"
          placeholder="nama@perusahaan.com / NIK"
          icon="bx-envelope"
          bind:value={identifier}
          required
        />
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label for="password" class="block text-xs font-medium text-zinc-300">
            Password
          </label>
          <button
            type="button"
            onclick={() => navigateTo("/forgot-password")}
            class="text-xs text-[#FF634A] hover:underline cursor-pointer bg-transparent border-0 p-0"
          >
            Lupa Password?
          </button>
        </div>
        <div class="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            icon="bx-lock-alt"
            bind:value={password}
            required
          >
            {#snippet suffix()}
              <button
                type="button"
                onclick={() => (showPassword = !showPassword)}
                class="text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Toggle password visibility"
              >
                <i
                  class={cn(
                    "bx text-base",
                    showPassword ? "bx-hide" : "bx-show",
                  )}
                ></i>
              </button>
            {/snippet}
          </Input>
        </div>
      </div>

      <!-- CAPTCHA Verification Block -->
      {#if requiresCaptcha}
        <div
          class="p-3.5 rounded-2xl bg-[#18181D] border border-[#2C2C36] space-y-2.5"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-xs text-zinc-300 font-medium flex items-center gap-1.5"
            >
              <i class="bx bx-shield-quarter text-[#FF634A]"></i>
              Verifikasi Keamanan CAPTCHA
            </span>
            <button
              type="button"
              onclick={fetchCaptcha}
              disabled={captchaLoading}
              class="text-xs text-[#FF634A] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50"
            >
              <i class="bx bx-refresh {captchaLoading ? 'animate-spin' : ''}"
              ></i>
              Ganti Kode
            </button>
          </div>

          <!-- SVG Image Container -->
          <div
            class="w-full h-12 bg-[#121216] rounded-xl p-1 flex items-center justify-center overflow-hidden border border-[#2C2C36] select-none"
          >
            {#if captchaLoading}
              <div class="flex items-center gap-2 text-xs text-zinc-400">
                <i class="bx bx-loader-alt animate-spin text-[#FF634A]"></i>
                <span>Memuat kode verifikasi...</span>
              </div>
            {:else if captcha?.svg}
              <img
                src={captcha.svg.startsWith("data:") ||
                captcha.svg.startsWith("http")
                  ? captcha.svg
                  : `data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`}
                alt="Kode CAPTCHA"
                class="h-10 w-auto object-contain select-none pointer-events-none filter contrast-125"
              />
            {:else}
              <button
                type="button"
                onclick={fetchCaptcha}
                class="text-xs text-[#FF634A] hover:underline cursor-pointer bg-transparent border-0"
              >
                Klik untuk memuat CAPTCHA
              </button>
            {/if}
          </div>

          <Input
            id="captcha-answer"
            type="text"
            placeholder="Ketik 5 kode huruf/angka di atas..."
            icon="bx-shield-quarter"
            bind:value={captchaAnswer}
            required
          />
        </div>
      {/if}

      <div class="flex items-center justify-between pt-1">
        <label
          class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none"
        >
          <Checkbox bind:checked={rememberMe} />
          <span>Ingat sesi perangkat ini</span>
        </label>
      </div>

      <Button
        type="submit"
        variant="default"
        size="lg"
        disabled={isLoading}
        class="w-full mt-2 h-11 text-base font-semibold"
      >
        {#if isLoading}
          <Spinner size="sm" class="border-white" />
          <span>Memverifikasi...</span>
        {:else}
          <span>Masuk ke Dashboard</span>
          <i class="bx bx-right-arrow-alt text-xl"></i>
        {/if}
      </Button>
    </form>
    <!-- Footer Note -->
    <div class="pt-2 text-center space-y-1">
      <div
        class="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-medium"
      >
        <Shield class="w-3 h-3 text-zinc-600" />
        <span>Akses Terbatas: Sistem Internal Perusahaan</span>
      </div>
    </div>
  </div>
</div>
