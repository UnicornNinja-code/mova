<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { X } from "lucide-svelte";
  import { cn } from "$lib/utils";
  import DialogOverlay from "./DialogOverlay.svelte";
  import type { Snippet } from "svelte";

  interface DialogContentProps extends DialogPrimitive.ContentProps {
    class?: string;
    showCloseButton?: boolean;
    children?: Snippet;
  }

  let {
    class: className = "",
    showCloseButton = true,
    children,
    ...restProps
  }: DialogContentProps = $props();
</script>

<DialogPrimitive.Portal>
  <DialogOverlay />
  <DialogPrimitive.Content
    class={cn(
      "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-zinc-800 bg-zinc-900 p-6 shadow-2xl duration-200 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
      className
    )}
    {...restProps}
  >
    {@render children?.()}

    {#if showCloseButton}
      <DialogPrimitive.Close
        class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-zinc-950 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#FF634A] focus:ring-offset-2 disabled:pointer-events-none text-zinc-400 hover:text-white cursor-pointer"
      >
        <X class="h-4 w-4" />
        <span class="sr-only">Close</span>
      </DialogPrimitive.Close>
    {/if}
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
