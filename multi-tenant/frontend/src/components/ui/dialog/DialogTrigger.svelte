<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    children,
    ...restProps
  }: DialogPrimitive.TriggerProps & { children?: Snippet } = $props();
</script>

<DialogPrimitive.Trigger {...restProps}>
  {@render children?.()}
</DialogPrimitive.Trigger>
