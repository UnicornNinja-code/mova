<script lang="ts">
  import { UploadCloud, Image as ImageIcon, Trash2, CheckCircle2, Loader2, Sparkles } from 'lucide-svelte';
  import { productService, type ProductUploadResponse } from '../../services/productService';

  interface Props {
    imageUrl?: string;
    onImageUploaded: (url: string) => void;
    onImageRemoved: () => void;
  }

  let { imageUrl = '', onImageUploaded, onImageRemoved }: Props = $props();

  let fileInput: HTMLInputElement;
  let isDragging = $state(false);
  let uploading = $state(false);
  let uploadStats = $state<ProductUploadResponse | null>(null);
  let errorMsg = $state<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      errorMsg = 'Harap pilih file gambar (JPG, PNG, WebP).';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      errorMsg = 'Ukuran file melebihi batas 5MB.';
      return;
    }

    errorMsg = null;
    uploading = true;

    try {
      const res = await productService.uploadImage(file);
      uploadStats = res;
      onImageUploaded(res.image_url);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal mengunggah dan mengompresi gambar.';
    } finally {
      uploading = false;
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    isDragging = true;
  };

  const handleDragLeave = () => {
    isDragging = false;
  };

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation();
    uploadStats = null;
    onImageRemoved();
    if (fileInput) fileInput.value = '';
  };
</script>

<div class="space-y-2">
  <div class="block text-xs font-bold text-[#18181B]">
    Foto Produk <span class="text-[11px] font-normal text-[#8E8E93]">(Format: JPG/PNG/WebP, Auto-compress WebP)</span>
  </div>

  <input
    bind:this={fileInput}
    id="product-image-file-input"
    type="file"
    accept="image/jpeg,image/png,image/webp,image/jpg"
    class="hidden"
    onchange={(e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        handleFile(target.files[0]);
      }
    }}
  />

  {#if imageUrl}
    <!-- Image Preview Mode with Compression Badge -->
    <div class="relative group rounded-2xl overflow-hidden border border-[#D2D2D4] bg-[#F4F4F6] p-2 flex items-center gap-3">
      <div class="w-20 h-20 rounded-xl overflow-hidden bg-white border border-[#D2D2D4] shrink-0 relative">
        <img
          src={imageUrl}
          alt="Preview Produk"
          class="w-full h-full object-cover"
        />
      </div>

      <div class="flex-1 min-w-0 pr-2">
        <div class="flex items-center gap-1 text-emerald-600 text-xs font-bold mb-1">
          <CheckCircle2 class="w-3.5 h-3.5" />
          <span>Gambar Siap & Terkompresi</span>
        </div>

        {#if uploadStats}
          <div class="text-[11px] text-[#52525B] space-y-0.5 font-medium">
            <p class="truncate text-[10px]">
              Ukuran Asli: <strong class="text-[#18181B]">{formatFileSize(uploadStats.original_size)}</strong> ➔ 
              WebP: <strong class="text-emerald-700">{formatFileSize(uploadStats.compressed_size)}</strong>
            </p>
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <Sparkles class="w-3 h-3" />
              {uploadStats.compression_ratio}
            </span>
          </div>
        {:else}
          <p class="text-[11px] text-[#8E8E93] truncate">{imageUrl}</p>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onclick={() => fileInput?.click()}
          class="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-[#D2D2D4] text-[#18181B] hover:bg-zinc-100 transition-all cursor-pointer"
        >
          Ganti
        </button>
        <button
          type="button"
          onclick={handleRemove}
          class="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
          title="Hapus Gambar"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
  {:else}
    <!-- Drag and Drop Upload Area -->
    <div
      role="button"
      tabindex="0"
      onclick={() => fileInput?.click()}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); }}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      class="border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2
      {isDragging 
        ? 'border-[#FF634A] bg-[#FFF2EF]' 
        : 'border-[#D2D2D4] bg-[#F4F4F6] hover:border-[#FF634A]/60 hover:bg-white'}"
    >
      {#if uploading}
        <div class="flex flex-col items-center gap-2 py-2">
          <Loader2 class="w-8 h-8 text-[#FF634A] animate-spin" />
          <p class="text-xs font-bold text-[#18181B]">Mengompresi ke WebP Ultra-Ringan...</p>
          <span class="text-[10px] text-[#8E8E93]">Mengurangi bobot gambar hingga 90%</span>
        </div>
      {:else}
        <div class="w-10 h-10 rounded-xl bg-white text-[#FF634A] border border-[#D2D2D4] flex items-center justify-center shadow-xs">
          <UploadCloud class="w-5 h-5" />
        </div>
        <div>
          <p class="text-xs font-bold text-[#18181B]">
            Tarik foto ke sini atau <span class="text-[#FF634A] underline">pilih dari perangkat</span>
          </p>
          <p class="text-[10px] text-[#8E8E93] mt-0.5">Maks. 5MB • Otomatis di-resize 600px & dikonversi ke WebP</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if errorMsg}
    <p class="text-xs text-rose-600 font-medium">{errorMsg}</p>
  {/if}
</div>
