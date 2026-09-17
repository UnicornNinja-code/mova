<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    class?: string;
  }

  let { class: className = "", ...restProps }: SkeletonProps = $props();
</script>

<div
  class={cn("animate-pulse rounded-md bg-zinc-800/60", className)}
  {...restProps}
></div>
