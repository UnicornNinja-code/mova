<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  interface BoxIconProps extends HTMLAttributes<HTMLElement> {
    name: string; // e.g. "bx-coffee", "bxs-check-circle", "bx-map", "bx-search"
    size?: number | string; // size in px, e.g. 16, 18, 20, 24, 32
    color?: string;
    class?: string;
  }

  let {
    name,
    size = 20,
    color,
    class: className = "",
    ...restProps
  }: BoxIconProps = $props();

  // Normalize class name: ensure "bx" prefix exists
  const iconClass = $derived.by(() => {
    if (name.startsWith("bx-") || name.startsWith("bxs-") || name.startsWith("bxl-")) {
      return `bx ${name}`;
    }
    return `bx bx-${name}`;
  });

  const styleString = $derived.by(() => {
    const sizeVal = typeof size === "number" ? `${size}px` : size;
    const parts = [`font-size: ${sizeVal}`];
    if (color) parts.push(`color: ${color}`);
    return parts.join("; ");
  });
</script>

<i
  class={cn("inline-flex items-center justify-center leading-none select-none", iconClass, className)}
  style={styleString}
  aria-hidden="true"
  {...restProps}
></i>
