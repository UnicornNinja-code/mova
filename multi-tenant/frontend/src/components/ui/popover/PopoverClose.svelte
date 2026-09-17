<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    children,
    ...restProps
  }: PopoverPrimitive.CloseProps & { children?: Snippet } = $props();
</script>

<PopoverPrimitive.Close {...restProps}>
  {@render children?.()}
</PopoverPrimitive.Close>
