<script lang="ts">
  import { Button } from "$components/ui/button";
  import { DotPattern } from "$components/ui/dot-pattern";

  interface NotFoundPageProps {
    onHome?: () => void;
  }

  let { onHome }: NotFoundPageProps = $props();
</script>

<div class="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] px-6 text-center overflow-hidden font-sans selection:bg-[#FF634A]/30">
  <!-- Ambient Dot Pattern -->
  <DotPattern
    class="[mask-image:radial-gradient(600px_circle_at_center,white,transparent)] opacity-35 fill-zinc-500 pointer-events-none"
    width={20}
    height={20}
    cr={1.2}
  />

  <div class="relative z-10 max-w-md space-y-4">
    <!-- Big Clean 404 in Outfit -->
    <h1 class="font-heading text-8xl sm:text-9xl font-extrabold tracking-tighter text-white select-none leading-none">
      404
    </h1>

    <div class="space-y-1.5 pt-1">
      <h2 class="font-heading text-xl sm:text-2xl font-bold text-white">
        Halaman Tidak Ditemukan
      </h2>
      <p class="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
        Maaf, rute atau halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
    </div>

    <!-- Navigation Buttons: Left = Kembali Sebelumnya, Right = Kembali ke Dashboard -->
    <div class="flex items-center justify-center gap-3 pt-4">
      <Button
        variant="outline"
        size="sm"
        onclick={() => window.history.back()}
        class="h-9 px-4 text-xs font-medium"
      >
        <i class="bx bx-arrow-back text-sm"></i>
        <span>Kembali ke Halaman Sebelumnya</span>
      </Button>

      <Button
        variant="default"
        size="sm"
        onclick={() => onHome?.()}
        class="h-9 px-4 text-xs font-medium shadow-md shadow-[#FF634A]/25"
      >
        <span>Kembali ke Dashboard</span>
        <i class="bx bx-right-arrow-alt text-sm"></i>
      </Button>
    </div>
  </div>
</div>
