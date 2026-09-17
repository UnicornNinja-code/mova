<script lang="ts">
  import { Button } from "$components/ui/button";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
  } from "$components/ui/dialog";

  interface ConfirmationModalProps {
    open?: boolean;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    onconfirm?: () => void;
    oncancel?: () => void;
  }

  let {
    open = $bindable(false),
    title = "Konfirmasi Tindakan",
    description = "Apakah Anda yakin ingin melanjutkan tindakan ini? Data yang telah diubah tidak dapat dikembalikan.",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    variant = "default",
    onconfirm,
    oncancel,
  }: ConfirmationModalProps = $props();

  function handleConfirm() {
    open = false;
    onconfirm?.();
  }

  function handleCancel() {
    open = false;
    oncancel?.();
  }
</script>

<Dialog bind:open>
  <DialogContent class="sm:max-w-md bg-[#131316] border-white/10 text-white font-sans">
    <div class="flex items-start gap-4">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl {variant === 'destructive' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-[#FF634A]/15 text-[#FF634A] border border-[#FF634A]/30'}">
        <i class="bx {variant === 'destructive' ? 'bx-error-alt' : 'bx-help-circle'} text-2xl"></i>
      </div>

      <div class="space-y-1.5 flex-1">
        <DialogHeader class="text-left">
          <DialogTitle class="font-heading text-lg font-bold text-white">{title}</DialogTitle>
          <DialogDescription class="text-xs text-zinc-400 leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
      </div>
    </div>

    <DialogFooter class="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
      <DialogClose>
        <Button variant="outline" size="sm" onclick={handleCancel} class="h-9 px-4 text-xs font-medium">
          {cancelText}
        </Button>
      </DialogClose>

      <Button
        variant={variant === "destructive" ? "destructive" : "default"}
        size="sm"
        onclick={handleConfirm}
        class="h-9 px-4 text-xs font-semibold shadow-md {variant === 'destructive' ? 'shadow-rose-500/20' : 'shadow-[#FF634A]/25'}"
      >
        {confirmText}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
