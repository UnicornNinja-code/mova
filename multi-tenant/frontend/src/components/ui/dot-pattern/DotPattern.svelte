<script lang="ts">
  import { cn } from "$lib/utils";
  interface DotPatternProps {
    width?: number | string;
    height?: number | string;
    x?: number | string;
    y?: number | string;
    cx?: number | string;
    cy?: number | string;
    cr?: number | string;
    class?: string;
    [key: string]: any;
  }

  let {
    width = 16,
    height = 16,
    x = 0,
    y = 0,
    cx = 1,
    cy = 1,
    cr = 1,
    class: className = "",
    ...restProps
  }: DotPatternProps = $props();

  // Unique pattern ID generator for Svelte 5
  const id = `pattern-${Math.random().toString(36).substring(2, 9)}`;
</script>

<svg
  aria-hidden="true"
  class={cn(
    "pointer-events-none absolute inset-0 h-full w-full fill-neutral-400/80",
    className
  )}
  {...restProps}
>
  <defs>
    <pattern
      {id}
      {width}
      {height}
      patternUnits="userSpaceOnUse"
      patternContentUnits="userSpaceOnUse"
      {x}
      {y}
    >
      <circle id={`${id}-circle`} {cx} {cy} r={cr} />
    </pattern>
  </defs>
  <rect width="100%" height="100%" stroke-width={0} fill={`url(#${id})`} />
</svg>
