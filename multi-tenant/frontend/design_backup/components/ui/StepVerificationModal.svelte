<script lang="ts">
  import { 
    AlertTriangle, 
    ShieldAlert, 
    Compass, 
    Layers, 
    Trash2, 
    UserX, 
    Wrench, 
    CloudLightning, 
    Key, 
    CheckCircle2, 
    X, 
    Loader2, 
    ArrowRight,
    Sparkles,
    Info,
    Check
  } from 'lucide-svelte';
  import { 
    type VerificationContextType, 
    type VerificationSeverity, 
    VERIFICATION_PRESETS,
    type ContextPreset
  } from '../../lib/types/verificationModal.types';
  import { confirmModal } from '../../lib/stores/confirmModal.svelte';
  import Button from './Button.svelte';

  interface Props {
    // Declarative usage props
    isOpen?: boolean;
    context?: VerificationContextType;
    title?: string;
    subtitle?: string;
    badge?: string;
    targetName?: string;
    targetId?: string | number;
    severity?: VerificationSeverity;
    impactPoints?: string[];
    verificationLabel?: string;
    requirePhrase?: string | null;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: 'primary' | 'danger' | 'secondary' | 'white';
    onConfirm?: () => Promise<void> | void;
    onClose?: () => void;
    standalone?: boolean; // true if used directly as a component without store
  }

  let {
    isOpen = $bindable(false),
    context = 'CUSTOM',
    title = '',
    subtitle = '',
    badge = '',
    targetName = '',
    targetId = '',
    severity,
    impactPoints,
    verificationLabel,
    requirePhrase = null,
    confirmLabel = '',
    cancelLabel = '',
    confirmVariant,
    onConfirm,
    onClose,
    standalone = false,
  }: Props = $props();

  // Determine active mode: Standalone component props OR Global Store
  const effectiveIsOpen = $derived(standalone ? isOpen : confirmModal.isOpen);
  const effectiveContext = $derived(standalone ? context : confirmModal.options.context || 'CUSTOM');
  const preset: ContextPreset = $derived(VERIFICATION_PRESETS[effectiveContext] || VERIFICATION_PRESETS.CUSTOM);

  const effectiveTitle = $derived((standalone ? title : confirmModal.options.title) || preset.title);
  const effectiveSubtitle = $derived((standalone ? subtitle : confirmModal.options.subtitle) || preset.subtitle);
  const effectiveBadge = $derived((standalone ? badge : confirmModal.options.badge) || preset.badge);
  const effectiveTargetName = $derived((standalone ? targetName : confirmModal.options.targetName) || '');
  const effectiveSeverity: VerificationSeverity = $derived((standalone ? severity : confirmModal.options.severity) || preset.severity);
  const effectiveImpactPoints = $derived((standalone ? impactPoints : confirmModal.options.impactPoints) || preset.impactPoints);
  const effectiveVerificationLabel = $derived((standalone ? verificationLabel : confirmModal.options.verificationLabel) || preset.verificationLabel);
  const effectiveRequirePhrase = $derived(standalone ? requirePhrase : confirmModal.options.requirePhrase);
  const effectiveConfirmLabel = $derived((standalone ? confirmLabel : confirmModal.options.confirmLabel) || preset.confirmLabel);
  const effectiveCancelLabel = $derived((standalone ? cancelLabel : confirmModal.options.cancelLabel) || preset.cancelLabel);
  const effectiveConfirmVariant = $derived((standalone ? confirmVariant : confirmModal.options.confirmVariant) || preset.confirmVariant);

  // Local verification step states
  let isChecked = $state(false);
  let typedPhrase = $state('');
  let localLoading = $state(false);
  let localError = $state<string | null>(null);

  // Reset verification states when modal opens
  $effect(() => {
    if (effectiveIsOpen) {
      isChecked = false;
      typedPhrase = '';
      localLoading = false;
      localError = null;
    }
  });

  const isPhraseValid = $derived(
    !effectiveRequirePhrase || typedPhrase.trim().toUpperCase() === effectiveRequirePhrase.trim().toUpperCase()
  );

  const canConfirm = $derived(isChecked && isPhraseValid);

  // Contextual icon selector
  const contextIcon = $derived(() => {
    switch (effectiveContext) {
      case 'DSS_RECALIBRATE':
        return Compass;
      case 'DISTRIBUTION_COMMIT':
        return Layers;
      case 'DELETE_PRODUCT':
        return Trash2;
      case 'DELETE_USER':
        return UserX;
      case 'USER_TOGGLE_STATUS':
        return ShieldAlert;
      case 'ARMADA_MAINTENANCE_OVERRIDE':
        return Wrench;
      case 'ARMADA_DELETE':
        return Trash2;
      case 'ZONE_CREATE_UPDATE':
        return Layers;
      case 'ZONE_TOGGLE_STATUS':
        return ShieldAlert;
      case 'ZONE_DELETE':
        return Trash2;
      case 'SPATIAL_RULES_UPDATE':
        return ShieldAlert;
      case 'WEATHER_SYNC_BROADCAST':
        return CloudLightning;
      case 'USER_PASSWORD_RESET':
        return Key;
      case 'CHECKOUT_SHIFT':
        return CheckCircle2;
      default:
        return AlertTriangle;
    }
  });

  // Severity styling map
  const severityStyles = $derived(() => {
    switch (effectiveSeverity) {
      case 'danger':
        return {
          glow: 'bg-rose-500/15',
          border: 'border-rose-800/40',
          badgeBg: 'bg-rose-950/60 text-rose-400 border-rose-800/50',
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        };
      case 'warning':
        return {
          glow: 'bg-[#FF634A]/15',
          border: 'border-[#FF634A]/30',
          badgeBg: 'bg-[#FF634A]/10 text-[#FF8573] border-[#FF634A]/25',
          iconBg: 'bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B]',
        };
      case 'info':
        return {
          glow: 'bg-blue-500/15',
          border: 'border-blue-800/40',
          badgeBg: 'bg-blue-950/60 text-blue-300 border-blue-800/50',
          iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        };
      case 'success':
        return {
          glow: 'bg-emerald-500/15',
          border: 'border-emerald-800/40',
          badgeBg: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
    }
  });

  const handleClose = () => {
    if (standalone) {
      isOpen = false;
      if (onClose) onClose();
    } else {
      confirmModal.cancel();
    }
  };

  const handleConfirmAction = async () => {
    if (!canConfirm) return;

    if (standalone) {
      if (onConfirm) {
        localLoading = true;
        localError = null;
        try {
          await onConfirm();
          isOpen = false;
        } catch (err: any) {
          localError = err?.response?.data?.msg || err?.message || 'Gagal mengeksekusi tindakan.';
        } finally {
          localLoading = false;
        }
      } else {
        isOpen = false;
      }
    } else {
      await confirmModal.confirm();
    }
  };

  const IconComponent = $derived(contextIcon());
  const styles = $derived(severityStyles());
  const effectiveLoading = $derived(standalone ? localLoading : confirmModal.loading);
  const effectiveError = $derived(standalone ? localError : confirmModal.errorMsg);
</script>

{#if effectiveIsOpen}
  <!-- Scrim & Backdrop with Blur -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#09090B]/80 backdrop-blur-md font-outfit-400 select-none animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
  >
    <!-- Ambient Contextual Glow -->
    <div class="absolute w-[450px] h-[450px] {styles.glow} rounded-full blur-[140px] pointer-events-none"></div>

    <!-- Modal Card -->
    <div 
      class="relative w-full max-w-lg bg-[#131316] rounded-3xl border {styles.border} shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150"
    >
      <!-- Top Accent Line -->
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF634A] to-transparent"></div>

      <!-- Header with Context Icon & Badge -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3.5">
          <div class="w-12 h-12 rounded-2xl {styles.iconBg} flex items-center justify-center shadow-lg shrink-0 border border-white/10">
            <IconComponent class="w-6 h-6 stroke-[2.2]" />
          </div>

          <div class="space-y-1">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border {styles.badgeBg}">
              <Sparkles class="w-3 h-3" />
              <span>{effectiveBadge}</span>
            </div>

            <h3 class="text-base sm:text-lg font-outfit-600 text-white leading-tight">
              {effectiveTitle}
            </h3>

            {#if effectiveTargetName}
              <div class="text-xs font-mono font-bold text-[#FF8573] bg-[#18181D] px-2.5 py-1 rounded-lg border border-[#272730] inline-block mt-0.5">
                Target: {effectiveTargetName}
              </div>
            {/if}
          </div>
        </div>

        <button
          type="button"
          onclick={handleClose}
          disabled={effectiveLoading}
          class="p-1.5 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer disabled:opacity-30 shrink-0"
          aria-label="Tutup modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Subtitle & Context Explanation -->
      <p class="text-xs text-[#A1A1AA] leading-relaxed">
        {effectiveSubtitle}
      </p>

      <!-- Step 1: Impact Points & System Insight -->
      {#if effectiveImpactPoints && effectiveImpactPoints.length > 0}
        <div class="p-3.5 rounded-2xl bg-[#18181D] border border-[#24242A] space-y-2">
          <div class="flex items-center justify-between text-[11px] font-outfit-600 text-zinc-300 pb-1.5 border-b border-[#24242A]">
            <span>Dampak & Konsekuensi Sistem</span>
            <span class="text-[9px] font-mono text-[#71717A] uppercase">Langkah 1 dari 2</span>
          </div>

          <div class="space-y-1.5 text-xs text-zinc-400">
            {#each effectiveImpactPoints as point}
              <div class="flex items-start gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#FF634A] shrink-0 mt-1.5"></span>
                <span class="leading-relaxed">{point}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Step 2: Verification Checkpoint (Interactive Checkbox) -->
      <div class="p-3.5 rounded-2xl bg-[#18181D] border border-[#24242A] space-y-3">
        <div class="flex items-center justify-between text-[11px] font-outfit-600 text-zinc-300 pb-1.5 border-b border-[#24242A]">
          <span>Verifikasi Tindakan Pengguna</span>
          <span class="text-[9px] font-mono text-[#FF8573] uppercase font-bold">Langkah 2 dari 2</span>
        </div>

        <!-- Checkbox Confirmation -->
        <label class="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={isChecked}
            disabled={effectiveLoading}
            class="w-4 h-4 accent-[#FF634A] rounded cursor-pointer mt-0.5 shrink-0"
          />
          <span class="leading-relaxed font-medium">
            {effectiveVerificationLabel}
          </span>
        </label>

        <!-- Optional Phrase Requirement (for ultra-danger actions) -->
        {#if effectiveRequirePhrase}
          <div class="pt-2 border-t border-[#24242A] space-y-1.5">
            <span class="text-[10px] text-[#A1A1AA] block">
              Ketik frasa <strong class="text-white font-mono">{effectiveRequirePhrase}</strong> di bawah untuk membuka tombol eksekusi:
            </span>
            <input
              type="text"
              bind:value={typedPhrase}
              disabled={effectiveLoading}
              placeholder={effectiveRequirePhrase}
              class="w-full px-3 py-2 text-xs bg-[#131316] border border-[#272730] rounded-xl text-white font-mono focus:outline-none focus:border-[#FF634A]"
            />
          </div>
        {/if}
      </div>

      <!-- Error Message Banner -->
      {#if effectiveError}
        <div class="p-3 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-200 flex items-center gap-2">
          <ShieldAlert class="w-4 h-4 text-rose-400 shrink-0" />
          <span>{effectiveError}</span>
        </div>
      {/if}

      <!-- Action Footer -->
      <div class="pt-1 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onclick={handleClose}
          disabled={effectiveLoading}
          class="px-4 py-2.5 rounded-xl text-xs font-outfit-600 text-[#A1A1AA] hover:text-white bg-[#18181D] border border-[#272730] hover:border-[#383842] transition-colors cursor-pointer disabled:opacity-30"
        >
          {effectiveCancelLabel}
        </button>

        <Button
          type="button"
          variant={effectiveConfirmVariant}
          size="sm"
          loading={effectiveLoading}
          disabled={!canConfirm}
          onclick={handleConfirmAction}
        >
          <span>{effectiveConfirmLabel}</span>
        </Button>
      </div>
    </div>
  </div>
{/if}
