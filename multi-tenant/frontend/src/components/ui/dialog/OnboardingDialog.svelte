<script lang="ts">
  import { Button } from "$components/ui/button";
  import { Badge } from "$components/ui/badge";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from "$components/ui/dialog";

  interface OnboardingDialogProps {
    open?: boolean;
    onfinish?: () => void;
  }

  let { open = $bindable(false), onfinish }: OnboardingDialogProps = $props();

  let currentStep = $state(1);
  const totalSteps = 3;

  const steps = [
    {
      step: 1,
      title: "Verifikasi Kode Undangan & Hub",
      badge: "In Review",
      desc: "Setiap petugas lapangan diwajibkan melakukan aktivasi akun menggunakan kode token undangan resmi dari koordinator Hub operasional.",
      icon: "bx-id-card",
    },
    {
      step: 2,
      title: "3-Menit Hold & Checklist Fisik",
      badge: "Hold",
      desc: "Saat memilih armada di aplikasi, sistem mengunci unit selama 3 menit untuk memberi waktu Anda mengecek kondisi rem, ban, dan gembok bagasi.",
      icon: "bx-check-shield",
    },
    {
      step: 3,
      title: "Geofence Boundary & Navigasi",
      badge: "Active",
      desc: "Sistem memantau posisi LBS rider dalam polygon zona aktif. Pastikan Anda berada dalam radius 100m dari titik target zona.",
      icon: "bx-map-pin",
    },
  ];

  function handleNext() {
    if (currentStep < totalSteps) {
      currentStep += 1;
    } else {
      open = false;
      currentStep = 1;
      onfinish?.();
    }
  }

  function handleSkip() {
    open = false;
    currentStep = 1;
    onfinish?.();
  }
</script>

<Dialog bind:open>
  <DialogContent class="sm:max-w-lg bg-[#131316] border-white/10 text-white font-sans p-6 sm:p-8">
    <!-- Step Progress Tracker in Outfit -->
    <div class="mb-6 flex items-center justify-between border-b border-white/[0.06] pb-4">
      <div class="flex items-center gap-2">
        <span class="font-heading text-xs font-semibold text-zinc-400">
          LANGKAH {currentStep} DARI {totalSteps}
        </span>
        <Badge variant={currentStep === 1 ? "in-review" : currentStep === 2 ? "hold" : "active"}>
          {steps[currentStep - 1].badge}
        </Badge>
      </div>

      <!-- Step dots -->
      <div class="flex items-center gap-1.5">
        {#each Array(totalSteps) as _, i}
          <div
            class="h-1.5 rounded-full transition-all duration-300 {currentStep === i + 1 ? 'w-6 bg-[#FF634A]' : 'w-2 bg-zinc-700'}"
          ></div>
        {/each}
      </div>
    </div>

    <!-- Active Step Content -->
    <div class="space-y-4 py-2">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF634A]/15 text-[#FF634A] border border-[#FF634A]/30">
        <i class="bx {steps[currentStep - 1].icon} text-3xl"></i>
      </div>

      <DialogHeader class="text-left space-y-1.5">
        <DialogTitle class="font-heading text-xl font-bold text-white">
          {steps[currentStep - 1].title}
        </DialogTitle>
        <DialogDescription class="text-sm text-zinc-400 leading-relaxed">
          {steps[currentStep - 1].desc}
        </DialogDescription>
      </DialogHeader>
    </div>

    <!-- Actions -->
    <DialogFooter class="pt-6 border-t border-white/[0.06] flex items-center justify-between">
      <Button variant="ghost" size="sm" onclick={handleSkip} class="text-xs text-zinc-400 hover:text-white">
        Lewati Tutorial
      </Button>

      <div class="flex items-center gap-2">
        {#if currentStep > 1}
          <Button variant="outline" size="sm" onclick={() => (currentStep -= 1)} class="text-xs">
            Kembali
          </Button>
        {/if}

        <Button variant="default" size="sm" onclick={handleNext} class="text-xs font-semibold shadow-md shadow-[#FF634A]/25">
          <span>{currentStep === totalSteps ? "Selesai & Masuk" : "Lanjutkan"}</span>
          <i class="bx bx-right-arrow-alt text-base"></i>
        </Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
