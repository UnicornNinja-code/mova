<script lang="ts">
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';
  import { Compass, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-svelte';
  import { dssService } from '../../services/dssService';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { isOpen, onClose, onSuccess }: Props = $props();

  let loading = $state(false);
  let successMsg = $state<string | null>(null);

  const handleRecalculate = async () => {
    loading = true;
    successMsg = null;
    try {
      // Execute BWM calculation with current baseline matrix
      await dssService.calculateBwmWeights({
        name: 'Quick Recalibration Baseline',
        best_criteria_id: '1',
        worst_criteria_id: '5',
        best_to_others: {
          '1': 1,
          '2': 2,
          '3': 3,
          '4': 4,
          '5': 7,
          '6': 5,
        },
        worst_to_others: {
          '1': 7,
          '2': 5,
          '3': 4,
          '4': 3,
          '5': 1,
          '6': 2,
        },
      });

      successMsg = 'Kalkulasi ulang bobot BWM dan ranking preferensi TOPSIS selesai!';
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Gagal kalkulasi DSS:', err);
    } finally {
      loading = false;
    }
  };
</script>

<Modal
  {isOpen}
  title="Rekalkulasi Bobot DSS BWM"
  description="Kalkulasi ulang linier solver BWM dan ranking preferensi TOPSIS operasional"
  {onClose}
>
  <div class="space-y-4">
    <div class="p-4 rounded-xl bg-[#FFF2EF] border border-[#FF634A]/20 flex items-start gap-3">
      <Compass class="w-6 h-6 text-[#FF634A] shrink-0 mt-0.5" />
      <div class="text-xs text-[#B82814] leading-relaxed">
        Algoritma akan menyelesaikan program linier min-max untuk 5 kriteria utama dan menyinkronkan kembali skor preferensi 18 zona operasional.
      </div>
    </div>

    {#if successMsg}
      <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-600" />
        <span>{successMsg}</span>
      </div>
    {/if}

    <div class="text-xs text-[#52525B] space-y-1.5 p-3 bg-[#F4F4F6] rounded-xl border border-[#D2D2D4]">
      <div class="flex justify-between">
        <span>Kriteria Terbaik:</span>
        <strong class="text-[#18181B]">POTENSI_PASAR (Benefit)</strong>
      </div>
      <div class="flex justify-between">
        <span>Kriteria Terburuk:</span>
        <strong class="text-[#18181B]">JARAK_HUB (Cost)</strong>
      </div>
      <div class="flex justify-between">
        <span>Target Konsistensi:</span>
        <span class="text-emerald-600 font-bold">ξ* ≤ 0.10 (Sangat Konsisten)</span>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" size="sm" onclick={onClose} disabled={loading}>
      Batal
    </Button>
    <Button variant="primary" size="sm" onclick={handleRecalculate} {loading}>
      <RefreshCw class="w-3.5 h-3.5 mr-1" />
      <span>Jalankan Rekalkulasi</span>
    </Button>
  {/snippet}
</Modal>
