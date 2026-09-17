<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$components/ui/button";
  import { Input } from "$components/ui/input";
  import { Checkbox } from "$components/ui/checkbox";
  import { Spinner } from "$components/ui/spinner";
  import { MovaLogo } from "$components/ui/brand";
  import { DotPattern } from "$components/ui/dot-pattern";
  import { authService } from "../../services/authService";
  import { authStore, getRoleLandingPath } from "../../lib/stores/auth.svelte";
  import { router } from "../../lib/stores/router.svelte";

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let fullName = $state("");
  let email = $state("");
  let phone = $state("");
  let birthDate = $state("");
  let invitationCode = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let acceptTerms = $state(false);
  let showPassword = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

  onMount(() => {
    if (router.queryParams.token) {
      invitationCode = router.queryParams.token;
    }
    if (router.queryParams.email) {
      email = router.queryParams.email;
    }
  });

  const passwordStrength = $derived.by(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  });

  async function handleRegister(e: Event) {
    e.preventDefault();
    if (!acceptTerms) {
      errorMessage = "Anda wajib menyetujui Ketentuan Layanan & SOP MOVA.";
      return;
    }
    if (password.length < 8) {
      errorMessage = "Kata sandi minimal 8 karakter.";
      return;
    }
    if (password !== confirmPassword) {
      errorMessage = "Konfirmasi password tidak cocok.";
      return;
    }
    errorMessage = "";
    successMessage = "";
    isLoading = true;

    try {
      const res = await authService.register({
        token: invitationCode.trim(),
        name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        birth_date: birthDate || undefined,
      });

      if (res.token && res.user) {
        authStore.login(res.user, res.token);
        successMessage = "Aktivasi akun berhasil! Mengalihkan ke sistem...";
        setTimeout(() => {
          navigateTo(getRoleLandingPath(res.user?.role));
        }, 1200);
      } else {
        successMessage = res.msg || "Akun berhasil diaktivasi! Silakan login.";
        setTimeout(() => {
          navigateTo("/login");
        }, 1500);
      }
    } catch (err: any) {
      const resData = err?.response?.data;
      errorMessage =
        resData?.msg ||
        resData?.message ||
        err?.message ||
        "Gagal mengaktivasi akun. Periksa token undangan Anda.";
    } finally {
      isLoading = false;
    }
  }
</script>

<div
  class="relative min-h-screen w-full flex items-center justify-center bg-[#09090b] px-4 py-12 overflow-hidden font-sans selection:bg-[#FF634A]/30"
>
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

  <div
    class="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-[#131316]/90 p-8 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-10"
  >
    <div class="mb-6 flex flex-col items-center text-center">
      <h1
        class="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl"
      >
        Registrasi Akun
      </h1>
      <p class="mt-1 text-xs text-zinc-400 font-sans">
        Silahkan lengkapi data dibawah ini untuk registrasi akun
      </p>
    </div>

    {#if errorMessage}
      <div
        class="mb-5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
      >
        <i class="bx bx-error-circle text-base"></i>
        <span>{errorMessage}</span>
      </div>
    {/if}

    {#if successMessage}
      <div
        class="mb-5 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400"
      >
        <i class="bx bx-check-circle text-base"></i>
        <span>{successMessage}</span>
      </div>
    {/if}

    <form onsubmit={handleRegister} class="space-y-3.5 font-sans">
      <div>
        <label
          for="fullName"
          class="mb-1 block text-xs font-medium text-zinc-300"
        >
          Nama Lengkap
        </label>
        <Input
          id="fullName"
          placeholder="misal: Budi Santoso"
          icon="bx-user"
          bind:value={fullName}
          required
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            for="email"
            class="mb-1 block text-xs font-medium text-zinc-300"
          >
            Alamat Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="budi@mova.id"
            icon="bx-envelope"
            bind:value={email}
            required
          />
        </div>
        <div>
          <label
            for="phone"
            class="mb-1 block text-xs font-medium text-zinc-300"
          >
            Nomor WhatsApp
          </label>
          <Input
            id="phone"
            type="tel"
            placeholder="08123456789"
            icon="bx-phone"
            bind:value={phone}
            required
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            for="birthDate"
            class="mb-1 block text-xs font-medium text-zinc-300"
          >
            Tanggal Lahir (Verifikasi Rider)
          </label>
          <Input
            id="birthDate"
            type="date"
            bind:value={birthDate}
            class="[color-scheme:dark] cursor-pointer pr-3.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100"
            required
          />
        </div>
        <div>
          <label
            for="invitationCode"
            class="mb-1 block text-xs font-medium text-zinc-300"
          >
            Kode Undangan / Hub Token
          </label>
          <Input
            id="invitationCode"
            placeholder="TOKEN-XXXXXX"
            icon="bx-key"
            bind:value={invitationCode}
            required
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            for="password"
            class="mb-1 block text-xs font-medium text-zinc-300"
          >
            Password Baru
          </label>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            icon="bx-lock-alt"
            bind:value={password}
            required
          />
        </div>
        <div>
          <label
            for="confirmPassword"
            class="mb-1 block text-xs font-medium text-zinc-300"
          >
            Konfirmasi Password
          </label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            icon="bx-lock-alt"
            bind:value={confirmPassword}
            required
          />
        </div>
      </div>

      <!-- Password Strength Indicator -->
      {#if password}
        <div class="space-y-1">
          <div
            class="flex items-center justify-between text-[10px] text-zinc-400"
          >
            <span>Kekuatan Kata Sandi:</span>
            <span
              class={passwordStrength >= 75
                ? "text-emerald-400 font-bold"
                : passwordStrength >= 50
                  ? "text-amber-400 font-bold"
                  : "text-rose-400"}
            >
              {passwordStrength >= 75
                ? "Kuat"
                : passwordStrength >= 50
                  ? "Sedang"
                  : "Lemah (Min. 8 karakter, simbol, angka)"}
            </span>
          </div>
          <div class="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              class={`h-full transition-all duration-300 ${
                passwordStrength >= 75
                  ? "bg-emerald-400"
                  : passwordStrength >= 50
                    ? "bg-amber-400"
                    : "bg-rose-500"
              }`}
              style={`width: ${passwordStrength}%`}
            ></div>
          </div>
        </div>
      {/if}

      <div class="pt-2">
        <label
          class="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer select-none"
        >
          <div class="pt-0.5">
            <Checkbox bind:checked={acceptTerms} />
          </div>
          <span class="leading-relaxed">
            Saya menyetujui Ketentuan Layanan, Kebijakan Privasi GPS, dan SOP
            Keselamatan Berkendara MOVA.
          </span>
        </label>
      </div>

      <Button
        type="submit"
        variant="default"
        size="lg"
        disabled={isLoading || !acceptTerms}
        class="w-full mt-3 h-11 text-base font-semibold cursor-pointer"
      >
        {#if isLoading}
          <Spinner size="sm" class="border-white" />
          <span>Memproses Akun...</span>
        {:else}
          <span>Daftar & Aktivasi Akun</span>
          <i class="bx bx-check-circle text-xl"></i>
        {/if}
      </Button>
    </form>

    <p class="mt-6 text-center text-xs text-zinc-500 font-sans">
      Sudah memiliki akun? <button
        type="button"
        onclick={() => navigateTo("/login")}
        class="text-[#FF634A] hover:underline cursor-pointer bg-transparent border-0 p-0 font-bold"
        >Masuk sekarang</button
      >
    </p>
  </div>
</div>
