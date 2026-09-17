<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
    class?: string;
    children?: Snippet;
  }

  let { class: className = "", children, ...restProps }: DialogHeaderProps = $props();
</script>

<div
  class={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
  {...restProps}
>
  {@render children?.()}
</div>
