<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    children,
    ...restProps
  }: PopoverPrimitive.TriggerProps & { children?: Snippet } = $props();
</script>

<PopoverPrimitive.Trigger {...restProps}>
  {@render children?.()}
</PopoverPrimitive.Trigger>
