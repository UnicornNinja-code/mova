<!-- 
  CheckAccountStatusModal.svelte
  Modal utilitas pengecekan status provisioning akun pada halaman Login COZIS
  Keamanan: Tidak membocorkan token / tautan aktivasi ke publik.
-->
<script lang="ts">
  import { 
    Search, 
    X, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    ArrowRight, 
    ArrowLeft,
    Mail, 
    User, 
    ExternalLink,
    HelpCircle
  } from 'lucide-svelte';
  import { authService } from '../../services/authService';
  import Button from '../ui/Button.svelte';

  interface Props {
    isOpen?: boolean;
    onClose: () => void;
    onPrefillLogin?: (identifier: string) => void;
  }

  let {
    isOpen = false,
    onClose,
    onPrefillLogin,
  }: Props = $props();

  let identifierInput = $state('');
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let result = $state<{
    status: 'ACTIVE' | 'INVITED' | 'INACTIVE' | 'NOT_FOUND';
    message: string;
    email?: string;
    name?: string;
    role?: string;
  } | null>(null);

  // Reset state when modal opens
  $effect(() => {
    if (isOpen) {
      identifierInput = '';
      loading = false;
      errorMsg = null;
      result = null;
    }
  });

  const handleCheckStatus = async (e?: Event) => {
    if (e) e.preventDefault();
    if (!identifierInput.trim()) {
      errorMsg = 'Masukkan alamat email atau username akun Anda.';
      return;
    }

    loading = true;
    errorMsg = null;
    result = null;

    try {
      const res = await authService.checkAccountStatus(identifierInput.trim());
      result = res;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memeriksa status akun. Silakan coba beberapa saat lagi.';
    } finally {
      loading = false;
    }
  };

  const handleSelectActive = () => {
    if (onPrefillLogin && identifierInput.trim()) {
      onPrefillLogin(identifierInput.trim());
    }
    onClose();
  };
</script>

{#if isOpen}
  <!-- Scrim & Backdrop -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#09090B]/80 backdrop-blur-md font-outfit-400 select-none animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
  >
    <!-- Modal Card -->
    <div 
      class="relative w-full max-w-md bg-[#131316] rounded-3xl border border-[#272732] shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150"
    >
      <!-- Top Accent Line -->
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF634A] to-transparent"></div>

      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h3 class="text-base sm:text-lg font-outfit-600 text-white leading-tight">
            Periksa Status Akun
          </h3>
          <p class="text-xs text-[#A1A1AA]">
            Ketahui status akun Anda di sistem enterprise MOVA
          </p>
        </div>

        <button
          type="button"
          onclick={onClose}
          class="p-1.5 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer shrink-0"
          aria-label="Tutup"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Search Form -->
      <form onsubmit={handleCheckStatus} class="space-y-3">
        <div class="space-y-1.5">
          <label for="check-id-input" class="block text-xs font-outfit-600 text-[#D4D4D8]">
            Alamat Email atau Username
          </label>
          <div class="relative">
            <input
              id="check-id-input"
              type="text"
              placeholder="nama@kopikeliling.com atau username"
              bind:value={identifierInput}
              disabled={loading}
              class="w-full pl-3.5 pr-10 py-2.5 text-xs bg-[#18181D] border border-[#272730] focus:border-[#FF634A] rounded-xl text-white placeholder:text-zinc-500 focus:outline-none transition-all"
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              <User class="w-4 h-4" />
            </div>
          </div>
          {#if errorMsg}
            <p class="text-[11px] text-rose-400">{errorMsg}</p>
          {/if}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={loading}
          class="w-full py-2.5"
          rightIcon={Search}
        >
          {loading ? 'Memeriksa Database...' : 'Periksa Status'}
        </Button>
      </form>

      <!-- Status Result Box -->
      {#if result}
        <div class="pt-2 border-t border-[#24242A] animate-in fade-in duration-200">
          {#if result.status === 'ACTIVE'}
            <!-- ACTIVE RESULT -->
            <div class="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-700/50">
                  <CheckCircle2 class="w-3 h-3" />
                  <span>AKUN AKTIF</span>
                </span>
                {#if result.role}
                  <span class="text-[10px] font-mono font-bold text-zinc-400 uppercase">
                    Role: {result.role}
                  </span>
                {/if}
              </div>

              <div class="space-y-0.5">
                <h4 class="text-xs font-bold text-white">{result.name || 'Pengguna Terdaftar'}</h4>
                <p class="text-xs text-zinc-300 leading-relaxed">
                  {result.message}
                </p>
              </div>

              <Button
                type="button"
                variant="white"
                size="sm"
                class="w-full py-2 text-xs"
                rightIcon={ArrowRight}
                onclick={handleSelectActive}
              >
                Lanjut Masuk ke Akun
              </Button>
            </div>

          {:else if result.status === 'INVITED'}
            <!-- INVITED / ACTIVATION PENDING RESULT -->
            <div class="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-900/60 text-amber-400 border border-amber-700/50">
                  <Clock class="w-3 h-3" />
                  <span>MENUNGGU AKTIVASI</span>
                </span>
                {#if result.role}
                  <span class="text-[10px] font-mono font-bold text-zinc-400 uppercase">
                    Role: {result.role}
                  </span>
                {/if}
              </div>

              <div class="space-y-1">
                <h4 class="text-xs font-bold text-white">Undangan Telah Dikirim</h4>
                <p class="text-xs text-zinc-300 leading-relaxed">
                  {result.message}
                </p>
              </div>

              <div class="p-2.5 rounded-xl bg-[#131316] border border-amber-800/30 text-[11px] text-amber-200/90 flex items-start gap-2">
                <Mail class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Buka email resmi Anda dan klik tautan aktivasi yang tercantum. Demi keamanan, tautan aktivasi tidak ditampilkan di halaman publik ini.
                </span>
              </div>
            </div>

          {:else if result.status === 'INACTIVE'}
            <!-- INACTIVE RESULT -->
            <div class="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-900/60 text-rose-400 border border-rose-700/50">
                  <ShieldAlert class="w-3 h-3" />
                  <span>AKUN NONAKTIF</span>
                </span>
              </div>

              <div class="space-y-1">
                <h4 class="text-xs font-bold text-white">Akses Ditangguhkan</h4>
                <p class="text-xs text-zinc-300 leading-relaxed">
                  {result.message}
                </p>
              </div>
            </div>

          {:else}
            <!-- NOT FOUND RESULT -->
            <div class="p-4 rounded-2xl bg-[#18181D] border border-[#272730] space-y-2">
              <div class="flex items-center gap-2 text-zinc-400">
                <HelpCircle class="w-4 h-4 text-zinc-400" />
                <span class="text-xs font-bold text-white">Akun Belum Ditemukan</span>
              </div>
              <p class="text-xs text-zinc-400 leading-relaxed">
                {result.message}
              </p>
              <p class="text-[11px] text-zinc-500 italic">
                Catatan: Pendaftaran mandiri tidak tersedia. Akun hanya dapat dibuat oleh Administrator melalui sistem undangan internal.
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Footer Info -->
      <div class="text-center pt-1">
        <button
          type="button"
          onclick={onClose}
          class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-[#FF8573] font-outfit-600 transition-colors cursor-pointer py-1 px-2.5 rounded-xl hover:bg-white/5"
        >
          <ArrowLeft class="w-3.5 h-3.5 text-[#FF634A]" />
          <span>Kembali ke Form Login</span>
        </button>
      </div>
    </div>
  </div>
{/if}
