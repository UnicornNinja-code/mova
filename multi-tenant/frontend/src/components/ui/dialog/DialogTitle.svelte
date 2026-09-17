<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  interface DialogTitleProps extends DialogPrimitive.TitleProps {
    class?: string;
    children?: Snippet;
  }

  let { class: className = "", children, ...restProps }: DialogTitleProps = $props();
</script>

<DialogPrimitive.Title
  class={cn("text-lg font-semibold leading-none tracking-tight text-white", className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Title>
