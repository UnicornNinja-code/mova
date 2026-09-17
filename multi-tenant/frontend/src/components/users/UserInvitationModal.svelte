<script lang="ts">
  import { Send, X, Copy, Check } from 'lucide-svelte';

  interface Props {
    open: boolean;
    invitationData: { name: string; email: string; link: string } | null;
    onClose: () => void;
  }

  let { open, invitationData, onClose }: Props = $props();

  let copied = $state(false);

  const copyLink = async () => {
    if (!invitationData?.link) return;
    try {
      await navigator.clipboard.writeText(invitationData.link);
      copied = true;
      setTimeout(() => (copied = false), 2500);
    } catch {
      // Fallback
    }
  };
</script>

{#if open && invitationData}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      onclick={onClose}
      class="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-default"
      aria-label="Tutup modal"
    ></button>

    <div class="relative w-full max-w-md bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-4 text-white">
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-blue-400 flex items-center justify-center font-bold">
            <Send class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Tautan Aktivasi Dikirim</h3>
            <p class="text-xs text-[#A1A1AA]">{invitationData.name} ({invitationData.email})</p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-3.5 bg-[#18181D] border border-[#2C2C36] rounded-2xl space-y-2">
        <span class="text-[11px] text-zinc-400 font-semibold block">Tautan Aktivasi Akun (Berlaku 48 Jam):</span>
        <div class="flex items-center gap-2">
          <input
            type="text"
            readonly
            value={invitationData.link}
            class="flex-1 px-2.5 py-1.5 bg-[#121215] border border-[#24242A] rounded-xl text-[11px] text-zinc-300 font-mono focus:outline-none select-all"
          />
          <button
            type="button"
            onclick={copyLink}
            class="px-3 py-1.5 rounded-xl bg-[#24242A] hover:bg-[#32323A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {#if copied}
              <Check class="w-3.5 h-3.5 text-emerald-400" />
              <span class="text-emerald-400 text-[11px]">Tersalin!</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span class="text-[11px]">Salin</span>
            {/if}
          </button>
        </div>
        <p class="text-[10px] text-zinc-500">
          💡 Tautan aktivasi baru telah dikirimkan ke email personel. Anda juga dapat menyalin tautan di atas secara langsung.
        </p>
      </div>

      <div class="pt-2 border-t border-[#24242A]">
        <button
          type="button"
          onclick={onClose}
          class="w-full py-2.5 rounded-xl bg-[#FF634A] hover:bg-[#FF8573] text-[#09090B] text-xs font-outfit-600 font-bold transition-all cursor-pointer shadow-md"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
