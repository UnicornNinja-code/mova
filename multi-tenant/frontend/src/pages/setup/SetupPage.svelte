<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Sparkles, 
    Building2, 
    Clock, 
    Bike, 
    Map, 
    BrainCircuit, 
    Database, 
    CheckCircle2,
    ShieldAlert
  } from 'lucide-svelte';
  import { setupStore } from '../../lib/stores/setupStore.svelte';
  import SystemIdentityStep from './steps/SystemIdentityStep.svelte';
  import OperationsStep from './steps/OperationsStep.svelte';
  import InitialFleetStep from './steps/InitialFleetStep.svelte';
  import MapPreferencesStep from './steps/MapPreferencesStep.svelte';
  import DssCalibrationStep from './steps/DssCalibrationStep.svelte';
  import DataSynchronizationStep from './steps/DataSynchronizationStep.svelte';
  import SetupReviewStep from './steps/SetupReviewStep.svelte';
  import MovaLoading from '../../components/ui/MovaLoading.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let isApplying = $state(false);
  let errorMsg = $state<string | null>(null);
  let showFinishingLoading = $state(false);

  // Transition state when arriving from first-login password change
  let showMovaTransition = $state(
    typeof window !== 'undefined' && sessionStorage.getItem('mova_transition') === 'true'
  );

  const handleMovaTransitionComplete = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('mova_transition');
    }
    showMovaTransition = false;
  };

  const steps = [
    { num: 1, label: 'Identitas', desc: 'Nama & Hub', icon: Building2 },
    { num: 2, label: 'Kebijakan', desc: 'Jam & Radius', icon: Clock },
    { num: 3, label: 'Armada', desc: 'Unit Awal', icon: Bike },
    { num: 4, label: 'Peta', desc: 'Preferensi', icon: Map },
    { num: 5, label: 'Model DSS', desc: 'Prioritas BWM', icon: BrainCircuit },
    { num: 6, label: 'Sinkronisasi', desc: 'Lingkungan Data', icon: Database },
    { num: 7, label: 'Verifikasi', desc: 'Tinjau & Aktifkan', icon: CheckCircle2 },
  ];

  onMount(async () => {
    const status = await setupStore.checkStatus();
    // If setup was already completed, protect route and forward to dashboard
    if (status && status.status === 'COMPLETED' && !showMovaTransition) {
      onNavigate('/dashboard');
    }
  });

  // Guard against browser refresh or navigation during locked sync
  $effect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (setupStore.isSyncingLocked) {
        e.preventDefault();
        e.returnValue = 'Sinkronisasi spasial sedang berlangsung di latar belakang. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  const handleNext = async () => {
    errorMsg = null;
    const current = setupStore.currentStep;

    if (current < 7) {
      const ok = await setupStore.saveStep(current);
      if (ok) {
        setupStore.currentStep = (current + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        errorMsg = 'Gagal menyimpan kemajuan tahapan. Silakan coba lagi.';
      }
    } else {
      // Step 7: Final Apply
      await handleFinalApply();
    }
  };

  const handlePrev = () => {
    errorMsg = null;
    if (setupStore.currentStep > 1) {
      setupStore.currentStep = (setupStore.currentStep - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalApply = async () => {
    isApplying = true;
    errorMsg = null;
    const success = await setupStore.applyConfiguration();
    if (!success) {
      isApplying = false;
      errorMsg = 'Gagal menerapkan konfigurasi sistem ke basis data. Pastikan koneksi server stabil.';
    }
  };

  const handleApplyingCompleted = () => {
    isApplying = false;
    onNavigate('/dashboard');
  };
</script>

{#if showMovaTransition}
  <MovaLoading onComplete={handleMovaTransitionComplete} duration={2000} subtitle="Menyiapkan lingkungan setup..." />
{:else if isApplying}
  <MovaLoading onComplete={handleApplyingCompleted} duration={2000} />
{:else}
  <div class="min-h-screen bg-[#09090B] pattern-dots-dark text-white font-outfit-400 flex flex-col justify-between py-6 sm:py-10 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden">
    <!-- Ambient Lighting Effects -->
    <div class="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#FF634A]/10 rounded-full blur-[160px] pointer-events-none"></div>

    <div class="max-w-5xl mx-auto w-full space-y-6 sm:space-y-8 relative z-10">
      <!-- Top Brand & Wizard Header -->
      <div class="flex items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
        <div class="flex items-center gap-2.5">
          <span class="font-heading text-2xl font-black tracking-[-0.035em] text-white">Mova<span class="text-[#FF634A]">.</span></span>
          <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FF634A]/10 text-[#FF8573] border border-[#FF634A]/20 uppercase">
            Setup
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-zinc-400">Fase</span>
          <span class="font-outfit-700 font-mono text-sm text-[#FF634A]">{setupStore.currentStep}</span>
          <span class="text-xs text-zinc-500">/</span>
          <span class="font-outfit-700 font-mono text-sm text-zinc-300">7</span>
        </div>
      </div>

      <!-- 7-Step Progress Stepper Indicator -->
      <div class="bg-[#18181D]/80 border border-[#272730] backdrop-blur-md rounded-2xl p-3 sm:p-4">
        <!-- Desktop Horizontal Stepper -->
        <div class="hidden md:grid grid-cols-7 gap-2">
          {#each steps as s}
            {@const isDone = s.num < setupStore.currentStep}
            {@const isCurrent = s.num === setupStore.currentStep}
            <div class="flex flex-col items-center text-center relative group">
              <!-- Step Circle / Badge -->
              <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-outfit-700 transition-all border {isCurrent ? 'bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-white border-white/20 shadow-md shadow-[#FF634A]/30 scale-105' : isDone ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-[#121214] border-[#272730] text-zinc-500'}">
                {#if isDone}
                  <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                {:else}
                  <span>{s.num}</span>
                {/if}
              </div>

              <!-- Label & Subtext -->
              <p class="text-[11px] font-outfit-700 mt-2 truncate w-full {isCurrent ? 'text-white' : isDone ? 'text-zinc-300' : 'text-zinc-500'}">
                {s.label}
              </p>
              <p class="text-[9px] text-zinc-400 truncate w-full">
                {s.desc}
              </p>
            </div>
          {/each}
        </div>

        <!-- Mobile Compact Stepper -->
        <div class="md:hidden space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-outfit-700 text-white">
              Langkah {setupStore.currentStep}: {steps[setupStore.currentStep - 1]?.label}
            </span>
            <span class="text-zinc-400 text-[11px]">
              {steps[setupStore.currentStep - 1]?.desc}
            </span>
          </div>
          <!-- Progress Bar -->
          <div class="w-full bg-[#121214] h-2 rounded-full overflow-hidden border border-[#272730]">
            <div
              class="bg-gradient-to-r from-[#FF634A] to-[#FF8573] h-full transition-all duration-300"
              style="width: {(setupStore.currentStep / 7) * 100}%"
            ></div>
          </div>
        </div>
      </div>

      {#if errorMsg}
        <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
          <ShieldAlert class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <!-- Dynamic Step Content Card -->
      <div class="bg-[#18181D]/60 backdrop-blur-xl border border-[#272730] rounded-3xl p-5 sm:p-8 shadow-2xl">
        {#if setupStore.currentStep === 1}
          <SystemIdentityStep onConfirmedNext={handleNext} />
        {:else if setupStore.currentStep === 2}
          <OperationsStep onNext={handleNext} onPrev={handlePrev} />
        {:else if setupStore.currentStep === 3}
          <InitialFleetStep onNext={handleNext} onPrev={handlePrev} />
        {:else if setupStore.currentStep === 4}
          <MapPreferencesStep onNext={handleNext} onPrev={handlePrev} />
        {:else if setupStore.currentStep === 5}
          <DssCalibrationStep onNext={handleNext} onPrev={handlePrev} />
        {:else if setupStore.currentStep === 6}
          <DataSynchronizationStep onNext={handleNext} onPrev={handlePrev} />
        {:else if setupStore.currentStep === 7}
          <SetupReviewStep onApply={handleFinalApply} onPrev={handlePrev} />
        {/if}
      </div>
    </div>

    <!-- Clean Footer -->
    <div class="mt-8 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
      <span>MOVA Intelligent DSS Platform</span>
      <span>•</span>
      <span>Versi Inisialisasi Fondasi</span>
    </div>
  </div>
{/if}
