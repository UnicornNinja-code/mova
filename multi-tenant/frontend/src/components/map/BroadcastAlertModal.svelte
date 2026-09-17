<script lang="ts">
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';
  import { Radio, AlertTriangle, Send, CheckCircle2 } from 'lucide-svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  let targetType = $state<'ALL' | 'ZONE'>('ALL');
  let alertType = $state('WEATHER');
  let messageText = $state('Peringatan: Hujan deras di koridor Sudirman-SCBD. Segera amankan armada ke shelter berkanopi.');
  let isSending = $state(false);
  let successMsg = $state<string | null>(null);

  const handleSend = () => {
    isSending = true;
    successMsg = null;
    setTimeout(() => {
      isSending = false;
      successMsg = 'Peringatan broadcast berhasil dikirim ke 42 Rider aktif!';
      setTimeout(() => {
        onClose();
        successMsg = null;
      }, 1200);
    }, 600);
  };
</script>

<Modal
  {isOpen}
  title="Broadcast Peringatan Lapangan"
  description="Kirim notifikasi push mendesak ke layar aplikasi mobile rider"
  {onClose}
>
  <div class="space-y-4 text-xs">
    <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
      <AlertTriangle class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        Pesan broadcast akan langsung muncul sebagai banner merah/peringatan suara pada aplikasi mobile rider yang sedang aktif bertugas.
      </div>
    </div>

    {#if successMsg}
      <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-600" />
        <span>{successMsg}</span>
      </div>
    {/if}

    <!-- Target Selection -->
    <div>
      <span class="block font-bold text-[#18181B] mb-1">Target Penerima</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onclick={() => targetType = 'ALL'}
          class="p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer
          {targetType === 'ALL' ? 'border-[#FF634A] bg-[#FFF2EF] text-[#FF634A]' : 'border-[#D2D2D4] bg-white text-[#52525B]'}"
        >
          Semua Rider (42 Aktif)
        </button>
        <button
          type="button"
          onclick={() => targetType = 'ZONE'}
          class="p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer
          {targetType === 'ZONE' ? 'border-[#FF634A] bg-[#FFF2EF] text-[#FF634A]' : 'border-[#D2D2D4] bg-white text-[#52525B]'}"
        >
          Zona Tertentu
        </button>
      </div>
    </div>

    <!-- Message Textarea -->
    <div>
      <label for="broadcast-msg-input" class="block font-bold text-[#18181B] mb-1">Isi Pesan Peringatan</label>
      <textarea
        id="broadcast-msg-input"
        bind:value={messageText}
        rows="3"
        class="w-full p-2.5 rounded-xl border border-[#D2D2D4] focus:outline-none focus:border-[#FF634A] text-xs text-[#18181B]"
        placeholder="Tulis pesan peringatan..."
      ></textarea>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" size="sm" onclick={onClose} disabled={isSending}>
      Batal
    </Button>
    <Button variant="primary" size="sm" onclick={handleSend} loading={isSending}>
      <Send class="w-3.5 h-3.5 mr-1" />
      <span>Kirim Broadcast</span>
    </Button>
  {/snippet}
</Modal>
