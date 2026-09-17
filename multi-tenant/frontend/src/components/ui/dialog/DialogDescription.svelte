<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  interface DialogDescriptionProps extends DialogPrimitive.DescriptionProps {
    class?: string;
    children?: Snippet;
  }

  let { class: className = "", children, ...restProps }: DialogDescriptionProps = $props();
</script>

<DialogPrimitive.Description
  class={cn("text-sm text-zinc-400 leading-relaxed", className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Description>
