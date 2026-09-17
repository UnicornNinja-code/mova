<script lang="ts">
  import { X, AlertCircle } from 'lucide-svelte';

  interface Props {
    show: boolean;
    isEditing: boolean;
    formName: string;
    formCode: string;
    formMaxCapacity: number;
    formDescription: string;
    formStatus: 'ACTIVE' | 'INACTIVE';
    formErrorMessage: string | null;
    isSubmitting: boolean;
    onClose: () => void;
    onSubmit: () => void;
    onUpdateName: (val: string) => void;
    onUpdateCode: (val: string) => void;
    onUpdateMaxCapacity: (val: number) => void;
    onUpdateDescription: (val: string) => void;
    onUpdateStatus: (val: 'ACTIVE' | 'INACTIVE') => void;
  }

  let {
    show,
    isEditing,
    formName,
    formCode,
    formMaxCapacity,
    formDescription,
    formStatus,
    formErrorMessage,
    isSubmitting,
    onClose,
    onSubmit,
    onUpdateName,
    onUpdateCode,
    onUpdateMaxCapacity,
    onUpdateDescription,
    onUpdateStatus,
  }: Props = $props();
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
    <div class="bg-[#151519] border border-[#2E2E38] rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl text-white space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <h3 class="text-base font-outfit-600 text-white">
          {isEditing ? 'Edit Atribut Zona' : 'Tambah Zona Operasional'}
        </h3>
        <button 
          onclick={onClose}
          class="text-[#71717A] hover:text-white cursor-pointer p-1"
          aria-label="Tutup Form Zona"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if formErrorMessage}
        <div class="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{formErrorMessage}</span>
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); onSubmit(); }} class="space-y-3 text-xs">
        <div class="space-y-1">
          <label for="zone-name-input" class="block font-outfit-600 text-[#A1A1AA]">Nama Zona *</label>
          <input
            id="zone-name-input"
            type="text"
            value={formName}
            oninput={(e) => onUpdateName((e.target as HTMLInputElement).value)}
            placeholder="Contoh: Sudirman Central Area"
            required
            class="w-full px-3 py-2 bg-[#1F1F26] border border-[#2E2E38] rounded-xl text-white font-outfit-400 focus:outline-none focus:border-[#FF634A]"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label for="zone-code-input" class="block font-outfit-600 text-[#A1A1AA]">Kode Unik</label>
            <input
              id="zone-code-input"
              type="text"
              value={formCode}
              oninput={(e) => onUpdateCode((e.target as HTMLInputElement).value)}
              placeholder="SDR-01"
              class="w-full px-3 py-2 bg-[#1F1F26] border border-[#2E2E38] rounded-xl text-white font-outfit-400 focus:outline-none focus:border-[#FF634A]"
            />
          </div>

          <div class="space-y-1">
            <label for="zone-cap-input" class="block font-outfit-600 text-[#A1A1AA]">Kapasitas Rider (Unit) *</label>
            <input
              id="zone-cap-input"
              type="number"
              min="1"
              max="50"
              value={formMaxCapacity}
              oninput={(e) => onUpdateMaxCapacity(Number((e.target as HTMLInputElement).value))}
              required
              class="w-full px-3 py-2 bg-[#1F1F26] border border-[#2E2E38] rounded-xl text-white font-outfit-400 focus:outline-none focus:border-[#FF634A]"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label for="zone-desc-input" class="block font-outfit-600 text-[#A1A1AA]">Deskripsi Zona</label>
          <textarea
            id="zone-desc-input"
            value={formDescription}
            oninput={(e) => onUpdateDescription((e.target as HTMLTextAreaElement).value)}
            rows="2"
            placeholder="Rincian area target dan catatan operasional..."
            class="w-full px-3 py-2 bg-[#1F1F26] border border-[#2E2E38] rounded-xl text-white font-outfit-400 focus:outline-none focus:border-[#FF634A]"
          ></textarea>
        </div>

        <div class="space-y-1">
          <span class="block font-outfit-600 text-[#A1A1AA]">Status Zona</span>
          <div class="flex items-center gap-4 pt-1">
            <label class="flex items-center gap-1.5 cursor-pointer text-white">
              <input
                type="radio"
                name="zoneStatus"
                checked={formStatus === 'ACTIVE'}
                onchange={() => onUpdateStatus('ACTIVE')}
                class="accent-[#FF634A]"
              />
              <span>Aktif</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer text-[#A1A1AA]">
              <input
                type="radio"
                name="zoneStatus"
                checked={formStatus === 'INACTIVE'}
                onchange={() => onUpdateStatus('INACTIVE')}
                class="accent-[#FF634A]"
              />
              <span>Nonaktif</span>
            </label>
          </div>
        </div>

        <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 rounded-xl text-xs font-outfit-600 text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-4 py-2 rounded-xl bg-[#FF634A] hover:bg-[#FF4D30] text-xs font-outfit-600 text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Zona'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
