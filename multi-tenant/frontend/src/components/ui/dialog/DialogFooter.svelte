<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
    class?: string;
    children?: Snippet;
  }

  let { class: className = "", children, ...restProps }: DialogFooterProps = $props();
</script>

<div
  class={cn(
    "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 pt-2",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
