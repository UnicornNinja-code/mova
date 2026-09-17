<script lang="ts">
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';
  import { CloudSun, CheckCircle2, RefreshCw } from 'lucide-svelte';
  import { dashboardService } from '../../services/dashboardService';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { isOpen, onClose, onSuccess }: Props = $props();

  let loading = $state(false);
  let successMsg = $state<string | null>(null);

  const handleSync = async () => {
    loading = true;
    successMsg = null;
    try {
      const res = await dashboardService.syncWeather();
      successMsg = res.msg || 'Parameter cuaca 18 zona berhasil disinkronkan!';
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Gagal sinkronisasi cuaca:', err);
    } finally {
      loading = false;
    }
  };
</script>

<Modal
  {isOpen}
  title="Sinkronisasi Data Cuaca"
  description="Pengambilan parameter cuaca OpenWeather untuk 18 zona operasional"
  {onClose}
>
  <div class="space-y-4">
    <div class="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
      <CloudSun class="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
      <div class="text-xs text-blue-900 leading-relaxed">
        Sistem akan memperbarui data suhu, kondisi hujan, dan tingkat awan terkini untuk seluruh zona di DKI Jakarta secara langsung.
      </div>
    </div>

    {#if successMsg}
      <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-600" />
        <span>{successMsg}</span>
      </div>
    {/if}

    <div class="text-xs text-[#52525B] space-y-1">
      <div class="flex justify-between">
        <span>Status OpenWeather API:</span>
        <strong class="text-emerald-600">READY (Quota OK)</strong>
      </div>
      <div class="flex justify-between">
        <span>Zona Terjangkau:</span>
        <strong class="text-[#18181B]">18 Wilayah DKI Jakarta</strong>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" size="sm" onclick={onClose} disabled={loading}>
      Batal
    </Button>
    <Button variant="primary" size="sm" onclick={handleSync} {loading}>
      <RefreshCw class="w-3.5 h-3.5 mr-1" />
      <span>Sinkronkan Sekarang</span>
    </Button>
  {/snippet}
</Modal>
