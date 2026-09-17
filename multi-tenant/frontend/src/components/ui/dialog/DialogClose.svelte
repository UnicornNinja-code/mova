<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    children,
    ...restProps
  }: DialogPrimitive.CloseProps & { children?: Snippet } = $props();
</script>

<DialogPrimitive.Close {...restProps}>
  {@render children?.()}
</DialogPrimitive.Close>
