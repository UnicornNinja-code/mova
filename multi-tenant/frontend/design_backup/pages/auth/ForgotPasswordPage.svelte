<script lang="ts">
  import { authService } from "../../services/authService";
  import { Mail, ArrowLeft, Send, Inbox, ExternalLink, Shield } from "lucide-svelte";
  import Button from "../../components/ui/Button.svelte";
  import Input from "../../components/ui/Input.svelte";
  import Alert from "../../components/ui/Alert.svelte";

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let email = $state("");
  let emailError = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let previewUrl = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let loading = $state(false);

  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault();
    emailError = null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailError = "Masukkan format alamat email yang valid";
      return;
    }

    loading = true;
    errorMsg = null;
    successMsg = null;
    previewUrl = null;

    try {
      const res = await authService.forgotPassword(email.trim());
      successMsg = res?.msg || "Tautan dan instruksi reset kata sandi telah dikirimkan ke email terdaftar Anda.";
      previewUrl = res?.preview_url || null;
    } catch (err: any) {
      errorMsg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        err?.message ||
        "Gagal meminta pengaturan ulang kata sandi. Pastikan email terdaftar.";
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen bg-[#09090B] pattern-dots-dark relative flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6 lg:px-8 font-outfit-400 select-none overflow-x-hidden">
  <!-- Ambient Lighting Effects -->
  <div class="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[120px] pointer-events-none"></div>
  <div class="fixed bottom-10 left-10 w-72 h-72 bg-[#FF634A]/10 rounded-full blur-[90px] pointer-events-none"></div>

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
      <h1 class="text-4xl sm:text-5xl font-outfit-800 font-extrabold text-white tracking-tight">
        MOVA
      </h1>
      <p class="text-sm sm:text-base text-[#FF8573] font-outfit-600 tracking-wide mt-1">
        Move Where Demand Is.
      </p>
      <p class="text-xs sm:text-sm text-zinc-400 font-outfit-400 mt-0.5">
        Mobile Operations & Visibility Analytics
      </p>
    </div>

    <!-- Main Card Container -->
    <div class="bg-[#131316]/95 backdrop-blur-xl py-7 px-6 sm:px-8 rounded-3xl border border-[#24242A] shadow-2xl space-y-5">
      {#if successMsg}
        <Alert variant="success" title="Instruksi Terkirim">
          {successMsg}
        </Alert>

        <div class="p-3.5 bg-[#1A1A1F] rounded-2xl border border-[#272730] text-center text-xs text-[#A1A1AA] space-y-1">
          <p>Silakan periksa kotak masuk atau folder spam email Anda.</p>
        </div>

        {#if previewUrl}
          <div class="p-4 bg-emerald-950/40 rounded-2xl border border-emerald-700/50 text-xs text-emerald-200 space-y-2.5">
            <div class="flex items-center gap-2 text-emerald-400 font-bold">
              <Inbox class="w-4 h-4" />
              <span>Email Terkirim ke Ethereal SMTP</span>
            </div>
            <p class="text-[11px] text-zinc-300 leading-relaxed">
              Email simulasi pemulihan kata sandi telah dikirim ke server Ethereal Mailbox. Anda dapat membuka dan melihat pesan secara langsung melalui tautan berikut:
            </p>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md"
            >
              <span>Buka Pesan di Ethereal Preview</span>
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        {/if}

        <Button
          type="button"
          onclick={() => onNavigate("/login")}
          variant="primary"
          size="md"
          class="w-full py-3.5 font-outfit-600"
          rightIcon={ArrowLeft}
        >
          Kembali ke Halaman Masuk
        </Button>
      {/if}

      {#if errorMsg}
        <Alert variant="danger" title="Gagal Mengirim">
          {errorMsg}
        </Alert>
      {/if}

      {#if !successMsg}
        <form onsubmit={handleSubmit} class="space-y-4">
          <Input
            label="Alamat Email Terdaftar"
            type="email"
            leftIcon={Mail}
            placeholder="nama@kopikeliling.com"
            required
            error={emailError}
            bind:value={email}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            isPending={loading}
            class="w-full py-3.5 font-outfit-600"
            rightIcon={Send}
          >
            {loading ? "Mengirim Permintaan..." : "Kirim Tautan Pemulihan"}
          </Button>
        </form>
      {/if}

      <div class="pt-2 border-t border-[#24242A] text-center">
        <button
          type="button"
          onclick={() => onNavigate("/login")}
          class="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#FF8573] font-outfit-600 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft class="w-3.5 h-3.5 text-[#FF634A]" /> Kembali ke Halaman Masuk
        </button>
      </div>

      <!-- Enterprise Restricted Notice Footer -->
      <div class="pt-2 text-center space-y-1">
        <div class="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-medium">
          <Shield class="w-3 h-3 text-zinc-600" />
          <span>Akses Terbatas: Sistem Internal Perusahaan</span>
        </div>
        <p class="text-[10px] text-zinc-600">
          Pemulihan akun hanya berlaku bagi akun yang telah terdaftar di MOVA.
        </p>
      </div>
    </div>
  </div>
</div>
